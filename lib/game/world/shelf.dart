import 'dart:ui';

import '../data/items.dart';

/// A single discrete product position on a shelf face. Each slot holds one
/// item type and a stock count; picking from a slot removes one stock.
class ShelfSlot {
  ShelfSlot({
    required this.item,
    required this.position,
    required this.facing,
    this.stock = 5,
  });
  final ItemDef item;
  /// Pickup anchor point in world coordinates (in front of the shelf face).
  final Offset position;
  /// Which side of the shelf this slot is on: -1 = west face, 1 = east face,
  /// 0 = top (for bins/fridges with a single accessible face).
  final int facing;
  int stock;
  bool get empty => stock <= 0;
}

/// Computed on populate. A flat list of every slot in the store.
class ShelfIndex {
  ShelfIndex(this.slots);
  final List<ShelfSlot> slots;

  /// Closest slot to (x, y) within `within` pixels, or null.
  ShelfSlot? nearest(double x, double y, {double within = 46}) {
    ShelfSlot? best;
    double bestD2 = within * within;
    for (final s in slots) {
      if (s.empty) continue;
      final dx = s.position.dx - x;
      final dy = s.position.dy - y;
      final d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = s;
      }
    }
    return best;
  }
}
