import 'package:flutter/material.dart';

/// Shared `Paint` objects. Creating Paints inside `render()` each frame adds
/// measurable GC pressure at 60fps × N sprites; the ones here are universal
/// and never mutated after construction.
class GamePaints {
  GamePaints._();

  // --- Strokes ---
  static final Paint strokeSoft = Paint()
    ..color = Colors.black.withValues(alpha: 0.22)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2;

  static final Paint strokeMed = Paint()
    ..color = Colors.black.withValues(alpha: 0.35)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2;

  static final Paint strokeLight = Paint()
    ..color = Colors.white.withValues(alpha: 0.9)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2;

  // --- Cart foreground ---
  static final Paint cartHandleMetal = Paint()..color = const Color(0xFFBFC4CB);
  static final Paint cartHandleGrip = Paint()..color = const Color(0xFFE05B3F);
  static final Paint cartBasketMesh = Paint()
    ..color = const Color(0x33FFFFFF)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1.5;

  // --- Aisle ---
  static final Paint floorFill = Paint()..color = const Color(0xFFE6D9BA);
  static final Paint floorFillDark = Paint()..color = const Color(0xFFC9BC9C);
  static final Paint floorLine = Paint()
    ..color = const Color(0xFFB4A78A)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1.5;

  static final Paint ceilingFill = Paint()..color = const Color(0xFFF5EFDE);
  static final Paint ceilingLight = Paint()..color = const Color(0xFFFFF9E8);

  static final Paint shelfWall = Paint()..color = const Color(0xFFCFC4A8);
  static final Paint shelfWallDark = Paint()..color = const Color(0xFFA89B7B);
  static final Paint shelfPlank = Paint()..color = const Color(0xFF6E5A3C);
  static final Paint shelfPlankHi = Paint()..color = const Color(0xFF8F7752);

  // --- Effects ---
  static final Paint shadow = Paint()
    ..color = Colors.black.withValues(alpha: 0.18)
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2);

  static final Paint shieldHalo = Paint()
    ..color = const Color(0xCC66D9FF)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 3;

  static final Paint turboStreak = Paint()..color = const Color(0xFFFFD166);

  static final Paint sparkle = Paint()..color = const Color(0xFFFFEEB8);
}
