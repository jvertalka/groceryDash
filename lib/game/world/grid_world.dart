import 'dart:ui';

import 'store_layout.dart';

/// Kind of cell for the raycaster. Index-addressable so we can look up
/// texture + height in O(1). 0 is always empty floor.
enum CellKind {
  empty,
  wall,
  shelf,
  fridge,
  produceBin,
  counter,
}

extension CellKindX on CellKind {
  /// Wall heights in world units. Shorter cells (bins, counters) let you
  /// look over the top; the raycaster can render them as half-height walls.
  double get height {
    switch (this) {
      case CellKind.empty:
        return 0;
      case CellKind.wall:
        return 180;
      case CellKind.shelf:
      case CellKind.fridge:
        return 160;
      case CellKind.counter:
      case CellKind.produceBin:
        return 70;
    }
  }

  bool get solid => this != CellKind.empty;
}

/// Grid projection of the store layout. Used by the raycaster to test
/// ray-cell hits. Cell size is chosen to align neatly with existing
/// rectangle boundaries (40px thick walls, 80px shelf widths).
class GridWorld {
  GridWorld({
    required this.cellSize,
    required this.cols,
    required this.rows,
    required this.cells,
    required this.sectionIds,
  });

  final double cellSize;
  final int cols;
  final int rows;
  final List<CellKind> cells;    // length = cols * rows (row-major)
  final List<String?> sectionIds; // matching length; null for empty cells

  /// Build from a [StoreLayout]. Walks each solid rectangle and marks the
  /// cells it covers with the appropriate [CellKind].
  factory GridWorld.fromLayout(StoreLayout layout, {double cellSize = 40}) {
    final cols = (layout.size.width / cellSize).ceil();
    final rows = (layout.size.height / cellSize).ceil();
    final cells = List<CellKind>.filled(cols * rows, CellKind.empty);
    final sections = List<String?>.filled(cols * rows, null);

    for (final s in layout.solids) {
      final kind = _kindFor(s.kind);
      final r = s.rect;
      final x0 = (r.left / cellSize).floor().clamp(0, cols - 1);
      final x1 = ((r.right - 0.001) / cellSize).floor().clamp(0, cols - 1);
      final y0 = (r.top / cellSize).floor().clamp(0, rows - 1);
      final y1 = ((r.bottom - 0.001) / cellSize).floor().clamp(0, rows - 1);
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          final idx = y * cols + x;
          // Prefer taller obstacles when multiple overlap
          if (kind.height >= cells[idx].height) {
            cells[idx] = kind;
            sections[idx] = s.sectionId;
          }
        }
      }
    }
    return GridWorld(
      cellSize: cellSize,
      cols: cols,
      rows: rows,
      cells: cells,
      sectionIds: sections,
    );
  }

  static CellKind _kindFor(SolidKind k) {
    switch (k) {
      case SolidKind.wall:
        return CellKind.wall;
      case SolidKind.shelf:
        return CellKind.shelf;
      case SolidKind.fridge:
        return CellKind.fridge;
      case SolidKind.produceBin:
        return CellKind.produceBin;
      case SolidKind.counter:
        return CellKind.counter;
    }
  }

  CellKind cellAt(int col, int row) {
    if (col < 0 || col >= cols || row < 0 || row >= rows) {
      return CellKind.wall;
    }
    return cells[row * cols + col];
  }

  String? sectionAt(int col, int row) {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return sectionIds[row * cols + col];
  }

  /// Convert a world point to grid coords.
  (int, int) worldToCell(double wx, double wy) =>
      ((wx / cellSize).floor(), (wy / cellSize).floor());

  Size get worldSize => Size(cols * cellSize, rows * cellSize);
}
