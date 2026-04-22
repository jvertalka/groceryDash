import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../data/obstacles.dart';

/// Real-looking obstacle sprites — carts, shoppers, kids, spills, etc.
/// Callers provide the base position (anchor at the feet/bottom) and a rough
/// size. Each obstacle renders a themed illustration with shadow + outline
/// instead of a generic coloured square.
class ObstacleSprites {
  ObstacleSprites._();

  static void draw(
    Canvas canvas,
    ObstacleDef def,
    Offset base,
    double size, {
    double phase = 0,
  }) {
    // Shared ground shadow
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(base.dx, base.dy + 2),
        width: size * 0.85,
        height: size * 0.18,
      ),
      Paint()..color = Colors.black.withValues(alpha: 0.3),
    );

    switch (def.id) {
      case 'cart':
        _cart(canvas, base, size, phase);
      case 'shopper':
        _shopper(canvas, base, size, phase, skinColor: const Color(0xFFF4C9A3),
            shirtColor: const Color(0xFF8E7CC3));
      case 'kid':
        _shopper(canvas, base, size * 0.75, phase,
            skinColor: const Color(0xFFF4C9A3),
            shirtColor: const Color(0xFFE05B3F),
            isKid: true);
      case 'stocker':
        _shopper(canvas, base, size, phase,
            skinColor: const Color(0xFFE0A678),
            shirtColor: const Color(0xFFE0A638),
            hasApron: true);
      case 'mop':
        _mopBucket(canvas, base, size);
      case 'spill':
        _spill(canvas, def, base, size);
      case 'grapes':
        _spill(canvas, def, base, size,
            blobColor: const Color(0xFF7B2E8A));
      case 'watermelon':
        _watermelonBin(canvas, base, size);
      case 'beans':
      case 'display':
        _cannedPyramid(canvas, def, base, size);
      default:
        _fallback(canvas, def, base, size);
    }
  }

  // -------- rogue cart --------
  static void _cart(Canvas canvas, Offset base, double size, double phase) {
    canvas.save();
    // Small tilt for "out of control" feel
    canvas.translate(base.dx, base.dy - size * 0.35);
    canvas.rotate(math.sin(phase * 3) * 0.1);

    final bodyW = size * 0.9;
    final bodyH = size * 0.55;
    final body = Rect.fromCenter(
      center: Offset.zero,
      width: bodyW,
      height: bodyH,
    );
    // Body — grey cart
    final rrect = RRect.fromRectAndRadius(body, Radius.circular(size * 0.1));
    canvas.drawRRect(
      rrect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFD9D9E0), Color(0xFF8C8C95)],
        ).createShader(body),
    );
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    // Wire mesh
    final mesh = Paint()
      ..color = Colors.black.withValues(alpha: 0.3)
      ..strokeWidth = 1.2;
    for (var i = 1; i < 5; i++) {
      final t = i / 5.0;
      canvas.drawLine(
        Offset(body.left + bodyW * t, body.top + 4),
        Offset(body.left + bodyW * t, body.bottom - 4),
        mesh,
      );
    }
    // Handle
    canvas.drawLine(
      Offset(body.right - 4, body.top - 2),
      Offset(body.right + size * 0.18, body.top - size * 0.25),
      Paint()
        ..color = const Color(0xFFB8BEC6)
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round,
    );
    // Wheels
    canvas.drawCircle(Offset(-bodyW * 0.35, bodyH / 2 + 4), size * 0.12,
        Paint()..color = const Color(0xFF1E1E26));
    canvas.drawCircle(Offset(bodyW * 0.35, bodyH / 2 + 4), size * 0.12,
        Paint()..color = const Color(0xFF1E1E26));
    canvas.restore();
  }

  // -------- shopper / stocker / kid NPC --------
  static void _shopper(
    Canvas canvas,
    Offset base,
    double size,
    double phase, {
    required Color skinColor,
    required Color shirtColor,
    bool hasApron = false,
    bool isKid = false,
  }) {
    final centerX = base.dx;
    final feetY = base.dy;
    final bodyH = size * 0.95;

    // Walking bob
    final bob = math.sin(phase * 6) * 2;
    final footSwing = math.sin(phase * 6);

    // Feet
    final shoePaint = Paint()..color = const Color(0xFF2A2A3A);
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(centerX - size * 0.13 + footSwing * 4, feetY),
          width: size * 0.18,
          height: size * 0.09),
      shoePaint,
    );
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(centerX + size * 0.13 - footSwing * 4, feetY),
          width: size * 0.18,
          height: size * 0.09),
      shoePaint,
    );

    // Legs (pants)
    final pantsPaint = Paint()..color = const Color(0xFF3D4A66);
    canvas.drawRect(
      Rect.fromCenter(
        center: Offset(centerX - size * 0.1, feetY - size * 0.2 + bob * 0.3),
        width: size * 0.12,
        height: size * 0.3,
      ),
      pantsPaint,
    );
    canvas.drawRect(
      Rect.fromCenter(
        center: Offset(centerX + size * 0.1, feetY - size * 0.2 + bob * 0.3),
        width: size * 0.12,
        height: size * 0.3,
      ),
      pantsPaint,
    );

    // Torso
    final torsoTop = feetY - bodyH + bob;
    final torsoRect = Rect.fromCenter(
      center: Offset(centerX, feetY - size * 0.5 + bob * 0.3),
      width: size * 0.45,
      height: size * 0.42,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(torsoRect, Radius.circular(size * 0.06)),
      Paint()..color = shirtColor,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(torsoRect, Radius.circular(size * 0.06)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6,
    );

    // Apron (for stocker)
    if (hasApron) {
      canvas.drawRect(
        Rect.fromCenter(
          center: Offset(centerX, torsoRect.bottom - size * 0.09),
          width: size * 0.38,
          height: size * 0.22,
        ),
        Paint()..color = const Color(0xFFDFDFDF),
      );
    }

    // Arms
    final armPaint = Paint()..color = skinColor;
    canvas.drawRRect(
      RRect.fromRectAndCorners(
        Rect.fromLTWH(
            torsoRect.left - size * 0.08, torsoRect.top + size * 0.04,
            size * 0.08, size * 0.3),
        topLeft: Radius.circular(size * 0.04),
        topRight: Radius.circular(size * 0.04),
      ),
      armPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndCorners(
        Rect.fromLTWH(
            torsoRect.right, torsoRect.top + size * 0.04,
            size * 0.08, size * 0.3),
        topLeft: Radius.circular(size * 0.04),
        topRight: Radius.circular(size * 0.04),
      ),
      armPaint,
    );

    // Head
    final headRadius = isKid ? size * 0.18 : size * 0.16;
    final headCenter = Offset(centerX, torsoTop + headRadius);
    canvas.drawCircle(headCenter, headRadius, Paint()..color = skinColor);
    canvas.drawCircle(
      headCenter,
      headRadius,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    // Hair cap
    final hairPath = Path()
      ..addArc(
        Rect.fromCircle(center: headCenter, radius: headRadius),
        math.pi * 1.1,
        math.pi * 0.8,
      );
    canvas.drawPath(
      hairPath,
      Paint()
        ..color = isKid
            ? const Color(0xFFE5A145)
            : const Color(0xFF3A2916)
        ..style = PaintingStyle.stroke
        ..strokeWidth = headRadius * 0.7
        ..strokeCap = StrokeCap.round,
    );
    // Eyes
    final eyePaint = Paint()..color = Colors.black;
    canvas.drawCircle(
        headCenter.translate(-headRadius * 0.3, -headRadius * 0.1),
        headRadius * 0.08,
        eyePaint);
    canvas.drawCircle(
        headCenter.translate(headRadius * 0.3, -headRadius * 0.1),
        headRadius * 0.08,
        eyePaint);
  }

  // -------- wet-floor spill --------
  static void _spill(Canvas canvas, ObstacleDef def, Offset base, double size,
      {Color? blobColor}) {
    // Puddle blob
    final blob = Path();
    const pts = 10;
    for (var i = 0; i <= pts; i++) {
      final angle = i / pts * 2 * math.pi;
      final r = size * 0.42 *
          (1 + math.sin(angle * 3 + base.dx * 0.01) * 0.12);
      final x = base.dx + math.cos(angle) * r;
      final y = base.dy - size * 0.08 + math.sin(angle) * r * 0.45;
      if (i == 0) {
        blob.moveTo(x, y);
      } else {
        blob.lineTo(x, y);
      }
    }
    blob.close();
    canvas.drawPath(
      blob,
      Paint()..color = (blobColor ?? const Color(0xFF7EC8E3))
          .withValues(alpha: 0.85),
    );
    canvas.drawPath(
      blob,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    // Highlight
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(base.dx - size * 0.12, base.dy - size * 0.16),
        width: size * 0.3,
        height: size * 0.06,
      ),
      Paint()..color = Colors.white.withValues(alpha: 0.5),
    );

    // Yellow caution A-frame sign
    _cautionSign(canvas, Offset(base.dx + size * 0.28, base.dy - size * 0.45),
        size * 0.45);
  }

  static void _cautionSign(Canvas canvas, Offset center, double size) {
    final path = Path()
      ..moveTo(center.dx, center.dy - size * 0.6)
      ..lineTo(center.dx - size * 0.45, center.dy + size * 0.1)
      ..lineTo(center.dx + size * 0.45, center.dy + size * 0.1)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFFFD166));
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy - size * 0.3),
      Offset(center.dx, center.dy - size * 0.1),
      Paint()
        ..color = Colors.black
        ..strokeWidth = 3,
    );
    canvas.drawCircle(
      Offset(center.dx, center.dy + size * 0.02),
      size * 0.05,
      Paint()..color = Colors.black,
    );
  }

  // -------- mop bucket --------
  static void _mopBucket(Canvas canvas, Offset base, double size) {
    final bucketW = size * 0.7;
    final bucketH = size * 0.55;
    final rect = Rect.fromLTWH(base.dx - bucketW / 2, base.dy - bucketH,
        bucketW, bucketH);
    // Bucket body — yellow with a dark rim
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(size * 0.06)),
      Paint()..color = const Color(0xFFEEC24A),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(size * 0.06)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    // Water
    canvas.drawRect(
      Rect.fromLTWH(rect.left + 4, rect.top + 4, rect.width - 8, rect.height * 0.2),
      Paint()..color = const Color(0xFF7EC8E3),
    );
    // Mop stick
    canvas.drawLine(
      Offset(rect.right - 6, rect.top - 2),
      Offset(rect.right + size * 0.08, rect.top - size * 0.6),
      Paint()
        ..color = const Color(0xFF8C5A2B)
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round,
    );
    // Mop head
    canvas.drawCircle(
      Offset(rect.right + size * 0.08, rect.top - size * 0.6),
      size * 0.12,
      Paint()..color = const Color(0xFFE0D8B0),
    );
  }

  // -------- watermelon bin --------
  static void _watermelonBin(Canvas canvas, Offset base, double size) {
    final binW = size * 1.05;
    final binH = size * 0.55;
    final rect = Rect.fromLTWH(base.dx - binW / 2, base.dy - binH, binW, binH);
    // Wooden bin
    canvas.drawRect(rect, Paint()..color = const Color(0xFFC68642));
    canvas.drawRect(
      rect,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    // Planks
    for (var i = 1; i < 3; i++) {
      final y = rect.top + rect.height * i / 3;
      canvas.drawLine(
        Offset(rect.left, y),
        Offset(rect.right, y),
        Paint()
          ..color = Colors.black.withValues(alpha: 0.3)
          ..strokeWidth = 1,
      );
    }
    // Watermelons piled on top
    for (var i = 0; i < 3; i++) {
      final cx = rect.left + 18 + i * (rect.width - 36) / 2;
      final cy = rect.top - size * 0.08;
      canvas.drawCircle(Offset(cx, cy), size * 0.18,
          Paint()..color = const Color(0xFF4CAF50));
      canvas.drawCircle(Offset(cx, cy), size * 0.18,
          Paint()
            ..color = const Color(0xFF2E7D32)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5);
      // Stripe
      canvas.drawLine(
        Offset(cx - size * 0.12, cy),
        Offset(cx + size * 0.12, cy),
        Paint()
          ..color = const Color(0xFF2E7D32)
          ..strokeWidth = 2,
      );
    }
  }

  // -------- canned pyramid / display --------
  static void _cannedPyramid(
      Canvas canvas, ObstacleDef def, Offset base, double size) {
    final canR = size * 0.15;
    final rows = 3;
    for (var row = 0; row < rows; row++) {
      final cansInRow = rows - row;
      for (var i = 0; i < cansInRow; i++) {
        final cx = base.dx + (i - (cansInRow - 1) / 2) * canR * 2.1;
        final cy = base.dy - canR - row * canR * 1.8;
        final rect = Rect.fromCenter(
          center: Offset(cx, cy),
          width: canR * 1.9,
          height: canR * 2.3,
        );
        canvas.drawRRect(
          RRect.fromRectAndRadius(rect, Radius.circular(canR * 0.3)),
          Paint()..color = def.color,
        );
        canvas.drawRRect(
          RRect.fromRectAndRadius(rect, Radius.circular(canR * 0.3)),
          Paint()
            ..color = Colors.black.withValues(alpha: 0.5)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2,
        );
        // Top rim
        canvas.drawOval(
          Rect.fromCenter(center: Offset(cx, rect.top), width: canR * 1.9,
              height: canR * 0.6),
          Paint()..color = Colors.white.withValues(alpha: 0.7),
        );
      }
    }
  }

  static void _fallback(
      Canvas canvas, ObstacleDef def, Offset base, double size) {
    final rect = Rect.fromCenter(
      center: Offset(base.dx, base.dy - size * 0.4),
      width: size * 0.85,
      height: size * 0.85,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(size * 0.1)),
      Paint()..color = def.color,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(size * 0.1)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }
}
