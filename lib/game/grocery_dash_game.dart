import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flame/game.dart';
import 'package:flutter/foundation.dart';

import 'data/carts.dart';
import 'data/items.dart';
import 'data/modes.dart';
import 'data/sections.dart';
import 'entities.dart';
import 'announcements.dart';
import 'audio.dart';
import 'rendering/first_person_renderer.dart';
import 'rendering/follow_cam_renderer.dart';
import 'rendering/sprite_atlas.dart';
import 'rendering/textures.dart';
import 'rendering/top_down_renderer.dart';
import 'run_result.dart';
import 'world/grid_world.dart';
import 'world/shelf.dart';
import 'world/store_world.dart';

typedef RunEndedCallback = void Function(RunResult result);

/// One-liners NPCs say when bumped, keyed by personality. Gives each
/// archetype a distinct voice.
const Map<NpcPersonality, List<String>> kBumpLinesByPersonality = {
  NpcPersonality.browser: ['Excuse me!', 'Watch it!', 'Oof.', 'Rude.'],
  NpcPersonality.couponer: [
    'I had a coupon for that!',
    'Excuse me, dearie.',
    'Wait your turn.',
    'Hmph.',
  ],
  NpcPersonality.parent: [
    'Careful, my kid\'s right there!',
    'Oh my god.',
    'Sorry, sorry!',
    'Hey, slow down.',
  ],
  NpcPersonality.rusher: [
    'MOVE!',
    'Coming through!',
    'Behind you!',
    'Out of my way!',
  ],
  NpcPersonality.worker: [
    'Aisle\'s busy, friend.',
    'Let me work.',
    'Careful of the pallet.',
    'Coming through with stock!',
  ],
};

/// Lines NPCs say when they've been outright run over (tier-2 bump).
const Map<NpcPersonality, List<String>> _painLinesByPersonality = {
  NpcPersonality.browser: ['OW!', 'What the—?!', 'Hey watch where—', 'Ugh.'],
  NpcPersonality.couponer: [
    'Well I never!',
    'My HIP!',
    'Someone call the manager!',
  ],
  NpcPersonality.parent: [
    'Oh no, you okay buddy?',
    'Seriously?!',
    'We\'re leaving.',
  ],
  NpcPersonality.rusher: ['OOF!', 'FORGET THIS.', '#@!*'],
  NpcPersonality.worker: [
    'You OK pal?',
    'I\'ll report this.',
    'Dude.',
  ],
};

/// Lines NPCs say when they've just stolen an item from the player's cart.
const List<String> kThiefLines = [
  'Finders keepers.',
  'Pardon me.',
  'Mine now.',
  'Oops. Taking this.',
];

/// Lines played when a contest starts — NPC reacts to the player grabbing
/// for the same shelf slot.
const List<String> kContestLines = [
  'Hey, I was here first!',
  'That\u2019s mine!',
  'Not so fast.',
];

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
  /// Fires with the focused slot id (or null) whenever the shelf face the
  /// player is near changes — so the HUD shelf panel can rebuild.
  final ValueNotifier<int> shelfFaceTickNotifier = ValueNotifier(0);
  /// Non-null while an item contest is in progress.
  final ValueNotifier<bool> contestNotifier = ValueNotifier(false);

  /// Rotating PA announcements.
  final AnnouncementQueue announcements = AnnouncementQueue();

  /// Compass hint — polar angle (radians, 0 = forward, -π/2 = left) from
  /// the cart to the nearest needed shelf slot, plus the label of the
  /// item we're pointing at. Null when list is empty / player is at goal.
  final ValueNotifier<CompassHint?> compassNotifier = ValueNotifier(null);

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
  static const double _cartBrakeFriction = 14.0;    // extra decay when braking
  static const double _icyFrictionMult = 0.35;      // frozen aisle feels slippery
  static const double _playerRadius = 14;
  static const double _cartRadius = 22;

  // Cart visual polish state
  double _cartDisplayHeading = 0;  // lags behind actual heading
  double _cartPitch = 0;           // +ve = accel push, -ve = brake lean
  bool _isBraking = false;

  // Slot interaction
  ShelfSlot? _focusedSlot;
  Npc? _contestOpponent; // NPC also going for the focused slot

  /// Identity set so we only announce each pallet once when it appears.
  final Set<Pallet> _announcedPallets = {};

  /// Transient camera shake — decays to 0 over ~0.4s after a big impact.
  double _shake = 0;
  double _shakeX = 0;
  double _shakeY = 0;
  final math.Random _shakeRng = math.Random();

  /// All slots on the same shelf face as the currently focused slot. Used
  /// by the HUD shelf-face selector. Groups by matching `facing` sign and
  /// a tight axial distance along the shelf's long edge.
  List<ShelfSlot> shelfFaceSlots() {
    final focus = _focusedSlot;
    if (focus == null) return const [];
    final along = focus.facing == 0
        ? 0 // top slots — treat as same face by proximity
        : focus.facing;
    final out = <ShelfSlot>[];
    for (final s in storeWorld.shelfIndex.slots) {
      if (s.empty) continue;
      if (s.facing != along) continue;
      // For vertical shelves (east/west), match x within 1 cell; group by y.
      if (along != 0 &&
          (s.position.dx - focus.position.dx).abs() < 60 &&
          (s.position.dy - focus.position.dy).abs() < 240) {
        out.add(s);
      } else if (along == 0 &&
          (s.position.dy - focus.position.dy).abs() < 60 &&
          (s.position.dx - focus.position.dx).abs() < 180) {
        out.add(s);
      }
    }
    return out;
  }

  /// Manually set the focused slot (used by the shelf-face selector tapping
  /// a specific item in the panel).
  void setFocusedSlot(ShelfSlot? slot) {
    _focusedSlot = slot;
  }

  ShelfSlot? get focusedSlot => _focusedSlot;

  @override
  Future<void> onLoad() async {
    // Warm up procedural audio in the background — first play might miss
    // if the user triggers an action before init completes, but it's cheap.
    unawaited(GameAudio.instance.init());
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
    // Build both atlases in parallel, then wire up the first-person
    // renderer once they're ready.
    Future.wait([TextureAtlas.build(), SpriteAtlas.build()]).then((pair) {
      final textures = pair[0] as TextureAtlas;
      final sprites = pair[1] as SpriteAtlas;
      _fpv = FirstPersonRenderer(
        viewport: Size(size.x, size.y),
        atlas: textures,
        sprites: sprites,
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
      GameAudio.instance.parkClunk();
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
    // Contests extend the reach to give the NPC a fair chance of "winning"
    // if the player bails.
    final contest = _contestOpponent;
    if (contest != null) {
      player.reachTotal = 1.7;
      contestNotifier.value = true;
      GameAudio.instance.contestOpen();
      _npcSay(contest, kContestLines, duration: 2.0);
      _setBanner('Contested! Hold to grab it first.');
    } else {
      player.reachTotal = 0.9;
    }
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

    // Push visual polish values to the FPV renderer
    if (_fpv != null) {
      _fpv!.cartDisplayHeading = _cartDisplayHeading;
      _fpv!.cartPitchOffset = _cartPitch;
      _fpv!.currentSectionId =
          storeWorld.layout.sectionAtPoint(player.x, player.y);
    }

    // Announce newly-placed pallets once each
    for (final p in storeWorld.pallets) {
      if (_announcedPallets.add(p)) {
        final sec = sectionById(
            storeWorld.layout.sectionAtPoint(p.x, p.y));
        announcements.push(StoreAnnouncement(
          text: 'Caution: restocking in ${sec.name}.',
          tone: AnnouncementTone.warning,
        ));
      }
    }
    _announcedPallets.removeWhere((p) => p.consumed ||
        !storeWorld.pallets.contains(p));

    // Tick the announcement queue
    announcements.tick(dt);

    // Decay screen shake
    if (_shake > 0) {
      _shake = math.max(0, _shake - dt * 2.5);
      final m = _shake * 16;
      _shakeX = (_shakeRng.nextDouble() * 2 - 1) * m;
      _shakeY = (_shakeRng.nextDouble() * 2 - 1) * m;
    } else {
      _shakeX = 0;
      _shakeY = 0;
    }

    // Update the shopping-list compass hint
    _updateCompass();

    // Footstep audio on foot
    if (player.mode == PlayerMode.onFoot && bobSpeed > 60) {
      GameAudio.instance.footstep(
          intensity: (bobSpeed / _playerWalkSpeed).clamp(0.2, 1.0));
    }

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
    final changed = !identical(found, _focusedSlot);
    _focusedSlot = found;
    if (changed) {
      shelfFaceTickNotifier.value = shelfFaceTickNotifier.value + 1;
    }
    // Contest detection: any NPC whose occupyingSlot is our focused slot
    _contestOpponent = null;
    if (found != null) {
      for (final n in storeWorld.npcs) {
        if (n.consumed) continue;
        if (!identical(n.occupyingSlot, found)) continue;
        if (n.state != NpcState.browsing &&
            n.state != NpcState.reaching) {
          continue;
        }
        _contestOpponent = n;
        break;
      }
    }

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
      // Tank controls: X = turn rate, Y (inverted, up = forward) = accel
      // along current heading.
      final turn = joystick.dx;
      const turnRate = 2.6; // rad/s at full stick
      cart.heading += turn * turnRate * dt;
      player.facing = cart.heading;
      final forwardAmount = -joystick.dy; // stick up is forward

      // Brake detection: commanded direction vs current velocity
      final vSpeed = math.sqrt(cart.vx * cart.vx + cart.vy * cart.vy);
      final forwardUnitX = math.cos(cart.heading);
      final forwardUnitY = math.sin(cart.heading);
      final vDotForward = cart.vx * forwardUnitX + cart.vy * forwardUnitY;
      _isBraking = vSpeed > 20 && forwardAmount < -0.2 && vDotForward > 0;

      // Freezer aisle makes the floor slippery — less friction in all cases.
      final icy = storeWorld.layout.sectionAtPoint(cart.x, cart.y) == 'frozen';
      final frictionMult = icy ? _icyFrictionMult : 1.0;
      if (mag > 0.08) {
        final ax = forwardUnitX * forwardAmount * _cartAccel;
        final ay = forwardUnitY * forwardAmount * _cartAccel;
        cart.vx += ax * dt;
        cart.vy += ay * dt;
        if (_isBraking) {
          cart.vx -= cart.vx *
              math.min(1.0, _cartBrakeFriction * frictionMult * dt);
          cart.vy -= cart.vy *
              math.min(1.0, _cartBrakeFriction * frictionMult * dt);
        }
        GameAudio.instance.wheelSqueak(speed: vSpeed);
      } else {
        cart.vx -= cart.vx * math.min(1.0, _cartFriction * frictionMult * dt);
        cart.vy -= cart.vy * math.min(1.0, _cartFriction * frictionMult * dt);
        if (cart.vx.abs() < 1) cart.vx = 0;
        if (cart.vy.abs() < 1) cart.vy = 0;
      }

      // Visual polish: display heading lags a beat behind actual
      _cartDisplayHeading =
          _lerpAngle(_cartDisplayHeading, cart.heading, dt * 7);
      // Pitch: positive when accelerating forward, negative while braking
      final targetPitch =
          _isBraking ? -0.4 : (forwardAmount.clamp(-1.0, 1.0) * 0.25);
      _cartPitch += (targetPitch - _cartPitch) * math.min(1.0, dt * 8);
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
    var slid =
        storeWorld.layout.slide(cart.x, cart.y, nx, ny, _cartRadius);
    slid = storeWorld.slideAroundPallets(
        cart.x, cart.y, slid.dx, slid.dy, _cartRadius);
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
    var slid =
        storeWorld.layout.slide(player.x, player.y, nx, ny, _playerRadius);
    slid = storeWorld.slideAroundPallets(
        player.x, player.y, slid.dx, slid.dy, _playerRadius);
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
    // If we were in a contest and bailed, the NPC takes it: consume the
    // slot and make the NPC smug about it.
    if (contestNotifier.value) {
      final opp = _contestOpponent;
      final slot = _focusedSlot;
      if (opp != null && slot != null && !slot.empty) {
        slot.stock--;
        opp.occupyingSlot = null;
        opp.state = NpcState.crossing;
        opp.target = null;
        _npcSay(opp, const ['Thanks for the hesitation.', 'Told you.'],
            duration: 2.0);
        _setBanner('They grabbed the ${slot.item.name}.');
      }
      contestNotifier.value = false;
    }
    player.mode = cart.state == CartState.attached
        ? PlayerMode.pushing
        : PlayerMode.onFoot;
    player.reachTimer = 0;
    player.reachingForItem = null;
    player.reachTotal = 0.9;
    reachProgressNotifier.value = 0;
    _contestOpponent = null;
  }

  void _completeReach() {
    final slot = _focusedSlot;
    if (slot != null && !slot.empty && slot.item == player.reachingForItem) {
      slot.stock--;
      cart.addItem(slot.item);
      list.recount(cart);
      GameAudio.instance.pickupChime();
      // If this slot is the last of its kind and it was on the list,
      // announce the milestone. (Quiet moment of progress.)
      if (list.allComplete) {
        announcements.push(StoreAnnouncement(
          text: 'List complete. Please proceed to checkout.',
          tone: AnnouncementTone.sale,
        ));
      }
      // Won a contest — annoy the NPC and bounce them to a new target.
      if (contestNotifier.value) {
        final opp = _contestOpponent;
        if (opp != null) {
          opp.occupyingSlot = null;
          opp.state = NpcState.crossing;
          opp.target = null;
          _npcSay(opp, const ['Hmph.', 'Fine.', 'Unbelievable.'],
              duration: 1.8);
        }
      }
      if (list.allComplete) {
        _setBanner('List complete. Head to checkout.');
      }
    }
    // Clear contest flag explicitly so _cancelReach doesn't think we bailed.
    contestNotifier.value = false;
    _cancelReach();
  }

  void _updateCheckoutScan(double dt) {
    final before = player.checkoutTimer;
    player.checkoutTimer += dt;
    checkoutProgressNotifier.value =
        (player.checkoutTimer / Player.checkoutTotal).clamp(0.0, 1.0);
    // One scanner beep roughly every 0.4s during the scan.
    final beatsBefore = (before / 0.4).floor();
    final beatsNow = (player.checkoutTimer / 0.4).floor();
    if (beatsNow > beatsBefore) GameAudio.instance.scannerBeep();
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
      // Only trigger the real theft once — marker is `stolenItem == kItems.first`
      // (a placeholder set by the world when the thief first touches the cart).
      if (n.stateTimer > 0 &&
          cart.basket.isNotEmpty &&
          n.stolenItem == kItems.first &&
          _rng().nextDouble() < 0.9) {
        final idx = _rng().nextInt(cart.basket.length);
        final item = cart.basket.removeAt(idx);
        n.stolenItem = item;
        list.recount(cart);
        _itemsStolenByNpcs++;
        GameAudio.instance.thiefWarning();
        _npcSay(n, kThiefLines, duration: 2.4);
        announcements.push(StoreAnnouncement(
          text: 'They took your ${item.name}. Catch them to get it back!',
          tone: AnnouncementTone.warning,
        ));
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
    // Speed at the moment of impact — drives the tier decision.
    final impactSpeed = pushing
        ? math.sqrt(cart.vx * cart.vx + cart.vy * cart.vy)
        : math.sqrt(player.vx * player.vx + player.vy * player.vy);
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
        // ---------- Tiered impact ----------
        // light: < 90 px/s — nudge, dialogue, no stun
        // medium: 90..170 — NPC pushed harder, stun 0.6s, bigger shake
        // heavy: >170 — NPC fully knocked down 2.2s, screen shake, LOUD thud
        final int tier;
        if (impactSpeed > 170) {
          tier = 2;
        } else if (impactSpeed > 90) {
          tier = 1;
        } else {
          tier = 0;
        }
        final knockDist = switch (tier) { 0 => 8.0, 1 => 22.0, _ => 46.0 };
        n.x += nx * knockDist;
        n.y += ny * knockDist;
        if (n.state == NpcState.browsing ||
            n.state == NpcState.crossing) {
          n.state = NpcState.stunned;
          n.stateTimer = switch (tier) { 0 => 0.4, 1 => 1.0, _ => 2.2 };
        }
        // Screen shake scales with tier
        _shake = math.max(
          _shake,
          switch (tier) { 0 => 0.0, 1 => 0.18, _ => 0.45 },
        );
        final pool = tier == 2
            ? _painLinesByPersonality[n.personality] ??
                _painLinesByPersonality[NpcPersonality.browser]!
            : (kBumpLinesByPersonality[n.personality] ??
                kBumpLinesByPersonality[NpcPersonality.browser]!);
        _npcSay(n, pool, duration: tier == 2 ? 2.2 : 1.4);
        // Caught a fleeing thief with a stolen item — recover it.
        if (n.state == NpcState.fleeing && n.stolenItem != null) {
          final item = n.stolenItem!;
          cart.addItem(item);
          list.recount(cart);
          _itemsStolenByNpcs = math.max(0, _itemsStolenByNpcs - 1);
          n.stolenItem = null;
          n.consumed = true; // thief scurries off the map
          GameAudio.instance.pickupChime();
          announcements.push(StoreAnnouncement(
            text: 'Got your ${item.name} back.',
            tone: AnnouncementTone.sale,
          ));
          _setBanner('Recovered your ${item.name}!');
        }
        // Slow the player/cart + nudge-slide along the tangent so we don't
        // hard-stop on contact. Decomposes velocity into normal + tangent
        // components and cancels the normal into the NPC.
        if (pushing) {
          final vNorm = cart.vx * nx + cart.vy * ny;
          if (vNorm > 0) {
            cart.vx -= vNorm * nx * 0.7;
            cart.vy -= vNorm * ny * 0.7;
          }
          cart.vx *= 0.75;
          cart.vy *= 0.75;
          GameAudio.instance.thud(
              intensity: (math.sqrt(cart.vx * cart.vx + cart.vy * cart.vy) /
                      _cartMaxSpeed)
                  .clamp(0.3, 1.0));
        } else {
          final vNorm = player.vx * nx + player.vy * ny;
          if (vNorm > 0) {
            player.vx -= vNorm * nx * 0.7;
            player.vy -= vNorm * ny * 0.7;
          }
          player.vx *= 0.5;
          player.vy *= 0.5;
          GameAudio.instance.thud(intensity: 0.5);
        }
      }
    }
  }

  // ==================== rendering ====================
  @override
  void render(Canvas canvas) {
    super.render(canvas);
    if (!_worldReady) return;
    final applyShake = _shake > 0;
    if (applyShake) {
      canvas.save();
      canvas.translate(_shakeX, _shakeY);
    }
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
    if (applyShake) canvas.restore();
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

  /// Recompute the compass hint pointing at the nearest listed item, or
  /// the nearest checkout once the list is complete.
  void _updateCompass() {
    final ax = cart.state == CartState.attached ? cart.x : player.x;
    final ay = cart.state == CartState.attached ? cart.y : player.y;
    final facing = player.facing;
    if (list.allComplete) {
      // Point at the nearest checkout interact point.
      CheckoutLane? best;
      double bestD2 = double.infinity;
      for (final c in storeWorld.checkouts) {
        final dx = c.interactPoint.dx - ax;
        final dy = c.interactPoint.dy - ay;
        final d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = c;
        }
      }
      if (best == null) {
        compassNotifier.value = null;
        return;
      }
      final dx = best.interactPoint.dx - ax;
      final dy = best.interactPoint.dy - ay;
      final absAngle = math.atan2(dy, dx);
      final rel = _shortestAngle(absAngle - facing);
      compassNotifier.value = CompassHint(
        angle: rel,
        label: 'Checkout',
        distance: math.sqrt(bestD2),
      );
      return;
    }
    // Find the closest shelf slot holding any incomplete listed item.
    final neededIds = <String>{
      for (final e in list.entries)
        if (!e.complete) e.item.id,
    };
    if (neededIds.isEmpty) {
      compassNotifier.value = null;
      return;
    }
    ShelfSlot? best;
    double bestD2 = double.infinity;
    for (final s in storeWorld.shelfIndex.slots) {
      if (s.empty) continue;
      if (!neededIds.contains(s.item.id)) continue;
      final dx = s.position.dx - ax;
      final dy = s.position.dy - ay;
      final d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = s;
      }
    }
    if (best == null) {
      compassNotifier.value = null;
      return;
    }
    final dx = best.position.dx - ax;
    final dy = best.position.dy - ay;
    final absAngle = math.atan2(dy, dx);
    final rel = _shortestAngle(absAngle - facing);
    compassNotifier.value = CompassHint(
      angle: rel,
      label: best.item.name,
      distance: math.sqrt(bestD2),
    );
  }

  double _shortestAngle(double d) {
    var x = d % (2 * math.pi);
    if (x > math.pi) x -= 2 * math.pi;
    if (x < -math.pi) x += 2 * math.pi;
    return x;
  }

  /// Make an NPC speak a line from a dialogue pool. Plays a quiet blip as
  /// feedback. No-op if the NPC is consumed.
  void _npcSay(Npc n, List<String> pool, {double duration = 2.0}) {
    if (n.consumed) return;
    if (pool.isEmpty) return;
    n.dialogue = pool[_rng().nextInt(pool.length)];
    n.dialogueTimer = duration;
    GameAudio.instance.speechBlip();
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
    shelfFaceTickNotifier.dispose();
    contestNotifier.dispose();
    announcements.dispose();
    compassNotifier.dispose();
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

/// Compass chip content for the HUD. `angle` is in radians relative to the
/// player's facing (0 = straight ahead, negative = left, positive = right).
class CompassHint {
  const CompassHint({
    required this.angle,
    required this.label,
    required this.distance,
  });
  final double angle;
  final String label;
  final double distance;
}
