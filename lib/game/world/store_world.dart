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
  fleeing,    // thief escaping with a stolen item
  chasing,    // NPC pursuing the player (reserved; unused for now)
}

/// Behavioural archetype for NPCs. Affects walking speed, how long they
/// linger at a shelf, which section they prefer, and which dialogue lines
/// they use on bump.
enum NpcPersonality {
  browser,   // default; takes their time, no section preference
  couponer,  // slow, lingers a long time, hoards one section
  parent,    // jittery, changes direction often, short linger
  rusher,    // in a hurry, fast, rude
  worker,    // stocker; stays at shelves longer, moderate speed
}

extension NpcPersonalityX on NpcPersonality {
  double get speedMult => switch (this) {
        NpcPersonality.browser => 1.0,
        NpcPersonality.couponer => 0.55,
        NpcPersonality.parent => 1.1,
        NpcPersonality.rusher => 1.55,
        NpcPersonality.worker => 0.75,
      };

  /// (min, max) seconds an NPC lingers at a shelf slot.
  (double, double) get lingerRange => switch (this) {
        NpcPersonality.browser => (2.0, 4.0),
        NpcPersonality.couponer => (4.0, 7.0),
        NpcPersonality.parent => (0.9, 1.8),
        NpcPersonality.rusher => (0.6, 1.4),
        NpcPersonality.worker => (3.0, 5.0),
      };

  /// Probability per frame of picking a new random target mid-path.
  double get jitterChance => switch (this) {
        NpcPersonality.parent => 0.003,
        NpcPersonality.rusher => 0.001,
        _ => 0.0,
      };
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

  /// Behavioural archetype assigned at spawn.
  NpcPersonality personality = NpcPersonality.browser;

  /// Couponers prefer shelves in this section.
  String? preferredSectionId;

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

/// A ceiling-hung aisle sign billboarded in first-person view.
class AisleSign {
  const AisleSign({
    required this.position,
    required this.sectionId,
  });
  final Offset position;
  final String sectionId;
}

/// A restocking pallet placed in the aisle by a stocker NPC. Blocks cart
/// movement while it's there; removed when the stocker finishes.
class Pallet {
  Pallet({
    required this.x,
    required this.y,
    required this.owner,
    this.life = 10.0,
  });
  final double x;
  final double y;
  /// Stocker NPC that placed this pallet — the pallet is removed when they
  /// transition out of their `reaching` state.
  final Npc owner;
  double life;
  bool consumed = false;
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

  /// Hang points for ceiling aisle signs. One per section, placed at the
  /// centre of the section's first zone.
  final List<AisleSign> aisleSigns = [];

  /// Active pallets placed by stockers. Block cart movement.
  final List<Pallet> pallets = [];

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

    // One sign per section, hung at the centre of the first zone with
    // that section id.
    aisleSigns.clear();
    final placed = <String>{};
    for (final zone in layout.zones) {
      if (placed.contains(zone.sectionId)) continue;
      placed.add(zone.sectionId);
      aisleSigns.add(AisleSign(
        position: zone.rect.center,
        sectionId: zone.sectionId,
      ));
    }
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
      final npc = Npc(def: def, x: p.dx, y: p.dy)
        ..personality = _rollPersonality(def.id);
      if (npc.personality == NpcPersonality.couponer) {
        npc.preferredSectionId =
            kSections[_rng.nextInt(kSections.length)].id;
      }
      npcs.add(npc);
    }
  }

  /// Weighted personality roll. The NPC's `def.id` biases the distribution:
  /// stockers are always workers, kids are never couponers, runaway carts
  /// are always rushers.
  NpcPersonality _rollPersonality(String defId) {
    if (defId == 'stocker') return NpcPersonality.worker;
    if (defId == 'cart') return NpcPersonality.rusher;
    if (defId == 'kid') {
      // Kids are parents-adjacent or browsers
      return _rng.nextDouble() < 0.5
          ? NpcPersonality.parent
          : NpcPersonality.browser;
    }
    // Regular shoppers — weighted mix
    final r = _rng.nextDouble();
    if (r < 0.40) return NpcPersonality.browser;
    if (r < 0.65) return NpcPersonality.couponer;
    if (r < 0.85) return NpcPersonality.parent;
    return NpcPersonality.rusher;
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
            // Pull one unit of stock off the shelf when the NPC leaves —
            // they "took" the item with them. Empty slots silently release.
            final slot = n.occupyingSlot;
            if (slot != null && !slot.empty) {
              slot.stock--;
            }
            n.occupyingSlot = null;
            n.state = NpcState.browsing;
            n.target = null;
            // Stockers drag a pallet into the aisle while restocking — pull
            // it back when they leave.
            pallets.removeWhere((p) => identical(p.owner, n));
          case NpcState.thieving:
            // Finished grabbing at the cart — transition to fleeing with
            // the stolen item visible above their head. Target the far
            // corner from the player so the player has to chase.
            n.state = NpcState.fleeing;
            n.target = _farCorner(px, py);
            n.stateTimer = 12.0;
          case NpcState.fleeing:
            // Ran out the clock without being caught — despawn the thief
            // and the item is lost for good.
            n.consumed = true;
            n.target = null;
          case NpcState.chasing:
            n.state = NpcState.browsing;
            n.target = null;
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

    // Pick a new destination if we don't have one, or jitter to a new one
    // for personalities that fidget (parents, rushers).
    final jittered = _rng.nextDouble() < n.personality.jitterChance;
    if ((n.state == NpcState.browsing || n.state == NpcState.crossing) &&
        (n.target == null ||
            _d2(n.x, n.y, n.target!.dx, n.target!.dy) < 24 * 24 ||
            jittered)) {
      _pickNewTarget(n);
    }

    if (n.isStunned || n.isReaching) return;

    final target = n.target;
    if (target == null) return;
    final dx = target.dx - n.x;
    final dy = target.dy - n.y;
    final d = _len(dx, dy);
    if (d < 1) return;

    final baseSpeed = switch (n.def.id) {
      'cart' => 110.0,
      'kid' => 90.0,
      'stocker' => 50.0,
      _ => 60.0,
    };
    // Fleeing/chasing NPCs move faster regardless of personality.
    final stateMult = switch (n.state) {
      NpcState.fleeing => 1.8,
      NpcState.chasing => 1.5,
      _ => 1.0,
    };
    final speed = baseSpeed * n.personality.speedMult * stateMult;
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
      final (lo, hi) = n.personality.lingerRange;
      n.stateTimer = lo + _rng.nextDouble() * (hi - lo);
      // Stockers drop a pallet in the aisle next to the shelf they're
      // restocking. Players have to route around it.
      if (n.personality == NpcPersonality.worker) {
        final slot = n.occupyingSlot!;
        // Pallet sits roughly between the stocker and the open floor side.
        final palletX = n.x + (slot.facing == -1 ? 40 : -40);
        pallets.add(Pallet(x: palletX, y: n.y, owner: n));
      }
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

  /// Pick a new target for the NPC — usually a shelf slot in a random
  /// section. Couponers strongly prefer their assigned section. Rushers
  /// prefer crossing over browsing (always on the move).
  void _pickNewTarget(Npc n) {
    final personality = n.personality;
    final picksShelfThreshold = switch (personality) {
      NpcPersonality.rusher => 0.25,
      NpcPersonality.couponer => 0.9,
      NpcPersonality.worker => 0.85,
      _ => 0.7,
    };
    final picksShelf = _rng.nextDouble() < picksShelfThreshold;
    if (picksShelf && shelfIndex.slots.isNotEmpty) {
      // Couponers: filter by their preferred section first.
      final candidates = personality == NpcPersonality.couponer &&
              n.preferredSectionId != null
          ? shelfIndex.slots
              .where((s) {
                final z = layout.zones.firstWhere(
                  (z) => z.rect.contains(s.position),
                  orElse: () => layout.zones.first,
                );
                return z.sectionId == n.preferredSectionId;
              })
              .toList()
          : shelfIndex.slots;
      if (candidates.isNotEmpty) {
        for (var attempt = 0; attempt < 20; attempt++) {
          final s = candidates[_rng.nextInt(candidates.length)];
          if (s.empty) continue;
          final taken = npcs.any((other) =>
              other != n && other.occupyingSlot == s);
          if (taken) continue;
          n.state = NpcState.browsing;
          n.target = s.position;
          n.occupyingSlot = s;
          return;
        }
      }
    }
    n.state = NpcState.crossing;
    n.target = layout.randomWalkablePoint(_rng);
  }

  /// True if a circle centred on (x,y) with `radius` overlaps any pallet.
  /// Pallets are axis-aligned ~44-unit squares.
  bool blockedByPallet(double x, double y, double radius) {
    const half = 24.0;
    for (final p in pallets) {
      if (p.consumed) continue;
      final cx = x.clamp(p.x - half, p.x + half);
      final cy = y.clamp(p.y - half, p.y + half);
      final dx = x - cx;
      final dy = y - cy;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }

  /// Slide a circle around pallets the same way the layout does around
  /// static solids — try each axis independently.
  Offset slideAroundPallets(
      double fromX, double fromY, double toX, double toY, double radius) {
    var x = fromX;
    var y = fromY;
    if (!blockedByPallet(toX, y, radius)) x = toX;
    if (!blockedByPallet(x, toY, radius)) y = toY;
    return Offset(x, y);
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

  /// Pick the corner of the store walkable area farthest from (x,y).
  Offset _farCorner(double x, double y) {
    final w = layout.size.width;
    final h = layout.size.height;
    final corners = <Offset>[
      const Offset(120, 300),
      Offset(w - 120, 300),
      Offset(120, h - 260),
      Offset(w - 120, h - 260),
    ];
    Offset best = corners.first;
    double bestD2 = 0;
    for (final c in corners) {
      final dx = c.dx - x;
      final dy = c.dy - y;
      final d2 = dx * dx + dy * dy;
      if (d2 > bestD2) {
        bestD2 = d2;
        best = c;
      }
    }
    return best;
  }

  // -------- helpers --------
  static double _len(double dx, double dy) => sqrt(dx * dx + dy * dy);
  static double _d2(double x1, double y1, double x2, double y2) {
    final dx = x2 - x1;
    final dy = y2 - y1;
    return dx * dx + dy * dy;
  }
}
