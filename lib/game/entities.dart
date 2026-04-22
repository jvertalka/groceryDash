import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import 'data/items.dart';

/// Where the player currently is in the interaction loop. Drives which
/// input path moves which entity.
enum PlayerMode {
  pushing,   // pushing the cart; joystick steers cart
  onFoot,    // walking without a cart; joystick steers the person
  reaching,  // frozen at a shelf slot, reach animation running
  checkout,  // at the checkout, scan animation running
}

/// Where the cart is physically.
enum CartState {
  attached,  // moves with the player
  parked,    // abandoned in the aisle; stays where it was left
}

/// Player character — position, facing direction, interaction state.
/// Separate from the cart so the two can be at different world positions.
class Player {
  Player({required this.x, required this.y});
  double x;
  double y;
  double vx = 0;
  double vy = 0;
  double facing = math.pi / 2; // radians; 0 = east
  PlayerMode mode = PlayerMode.pushing;

  // Reach animation timer (0..reachTotal). Progresses while interacting.
  double reachTimer = 0;
  double reachTotal = 0.9;
  ItemDef? reachingForItem; // non-null while reaching

  // Checkout scan progress (0..1)
  double checkoutTimer = 0;
  static const double checkoutTotal = 2.5;

  bool get isReaching => mode == PlayerMode.reaching;
  bool get isAtCheckout => mode == PlayerMode.checkout;
  bool get canSteer =>
      mode == PlayerMode.pushing || mode == PlayerMode.onFoot;
}

/// Cart — position, velocity, basket contents. Has simple inertia when
/// pushed; remains put when parked.
class Cart {
  Cart({required this.x, required this.y});
  double x;
  double y;
  double vx = 0;
  double vy = 0;
  double heading = math.pi / 2; // radians
  CartState state = CartState.attached;

  final List<ItemDef> basket = [];

  /// Rising while unattended. When it crosses a threshold, the game may
  /// spawn a "thief" event where an NPC walks over and removes an item.
  double unattendedTimer = 0;

  void addItem(ItemDef it) {
    basket.add(it);
  }

  /// Remove N items of a given id. Returns the number actually removed.
  int removeItems(String itemId, int count) {
    var removed = 0;
    for (var i = basket.length - 1; i >= 0 && removed < count; i--) {
      if (basket[i].id == itemId) {
        basket.removeAt(i);
        removed++;
      }
    }
    return removed;
  }
}

/// Shopping list entry. `collected` is recomputed from the cart's contents
/// every time the cart changes.
class ShoppingListEntry {
  ShoppingListEntry({required this.item, required this.needed});
  final ItemDef item;
  final int needed;
  int collected = 0;
  bool get complete => collected >= needed;
}

/// Notifier-backed shopping list used by the HUD.
class ShoppingList extends ChangeNotifier {
  ShoppingList(this._entries);
  final List<ShoppingListEntry> _entries;

  List<ShoppingListEntry> get entries => List.unmodifiable(_entries);

  /// Full tally: how many unique items are complete.
  int get completeCount => _entries.where((e) => e.complete).length;
  int get totalCount => _entries.length;
  bool get allComplete => completeCount == totalCount;

  /// Recount against the cart's basket.
  void recount(Cart cart) {
    final counts = <String, int>{};
    for (final it in cart.basket) {
      counts[it.id] = (counts[it.id] ?? 0) + 1;
    }
    for (final e in _entries) {
      e.collected = counts[e.item.id] ?? 0;
    }
    notifyListeners();
  }
}
