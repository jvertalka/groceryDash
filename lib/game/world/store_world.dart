import 'dart:math';
import 'dart:ui';

import '../data/items.dart';
import '../data/obstacles.dart';
import '../data/sections.dart';
import 'shelf.dart';
import 'store_layout.dart';

/// NPC high-level behaviour state.
enum NpcState {
  browsing,   // walking to a target point or reading a shelf
  reaching,   // standing in front of a shelf slot, occupying it
  crossing,   // walking across an open floor to another section
  stunned,    // briefly knocked off path after a collision
  thieving,   // walking to an unattended cart to nick an item
}

/// An NPC shopper with simple goal-directed behaviour: pick a section,
/// walk to a shelf slot, "reach" for a few seconds (occupying the slot),
/// move on. Occasionally a shopper will decide to browse an unattended
/// cart instead.
class Npc {
  Npc({
    required this.def,
    required this.x,
    required this.y,
  });
  final ObstacleDef def;
  double x;
  double y;
  double vx = 0;
  double vy = 0;
  double wobble = 0;
  bool consumed = false;

  NpcState state = NpcState.browsing;
  double stateTimer = 0;
  Offset? target;               // world-space point the NPC is walking to
  ShelfSlot? occupyingSlot;     // slot they are currently blocking
  ItemDef? stolenItem;          // item they nicked from an unattended cart

  /// Currently visible speech bubble line — drawn as a billboard above the
  /// NPC when the renderer sees it. Cleared after [dialogueTimer] expires.
  String? dialogue;
  double dialogueTimer = 0;

  bool get isStunned => state == NpcState.stunned;
  bool get isReaching => state == NpcState.reaching;
  bool get isThieving => state == NpcState.thieving;
}

/// Checkout lane — a rectangular trigger at the south of the store.
class CheckoutLane {
  const CheckoutLane({required this.rect, required this.interactPoint});
  final Rect rect;
  final Offset interactPoint; // where the cart has to be to trigger scan
}

/// The store world. Shelves are now containers of slots; items live in
/// slots rather than as free-floating pickups.
class StoreWorld {
  StoreWorld({int? seed}) : _rng = Random(seed) {
    layout = StoreLayout.standard();
  }

  final Random _rng;
  late final StoreLayout layout;

  Size get size => layout.size;

  /// Flat list of all shelf slots in the store (computed in populate()).
  late ShelfIndex shelfIndex;

  final List<Npc> npcs = [];
  final List<CheckoutLane> checkouts = [];

  /// Populate slots on every shelf, fridge, and produce bin. Also spawn
  /// NPCs and define checkout lanes.
  void populate() {
    final slots = <ShelfSlot>[];
    npcs.clear();
    checkouts.clear();

    for (final solid in layout.solids) {
      switch (solid.kind) {
        case SolidKind.shelf:
          _populateShelfFaces(solid, slots);
        case SolidKind.produceBin:
          _populateBin(solid, slots);
        case SolidKind.fridge:
          _populateFridgeFace(solid, slots);
        case SolidKind.counter:
        case SolidKind.wall:
          break;
      }
    }

    shelfIndex = ShelfIndex(slots);

    // Checkout lanes — south row of counters, one interact point each.
    for (final solid in layout.solids) {
      if (solid.kind != SolidKind.counter) continue;
      if (solid.rect.top < layout.size.height - 300) continue;
      final interact = Offset(solid.rect.center.dx, solid.rect.top - 40);
      checkouts.add(CheckoutLane(rect: solid.rect, interactPoint: interact));
    }

    _spawnNpcs(12);
  }

  void _populateShelfFaces(SolidRect shelf, List<ShelfSlot> out) {
    final section = sectionById(shelf.sectionId);
    final itemIds = <String>[
      ...section.itemIdsPrimary,
      ...section.itemIdsSecondary,
    ];
    if (itemIds.isEmpty) return;
    // 6 evenly spaced slots per face
    const slotCount = 6;
    // West face
    for (var i = 0; i < slotCount; i++) {
      final t = (i + 0.5) / slotCount;
      final y = shelf.rect.top + shelf.rect.height * t;
      final def = kItems.firstWhere(
          (it) => it.id == itemIds[i % itemIds.length]);
      out.add(ShelfSlot(
        item: def,
        position: Offset(shelf.rect.left - 28, y),
        facing: -1,
      ));
    }
    // East face (offset rotation so different items appear)
    for (var i = 0; i < slotCount; i++) {
      final t = (i + 0.5) / slotCount;
      final y = shelf.rect.top + shelf.rect.height * t;
      final def = kItems.firstWhere(
          (it) => it.id == itemIds[(i + 3) % itemIds.length]);
      out.add(ShelfSlot(
        item: def,
        position: Offset(shelf.rect.right + 28, y),
        facing: 1,
      ));
    }
  }

  void _populateBin(SolidRect bin, List<ShelfSlot> out) {
    final section = sectionById(bin.sectionId);
    final itemIds = section.itemIdsPrimary.isEmpty
        ? [kItems.first.id]
        : section.itemIdsPrimary;
    // Two slots on top of each bin
    for (var i = 0; i < 2; i++) {
      final def = kItems.firstWhere(
          (it) => it.id == itemIds[i % itemIds.length]);
      out.add(ShelfSlot(
        item: def,
        position: Offset(
          bin.rect.center.dx + (i == 0 ? -24 : 24),
          bin.rect.top - 18,
        ),
        facing: 0,
      ));
    }
  }

  void _populateFridgeFace(SolidRect fridge, List<ShelfSlot> out) {
    final section = sectionById(fridge.sectionId);
    final itemIds = section.itemIdsPrimary.isEmpty
        ? [kItems.first.id]
        : section.itemIdsPrimary;
    const slotCount = 5;
    for (var i = 0; i < slotCount; i++) {
      final t = (i + 0.5) / slotCount;
      final y = fridge.rect.top + fridge.rect.height * t;
      final def = kItems.firstWhere(
          (it) => it.id == itemIds[i % itemIds.length]);
      out.add(ShelfSlot(
        item: def,
        position: Offset(fridge.rect.left - 28, y),
        facing: -1,
      ));
    }
  }

  void _spawnNpcs(int count) {
    final pool = ['shopper', 'shopper', 'shopper', 'stocker', 'kid', 'cart'];
    for (var i = 0; i < count; i++) {
      final p = layout.randomWalkablePoint(_rng);
      final id = pool[_rng.nextInt(pool.length)];
      final def = kObstacles.firstWhere((o) => o.id == id,
          orElse: () => kObstacles.first);
      npcs.add(Npc(def: def, x: p.dx, y: p.dy));
    }
  }

  /// Advance the world. Player world-space position is needed for chase
  /// targeting. `unattendedCart` (if non-null) is an abandoned cart position
  /// so shoppers may opt to "borrow" from it.
  void tick(
    double dt, {
    double playerX = 0,
    double playerY = 0,
    Offset? unattendedCart,
  }) {
    for (final n in npcs) {
      if (n.consumed) continue;
      n.wobble += dt;
      if (n.dialogueTimer > 0) {
        n.dialogueTimer -= dt;
        if (n.dialogueTimer <= 0) n.dialogue = null;
      }
      if (n.def.id == 'spill' || n.def.id == 'grapes') continue;

      _tickNpc(n, dt, playerX, playerY, unattendedCart);
    }
  }

  void _tickNpc(
      Npc n, double dt, double px, double py, Offset? unattendedCart) {
    if (n.stateTimer > 0) {
      n.stateTimer -= dt;
      if (n.stateTimer <= 0) {
        switch (n.state) {
          case NpcState.stunned:
            n.state = NpcState.browsing;
            n.target = null;
          case NpcState.reaching:
            // Release the slot and pick a new target
            if (n.occupyingSlot != null) {
              n.occupyingSlot = null;
            }
            n.state = NpcState.browsing;
            n.target = null;
          case NpcState.thieving:
            // "Nicked" an item — set stolenItem and flee
            n.state = NpcState.crossing;
            n.target = layout.randomWalkablePoint(_rng);
            n.stateTimer = 0;
          case NpcState.browsing:
          case NpcState.crossing:
            break;
        }
      }
    }

    // If browsing and near the unattended cart, occasionally turn thief.
    if (unattendedCart != null &&
        n.state == NpcState.browsing &&
        !n.isThieving &&
        _d2(n.x, n.y, unattendedCart.dx, unattendedCart.dy) < 240 * 240 &&
        _rng.nextDouble() < dt / 8) {
      n.state = NpcState.thieving;
      n.target = unattendedCart;
      n.stateTimer = 0;
    }

    // Pick a new destination if we don't have one
    if ((n.state == NpcState.browsing || n.state == NpcState.crossing) &&
        (n.target == null ||
            _d2(n.x, n.y, n.target!.dx, n.target!.dy) < 24 * 24)) {
      _pickNewTarget(n);
    }

    if (n.isStunned || n.isReaching) return;

    final target = n.target;
    if (target == null) return;
    final dx = target.dx - n.x;
    final dy = target.dy - n.y;
    final d = _len(dx, dy);
    if (d < 1) return;

    final speed = switch (n.def.id) {
      'cart' => 110.0,
      'kid' => 90.0,
      'stocker' => 50.0,
      _ => 60.0,
    };
    final nx = n.x + dx / d * speed * dt;
    final ny = n.y + dy / d * speed * dt;
    final slid = layout.slide(n.x, n.y, nx, ny, 18);
    n.vx = (slid.dx - n.x) / dt;
    n.vy = (slid.dy - n.y) / dt;
    n.x = slid.dx;
    n.y = slid.dy;

    // If we reached a shelf slot target, settle in and "reach".
    if (n.state == NpcState.browsing &&
        _d2(n.x, n.y, target.dx, target.dy) < 24 * 24 &&
        n.occupyingSlot != null) {
      n.state = NpcState.reaching;
      n.stateTimer = 2 + _rng.nextDouble() * 2;
      return;
    }
    // If thieving target reached: "nick" one item (caller resolves effect)
    if (n.isThieving &&
        unattendedCart != null &&
        _d2(n.x, n.y, unattendedCart.dx, unattendedCart.dy) < 30 * 30) {
      n.stateTimer = 0.6; // brief animation, then flees
      // Keep state as thieving until timer expires; caller reads stolenItem
      // when it's non-null. Flag it here by marking a placeholder; the game
      // class will assign the real stolen item on the frame the state expires.
      n.stolenItem ??= kItems.first;
    }
  }

  /// Pick a new target for the NPC — usually a shelf slot in a random section.
  void _pickNewTarget(Npc n) {
    // 70% chance of heading to a shelf slot; 30% just crossing.
    final picksShelf = _rng.nextDouble() < 0.7;
    if (picksShelf && shelfIndex.slots.isNotEmpty) {
      // Pick a free slot
      for (var attempt = 0; attempt < 20; attempt++) {
        final s = shelfIndex.slots[_rng.nextInt(shelfIndex.slots.length)];
        if (s.empty) continue;
        // Prefer a slot no other NPC is already reaching for
        final taken = npcs.any((other) =>
            other != n && other.occupyingSlot == s);
        if (taken) continue;
        n.state = NpcState.browsing;
        n.target = s.position;
        n.occupyingSlot = s;
        return;
      }
    }
    n.state = NpcState.crossing;
    n.target = layout.randomWalkablePoint(_rng);
  }

  /// Generate a shopping list: N items drawn from primary pools across
  /// several sections.
  List<MapEntry<String, int>> generateShoppingList(int targetCount) {
    final ids = <String>{};
    while (ids.length < targetCount) {
      final section = kSections[_rng.nextInt(kSections.length)];
      if (section.itemIdsPrimary.isEmpty) continue;
      ids.add(section.itemIdsPrimary[
          _rng.nextInt(section.itemIdsPrimary.length)]);
    }
    return ids.map((id) => MapEntry(id, 1 + _rng.nextInt(2))).toList();
  }

  // -------- helpers --------
  static double _len(double dx, double dy) => sqrt(dx * dx + dy * dy);
  static double _d2(double x1, double y1, double x2, double y2) {
    final dx = x2 - x1;
    final dy = y2 - y1;
    return dx * dx + dy * dy;
  }
}
