import 'dart:math' as math;
import 'dart:ui';

import 'package:flame/game.dart';
import 'package:flutter/foundation.dart';

import 'data/carts.dart';
import 'data/items.dart';
import 'data/modes.dart';
import 'entities.dart';
import 'rendering/first_person_renderer.dart';
import 'rendering/follow_cam_renderer.dart';
import 'rendering/textures.dart';
import 'rendering/top_down_renderer.dart';
import 'run_result.dart';
import 'world/grid_world.dart';
import 'world/shelf.dart';
import 'world/store_world.dart';

typedef RunEndedCallback = void Function(RunResult result);

/// Shopping-trip game. Player + cart are separate entities. The run is a
/// shopping list to complete, followed by a checkout. No passive score,
/// no combos, no powerups.
class GroceryDashGame extends FlameGame {
  GroceryDashGame({
    required this.cartDef,
    required this.previousHighScore,
    required this.onRunEnded,
    required this.mode, // kept for API compat; only Shopping Trip used
    required this.cameraMode,
  });

  final CartDef cartDef;
  final int previousHighScore;
  final RunEndedCallback onRunEnded;
  final GameMode mode;
  final ValueNotifier<CameraMode> cameraMode;

  // HUD notifiers
  final ValueNotifier<int> collectedNotifier = ValueNotifier(0);
  final ValueNotifier<int> totalNotifier = ValueNotifier(0);
  final ValueNotifier<String?> bannerNotifier = ValueNotifier(null);
  final ValueNotifier<bool> atCheckoutNotifier = ValueNotifier(false);
  final ValueNotifier<bool> cartParkedNotifier = ValueNotifier(false);
  final ValueNotifier<double> unattendedNotifier = ValueNotifier(0);
  final ValueNotifier<InteractPrompt?> promptNotifier = ValueNotifier(null);
  final ValueNotifier<double> reachProgressNotifier = ValueNotifier(0);
  final ValueNotifier<double> checkoutProgressNotifier = ValueNotifier(0);

  // World + entities — eagerly initialised with placeholders so the HUD
  // (which may build before onLoad completes) can read them safely.
  late StoreWorld storeWorld;
  Player player = Player(x: 0, y: 0);
  Cart cart = Cart(x: 0, y: 0);
  ShoppingList list = ShoppingList([]);
  bool _worldReady = false;

  // Input
  Offset joystick = Offset.zero;
  bool interactHeld = false;

  // Run state
  double _elapsed = 0;
  @override
  bool paused = false;
  bool _runOver = false;
  int _itemsStolenByNpcs = 0;

  // Renderers
  final FollowCamRenderer _follow =
      FollowCamRenderer(viewport: const Size(400, 800));
  final TopDownRenderer _top = TopDownRenderer(viewport: const Size(400, 800));
  FirstPersonRenderer? _fpv;    // initialised async with texture atlas
  late GridWorld _grid;

  // Movement tuning
  static const double _playerWalkSpeed = 260;      // on foot
  static const double _cartMaxSpeed = 220;          // when pushing cart
  static const double _cartAccel = 900;             // px/s^2
  static const double _cartFriction = 5.0;          // velocity decay when idle
  static const double _playerRadius = 14;
  static const double _cartRadius = 22;

  // Slot interaction
  ShelfSlot? _focusedSlot;

  @override
  Future<void> onLoad() async {
    storeWorld = StoreWorld(seed: DateTime.now().millisecondsSinceEpoch);
    storeWorld.populate();
    _grid = GridWorld.fromLayout(storeWorld.layout);
    final spawn = storeWorld.layout.spawnPoint;
    player.x = spawn.dx;
    player.y = spawn.dy - 30;
    // Face north (into the store) on spawn
    player.facing = -math.pi / 2;
    cart.x = spawn.dx;
    cart.y = spawn.dy;
    cart.heading = -math.pi / 2;
    _follow.viewport = Size(size.x, size.y);
    _top.viewport = Size(size.x, size.y);
    // Build texture atlas and first-person renderer async
    TextureAtlas.build().then((atlas) {
      _fpv = FirstPersonRenderer(
        viewport: Size(size.x, size.y),
        atlas: atlas,
      );
    });

    // Build shopping list from the world's generator
    final raw = storeWorld.generateShoppingList(5);
    final entries = raw
        .map((e) => ShoppingListEntry(
              item: kItems.firstWhere((it) => it.id == e.key),
              needed: e.value,
            ))
        .toList();
    // Dispose placeholder, replace with populated list
    list.dispose();
    list = ShoppingList(entries);
    list.addListener(_syncListNotifiers);
    _syncListNotifiers();

    _worldReady = true;
  }

  void _syncListNotifiers() {
    collectedNotifier.value = list.completeCount;
    totalNotifier.value = list.totalCount;
  }

  @override
  void onGameResize(Vector2 size) {
    super.onGameResize(size);
    _follow.viewport = Size(size.x, size.y);
    _top.viewport = Size(size.x, size.y);
    _fpv?.viewport = Size(size.x, size.y);
  }

  // ==================== input ====================
  void setJoystick(Offset v) => joystick = v;
  void setInteractHeld(bool v) => interactHeld = v;

  /// Called by HUD "Park / Take" button
  void toggleCartAttached() {
    if (!_worldReady || _runOver) return;
    if (player.mode == PlayerMode.reaching ||
        player.mode == PlayerMode.checkout) {
      return;
    }
    if (cart.state == CartState.attached) {
      cart.state = CartState.parked;
      cart.vx = 0;
      cart.vy = 0;
      player.mode = PlayerMode.onFoot;
      cartParkedNotifier.value = true;
      _setBanner('Cart parked. Mind the aisle — and your stuff.');
    } else {
      // Only re-attach if player is next to the cart
      final d = _dist(player.x, player.y, cart.x, cart.y);
      if (d > 60) {
        _setBanner('Walk back to your cart to take it.');
        return;
      }
      cart.state = CartState.attached;
      player.mode = PlayerMode.pushing;
      cart.unattendedTimer = 0;
      cartParkedNotifier.value = false;
      unattendedNotifier.value = 0;
      _setBanner(null);
    }
  }

  /// Called by HUD "Grab" / "Scan" button (or spacebar).
  void onInteractPressed() {
    if (!_worldReady || _runOver) return;
    if (player.mode == PlayerMode.reaching) return;
    if (player.mode == PlayerMode.checkout) return;

    // Checkout interaction
    if (list.allComplete) {
      for (final c in storeWorld.checkouts) {
        final d = _dist(
          player.x, player.y,
          c.interactPoint.dx, c.interactPoint.dy,
        );
        if (d < 80) {
          _beginCheckout();
          return;
        }
      }
    }

    // Shelf slot interaction
    final slot = _focusedSlot;
    if (slot == null || slot.empty) return;
    player.mode = PlayerMode.reaching;
    player.reachingForItem = slot.item;
    player.reachTimer = 0;
    reachProgressNotifier.value = 0;
    joystick = Offset.zero;
  }

  void _beginCheckout() {
    player.mode = PlayerMode.checkout;
    player.checkoutTimer = 0;
    checkoutProgressNotifier.value = 0;
    atCheckoutNotifier.value = false;
    _setBanner('Scanning…');
  }

  // ==================== update ====================
  @override
  void update(double dt) {
    super.update(dt);
    if (!_worldReady || _runOver || paused) return;
    _elapsed += dt;

    _updateInteraction(dt);

    switch (player.mode) {
      case PlayerMode.pushing:
        _updatePushingCart(dt);
      case PlayerMode.onFoot:
        _updateOnFoot(dt);
      case PlayerMode.reaching:
        _updateReaching(dt);
      case PlayerMode.checkout:
        _updateCheckoutScan(dt);
    }

    // Unattended cart accounting + theft AI resolution
    _updateCartUnattended(dt);

    // Drive head bob from actual velocity magnitude
    final bobSpeed = player.mode == PlayerMode.pushing
        ? math.sqrt(cart.vx * cart.vx + cart.vy * cart.vy)
        : math.sqrt(player.vx * player.vx + player.vy * player.vy);
    _fpv?.updateHeadBob(dt, bobSpeed);

    storeWorld.tick(
      dt,
      playerX: player.x,
      playerY: player.y,
      unattendedCart: cart.state == CartState.parked
          ? Offset(cart.x, cart.y)
          : null,
    );

    _resolveNpcThefts();
    _resolveCheckoutReady();
  }

  void _updateInteraction(double dt) {
    // Find the closest shelf slot to wherever the player is standing.
    // Only non-empty slots within 60 pixels count.
    final found = storeWorld.shelfIndex.nearest(player.x, player.y, within: 60);
    _focusedSlot = found;

    // Build prompt notification
    if (player.mode == PlayerMode.checkout ||
        player.mode == PlayerMode.reaching) {
      promptNotifier.value = null;
    } else if (list.allComplete) {
      // Check proximity to checkout
      for (final c in storeWorld.checkouts) {
        final d = _dist(
            player.x, player.y, c.interactPoint.dx, c.interactPoint.dy);
        if (d < 80) {
          promptNotifier.value = InteractPrompt.scan();
          return;
        }
      }
      promptNotifier.value = null;
    } else if (_focusedSlot != null) {
      promptNotifier.value = InteractPrompt.grab(_focusedSlot!.item);
    } else {
      promptNotifier.value = null;
    }
  }

  void _updatePushingCart(double dt) {
    final firstPerson = cameraMode.value == CameraMode.firstPerson;
    final mag = joystick.distance.clamp(0.0, 1.0);

    if (firstPerson) {
      // Tank controls: X = turn rate, Y (inverted, up = forward) = accelerate
      // along current heading.
      final turn = joystick.dx;
      const turnRate = 2.6; // rad/s at full stick
      cart.heading += turn * turnRate * dt;
      player.facing = cart.heading;
      final forwardAmount = -joystick.dy; // stick up is forward
      if (mag > 0.08) {
        final ax = math.cos(cart.heading) * forwardAmount * _cartAccel;
        final ay = math.sin(cart.heading) * forwardAmount * _cartAccel;
        cart.vx += ax * dt;
        cart.vy += ay * dt;
      } else {
        cart.vx -= cart.vx * math.min(1.0, _cartFriction * dt);
        cart.vy -= cart.vy * math.min(1.0, _cartFriction * dt);
        if (cart.vx.abs() < 1) cart.vx = 0;
        if (cart.vy.abs() < 1) cart.vy = 0;
      }
    } else {
      // Analog top-down controls (follow cam / map)
      if (mag > 0.08) {
        final ax = joystick.dx * _cartAccel;
        final ay = joystick.dy * _cartAccel;
        cart.vx += ax * dt;
        cart.vy += ay * dt;
        final targetHeading = math.atan2(joystick.dy, joystick.dx);
        cart.heading = _lerpAngle(cart.heading, targetHeading, dt * 5);
      } else {
        cart.vx -= cart.vx * math.min(1.0, _cartFriction * dt);
        cart.vy -= cart.vy * math.min(1.0, _cartFriction * dt);
        if (cart.vx.abs() < 1) cart.vx = 0;
        if (cart.vy.abs() < 1) cart.vy = 0;
      }
    }
    // Clamp speed
    final speed = math.sqrt(cart.vx * cart.vx + cart.vy * cart.vy);
    if (speed > _cartMaxSpeed) {
      cart.vx *= _cartMaxSpeed / speed;
      cart.vy *= _cartMaxSpeed / speed;
    }
    // Apply movement with wall sliding
    final nx = cart.x + cart.vx * dt;
    final ny = cart.y + cart.vy * dt;
    final slid = storeWorld.layout.slide(cart.x, cart.y, nx, ny, _cartRadius);
    // If we got clipped, kill velocity along that axis
    if (slid.dx == cart.x) cart.vx = 0;
    if (slid.dy == cart.y) cart.vy = 0;
    cart.x = slid.dx;
    cart.y = slid.dy;

    // Player snaps to a position behind the cart based on heading
    final behindX = cart.x - math.cos(cart.heading) * 28;
    final behindY = cart.y - math.sin(cart.heading) * 28;
    player.x = behindX;
    player.y = behindY;
    player.facing = cart.heading;

    _resolveNpcBumps(pushing: true);
  }

  void _updateOnFoot(double dt) {
    final firstPerson = cameraMode.value == CameraMode.firstPerson;
    final mag = joystick.distance.clamp(0.0, 1.0);
    if (firstPerson) {
      const turnRate = 2.8;
      player.facing += joystick.dx * turnRate * dt;
      final forward = -joystick.dy;
      if (mag > 0.08) {
        player.vx = math.cos(player.facing) * _playerWalkSpeed * forward;
        player.vy = math.sin(player.facing) * _playerWalkSpeed * forward;
      } else {
        player.vx = 0;
        player.vy = 0;
      }
    } else {
      if (mag > 0.08) {
        player.vx = joystick.dx * _playerWalkSpeed * mag;
        player.vy = joystick.dy * _playerWalkSpeed * mag;
        player.facing = math.atan2(joystick.dy, joystick.dx);
      } else {
        player.vx = 0;
        player.vy = 0;
      }
    }
    final nx = player.x + player.vx * dt;
    final ny = player.y + player.vy * dt;
    final slid =
        storeWorld.layout.slide(player.x, player.y, nx, ny, _playerRadius);
    player.x = slid.dx;
    player.y = slid.dy;
    _resolveNpcBumps(pushing: false);
  }

  void _updateReaching(double dt) {
    player.reachTimer += dt;
    reachProgressNotifier.value =
        (player.reachTimer / player.reachTotal).clamp(0.0, 1.0);
    // Cancel if player gave up (moved the stick)
    if (joystick.distance > 0.3 || !interactHeld) {
      if (joystick.distance > 0.5) {
        _cancelReach();
        return;
      }
    }
    if (player.reachTimer >= player.reachTotal) {
      _completeReach();
    }
  }

  void _cancelReach() {
    player.mode = cart.state == CartState.attached
        ? PlayerMode.pushing
        : PlayerMode.onFoot;
    player.reachTimer = 0;
    player.reachingForItem = null;
    reachProgressNotifier.value = 0;
  }

  void _completeReach() {
    final slot = _focusedSlot;
    if (slot != null && !slot.empty && slot.item == player.reachingForItem) {
      slot.stock--;
      cart.addItem(slot.item);
      list.recount(cart);
      if (list.allComplete) {
        _setBanner('List complete. Head to checkout.');
      }
    }
    _cancelReach();
  }

  void _updateCheckoutScan(double dt) {
    player.checkoutTimer += dt;
    checkoutProgressNotifier.value =
        (player.checkoutTimer / Player.checkoutTotal).clamp(0.0, 1.0);
    if (player.checkoutTimer >= Player.checkoutTotal) {
      _endRun(cleared: true);
    }
  }

  void _updateCartUnattended(double dt) {
    if (cart.state == CartState.parked) {
      cart.unattendedTimer += dt;
      unattendedNotifier.value = cart.unattendedTimer;
    } else {
      cart.unattendedTimer = 0;
      unattendedNotifier.value = 0;
    }
  }

  /// When a thieving NPC "reaches" the unattended cart, the world tick sets
  /// their stolenItem. We resolve the consequence here: remove a basket item.
  void _resolveNpcThefts() {
    if (cart.state != CartState.parked) return;
    for (final n in storeWorld.npcs) {
      if (!n.isThieving || n.stolenItem == null) continue;
      // Was the NPC actually at the cart? If stateTimer has expired they're
      // now fleeing. We remove one random item from the basket when the
      // animation first triggers (stateTimer > 0 but stolenItem was just set
      // by world). Simple guard: remove only once per theft.
      if (n.stateTimer > 0 && cart.basket.isNotEmpty &&
          n.stolenItem == kItems.first && _rng().nextDouble() < 0.9) {
        // Pick a random item from cart and yank it
        final idx = _rng().nextInt(cart.basket.length);
        final item = cart.basket.removeAt(idx);
        n.stolenItem = item;
        list.recount(cart);
        _itemsStolenByNpcs++;
        _setBanner('Someone took your ${item.name}!');
      }
    }
  }

  /// Show a small "Head to checkout" banner once list completes, and flip
  /// the at-checkout prompt when the player is near a lane with a full list.
  void _resolveCheckoutReady() {
    if (!list.allComplete) {
      atCheckoutNotifier.value = false;
      return;
    }
    for (final c in storeWorld.checkouts) {
      final d = _dist(player.x, player.y,
          c.interactPoint.dx, c.interactPoint.dy);
      if (d < 80) {
        atCheckoutNotifier.value = true;
        return;
      }
    }
    atCheckoutNotifier.value = false;
  }

  /// Gentle NPC-collision resolution. Bumps now just stop you briefly and
  /// nudge the NPC aside — no knockdowns, no heat meter.
  void _resolveNpcBumps({required bool pushing}) {
    final radius = pushing ? _cartRadius + 18 : _playerRadius + 18;
    final px = pushing ? cart.x : player.x;
    final py = pushing ? cart.y : player.y;
    for (final n in storeWorld.npcs) {
      if (n.consumed) continue;
      if (n.isStunned) continue;
      final dx = n.x - px;
      final dy = n.y - py;
      final d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        final d = math.sqrt(d2);
        final nx = d == 0 ? 0 : dx / d;
        final ny = d == 0 ? 0 : dy / d;
        // Push NPC aside by a small amount
        n.x += nx * 8;
        n.y += ny * 8;
        // Briefly stun NPC so they reconsider their path
        if (n.state == NpcState.browsing ||
            n.state == NpcState.crossing) {
          n.state = NpcState.stunned;
          n.stateTimer = 0.4;
        }
        // Slow the player/cart
        if (pushing) {
          cart.vx *= 0.4;
          cart.vy *= 0.4;
        } else {
          player.vx *= 0.3;
          player.vy *= 0.3;
        }
      }
    }
  }

  // ==================== rendering ====================
  @override
  void render(Canvas canvas) {
    super.render(canvas);
    if (!_worldReady) return;
    switch (cameraMode.value) {
      case CameraMode.topDown:
        _top.renderShoppingTrip(canvas, storeWorld, player, cart, cartDef);
      case CameraMode.firstPerson:
        final fpv = _fpv;
        if (fpv != null) {
          fpv.render(
            canvas,
            storeWorld,
            _grid,
            player,
            cart,
            cartDef,
            _focusedSlot,
          );
        } else {
          // Atlas still baking — fallback to follow cam for this frame
          _follow.renderShoppingTrip(
            canvas, storeWorld, player, cart, cartDef, _focusedSlot,
          );
        }
      case CameraMode.sideScroll:
        _follow.renderShoppingTrip(
          canvas, storeWorld, player, cart, cartDef, _focusedSlot,
        );
    }
  }

  // ==================== run end ====================
  void _endRun({bool cleared = false}) {
    if (_runOver) return;
    _runOver = true;
    paused = true;

    // Scoring for the receipt — simple sum of what you bought
    final score = cart.basket.fold<int>(0, (sum, it) => sum + it.score) +
        (cleared ? 300 : 0) - _itemsStolenByNpcs * 20;
    final coins = cart.basket.fold<int>(0, (sum, it) => sum + it.coin) +
        (cleared ? 20 : 0);
    final identity = cleared
        ? (list.allComplete ? 'List Crusher' : 'Light Shopper')
        : 'Walked Out';
    onRunEnded(RunResult(
      score: score.clamp(0, 1 << 30),
      coinsEarned: coins.clamp(0, 1 << 30),
      duration: Duration(milliseconds: (_elapsed * 1000).round()),
      basket: List.unmodifiable(cart.basket),
      completedCombos: const [],
      crashCause: null,
      basketIdentity: identity,
      isNewHighScore: score > previousHighScore,
      fragilesBroken: 0,
    ));
  }

  void _setBanner(String? text) {
    bannerNotifier.value = text;
  }

  // ---- utilities ----
  double _dist(double ax, double ay, double bx, double by) {
    final dx = bx - ax;
    final dy = by - ay;
    return math.sqrt(dx * dx + dy * dy);
  }

  double _lerpAngle(double from, double to, double t) {
    var diff = (to - from) % (2 * math.pi);
    if (diff > math.pi) diff -= 2 * math.pi;
    return from + diff * t.clamp(0, 1);
  }

  math.Random _rng() => math.Random();

  @override
  void onRemove() {
    collectedNotifier.dispose();
    totalNotifier.dispose();
    bannerNotifier.dispose();
    atCheckoutNotifier.dispose();
    cartParkedNotifier.dispose();
    unattendedNotifier.dispose();
    promptNotifier.dispose();
    reachProgressNotifier.dispose();
    checkoutProgressNotifier.dispose();
    super.onRemove();
  }
}

/// A small descriptor for the "what would pressing interact do right now"
/// prompt displayed in the HUD.
class InteractPrompt {
  const InteractPrompt._({required this.label, required this.subLabel});
  final String label;
  final String subLabel;

  factory InteractPrompt.grab(ItemDef item) =>
      InteractPrompt._(label: 'GRAB', subLabel: item.name);
  factory InteractPrompt.scan() =>
      const InteractPrompt._(label: 'SCAN', subLabel: 'Checkout');
}
