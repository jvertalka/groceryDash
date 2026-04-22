import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../data/sections.dart';

/// A rectangular obstacle that can't be walked through. Used for shelves,
/// walls, checkout counters, and produce bins.
class SolidRect {
  const SolidRect({
    required this.rect,
    required this.sectionId,
    this.kind = SolidKind.shelf,
  });

  final Rect rect;
  final String sectionId;
  final SolidKind kind;

  ShelfStyle get shelfStyle => sectionById(sectionId).shelfStyle;
  Color get accent => sectionById(sectionId).accentColor;
  Color get wallColor => sectionById(sectionId).wallColor;
}

enum SolidKind {
  shelf,      // long tall shelving unit — has items on its long edges
  wall,       // perimeter wall (thicker)
  produceBin, // short wooden crate — items on top
  counter,    // checkout counter — blocks but no items
  fridge,     // tall cold unit — items on front
}

/// Where an item sits on a shelf. "N" means the item hangs off the north
/// edge of the shelf (cart approaches from above), etc.
enum ShelfSide { north, south, east, west, top }

/// Aggregated geometry for the store. Built once at level start. All
/// subsequent queries (collision, section lookup, shelf-edge iteration) go
/// through this object.
class StoreLayout {
  StoreLayout({required this.size, required this.solids});

  final Size size;
  final List<SolidRect> solids;

  /// Returns a solid rectangle that blocks a circle of `radius` centred at
  /// (x,y), or null if the space is free.
  SolidRect? blockingAt(double x, double y, double radius) {
    for (final s in solids) {
      if (_circleRectOverlap(x, y, radius, s.rect)) return s;
    }
    return null;
  }

  bool isInside(double x, double y, double radius) {
    return x - radius >= 0 &&
        y - radius >= 0 &&
        x + radius <= size.width &&
        y + radius <= size.height &&
        blockingAt(x, y, radius) == null;
  }

  static bool _circleRectOverlap(
      double cx, double cy, double r, Rect rect) {
    final closestX = cx.clamp(rect.left, rect.right);
    final closestY = cy.clamp(rect.top, rect.bottom);
    final dx = cx - closestX;
    final dy = cy - closestY;
    return dx * dx + dy * dy < r * r;
  }

  /// Returns a section id for a world point based on which zone the point
  /// lies in. Uses SectionZones (below).
  String sectionAtPoint(double x, double y) {
    for (final z in zones) {
      if (z.rect.contains(Offset(x, y))) return z.sectionId;
    }
    return kSections.first.id;
  }

  late final List<SectionZone> zones;

  /// Build a layout representing a real-store-like floor plan.
  ///
  /// Plan (all units in pixels):
  ///   • total store 2400w × 1600h
  ///   • outer walls 40px thick
  ///   • 5 parallel shelf aisles in the middle running N-S
  ///     (x=280..1800, aisles centred at x=360,640,920,1200,1480,1760)
  ///     each aisle 80w × 1000h
  ///   • top strip (y=40..200): produce bins spaced along the north wall
  ///   • right strip (x=1920..2360): frozen + dairy wall fridges
  ///   • bottom strip (y=1400..1560): checkout counters
  ///   • entrance on south wall (clear gap around x=1200..1400)
  factory StoreLayout.standard() {
    const double w = 2400;
    const double h = 1600;
    const wall = 40.0;
    const aisleHalfW = 40.0;      // shelf width = 80
    final solids = <SolidRect>[];
    final zones = <SectionZone>[];

    // Perimeter walls (N, S, E, W)
    solids.addAll([
      SolidRect(
          rect: const Rect.fromLTWH(0, 0, w, wall),
          sectionId: 'household',
          kind: SolidKind.wall),
      SolidRect(
          rect: const Rect.fromLTWH(0, h - wall, 600, wall),
          sectionId: 'household',
          kind: SolidKind.wall),
      SolidRect(
          rect: const Rect.fromLTWH(1000, h - wall, w - 1000, wall),
          sectionId: 'household',
          kind: SolidKind.wall),
      SolidRect(
          rect: const Rect.fromLTWH(0, 0, wall, h),
          sectionId: 'household',
          kind: SolidKind.wall),
      SolidRect(
          rect: const Rect.fromLTWH(w - wall, 0, wall, h),
          sectionId: 'household',
          kind: SolidKind.wall),
    ]);

    // --- Produce (top-left quadrant bins + top wall area) ---
    // Wooden crates spaced along the north, below the wall.
    const produceY = 120.0;
    for (var i = 0; i < 4; i++) {
      final cx = 200 + i * 180.0;
      solids.add(SolidRect(
        rect: Rect.fromCenter(
            center: Offset(cx, produceY), width: 120, height: 80),
        sectionId: 'produce',
        kind: SolidKind.produceBin,
      ));
    }
    zones.add(SectionZone(
      rect: const Rect.fromLTWH(0, 0, 900, 240),
      sectionId: 'produce',
    ));

    // --- Bakery (top-right produce-like bins) ---
    for (var i = 0; i < 3; i++) {
      final cx = 1000 + i * 180.0;
      solids.add(SolidRect(
        rect: Rect.fromCenter(
            center: Offset(cx, produceY), width: 120, height: 80),
        sectionId: 'bakery',
        kind: SolidKind.produceBin,
      ));
    }
    zones.add(SectionZone(
      rect: const Rect.fromLTWH(900, 0, 700, 240),
      sectionId: 'bakery',
    ));

    // --- Deli (top-right) ---
    zones.add(SectionZone(
      rect: const Rect.fromLTWH(1600, 0, w - 1600, 240),
      sectionId: 'deli',
    ));
    // Deli counter shelf
    solids.add(SolidRect(
      rect: const Rect.fromLTWH(1700, 120, 500, 80),
      sectionId: 'deli',
      kind: SolidKind.counter,
    ));

    // --- 5 centre aisles (snacks, household) ---
    final aisleSections = ['snacks', 'household', 'snacks', 'household', 'snacks'];
    const aisleY = 360.0;
    const aisleH = 880.0;
    for (var i = 0; i < 5; i++) {
      final cx = 360 + i * 360.0;
      solids.add(SolidRect(
        rect: Rect.fromCenter(
          center: Offset(cx, aisleY + aisleH / 2),
          width: aisleHalfW * 2,
          height: aisleH,
        ),
        sectionId: aisleSections[i],
        kind: SolidKind.shelf,
      ));
      zones.add(SectionZone(
        rect: Rect.fromLTWH(cx - 180, 240, 360, aisleH + 40),
        sectionId: aisleSections[i],
      ));
    }

    // --- Dairy + Frozen (right wall, vertical fridges) ---
    zones.add(SectionZone(
      rect: const Rect.fromLTWH(1920, 240, w - 1920, 900),
      sectionId: 'dairy',
    ));
    zones.add(SectionZone(
      rect: const Rect.fromLTWH(1920, 1140, w - 1920, 400),
      sectionId: 'frozen',
    ));
    // Fridge blocks (two stacked)
    solids.add(SolidRect(
      rect: const Rect.fromLTWH(2060, 280, 260, 400),
      sectionId: 'dairy',
      kind: SolidKind.fridge,
    ));
    solids.add(SolidRect(
      rect: const Rect.fromLTWH(2060, 720, 260, 400),
      sectionId: 'frozen',
      kind: SolidKind.fridge,
    ));

    // --- Checkout counters (bottom) ---
    for (var i = 0; i < 3; i++) {
      final cx = 240 + i * 240.0;
      solids.add(SolidRect(
        rect: Rect.fromCenter(
            center: Offset(cx, 1340), width: 180, height: 50),
        sectionId: 'household',
        kind: SolidKind.counter,
      ));
    }
    zones.add(SectionZone(
      rect: const Rect.fromLTWH(0, 1280, 900, 320),
      sectionId: 'household',
    ));

    return StoreLayout(size: const Size(w, h), solids: solids)..zones = zones;
  }

  /// Walkable spawn point for the cart — centre of the store entrance.
  Offset get spawnPoint => Offset(size.width / 2 + 60, size.height - 100);

  /// A convenience Rect describing the southern entrance opening.
  static const Rect entranceRect = Rect.fromLTWH(600, 1540, 400, 60);

  /// Collides a circle against the layout. Returns a new position that slides
  /// the circle around obstacles rather than clipping through them. Uses
  /// independent axis-sweep: tries X then Y. Good enough for mostly axis-
  /// aligned shelves.
  Offset slide(double fromX, double fromY, double toX, double toY, double radius) {
    var x = fromX;
    var y = fromY;
    final tryX = toX;
    final tryY = toY;
    // Try X-axis move first
    if (blockingAt(tryX, y, radius) == null &&
        tryX - radius >= 0 &&
        tryX + radius <= size.width) {
      x = tryX;
    }
    // Then Y-axis move
    if (blockingAt(x, tryY, radius) == null &&
        tryY - radius >= 0 &&
        tryY + radius <= size.height) {
      y = tryY;
    }
    return Offset(x, y);
  }

  /// Find a random walkable point near a target, for NPC spawn/wander picks.
  Offset randomWalkablePoint(math.Random rng, {double radius = 18}) {
    for (var attempt = 0; attempt < 40; attempt++) {
      final x = rng.nextDouble() * size.width;
      final y = rng.nextDouble() * size.height;
      if (isInside(x, y, radius)) return Offset(x, y);
    }
    return spawnPoint;
  }
}

/// Visible theming zone. Used by the renderer to tint the floor and by the
/// world to bias item/obstacle choices. Ranges overlap with aisles but the
/// shelf itself is solid; only the nearby floor is "in section X".
class SectionZone {
  const SectionZone({required this.rect, required this.sectionId});
  final Rect rect;
  final String sectionId;
}
