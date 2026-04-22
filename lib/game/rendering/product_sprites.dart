import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../data/items.dart';
import 'emoji_cache.dart';

/// Paints grocery items as recognisable product silhouettes: bottles, cans,
/// boxes, bags, cartons, produce, etc. Each shape gets a consistent layout:
///   - coloured body drawn in the item's palette
///   - thick dark outline
///   - white label band containing a small emoji (the "brand")
///   - highlight sheen for depth
///
/// All sprites are sized to fit within a given `height` at the given screen
/// centre. The renderer draws upward from that baseline y.
class ProductSprites {
  ProductSprites._();

  static void draw(
    Canvas canvas,
    ItemDef def,
    Offset baseline,
    double height, {
    double opacity = 1.0,
  }) {
    switch (def.shape) {
      case ItemShape.bottle:
        _bottle(canvas, def, baseline, height, opacity);
      case ItemShape.carton:
        _carton(canvas, def, baseline, height, opacity);
      case ItemShape.can:
        _can(canvas, def, baseline, height, opacity);
      case ItemShape.box:
        _box(canvas, def, baseline, height, opacity);
      case ItemShape.bag:
        _bag(canvas, def, baseline, height, opacity);
      case ItemShape.tray:
        _tray(canvas, def, baseline, height, opacity);
      case ItemShape.produce:
        _produce(canvas, def, baseline, height, opacity);
      case ItemShape.round:
        _round(canvas, def, baseline, height, opacity);
      case ItemShape.bouquet:
        _bouquet(canvas, def, baseline, height, opacity);
      case ItemShape.wedge:
        _wedge(canvas, def, baseline, height, opacity);
    }
  }

  // ----- shared painters -----
  static Paint _fill(Color c, double opacity) =>
      Paint()..color = c.withValues(alpha: c.a * opacity);

  /// Vertical gradient fill — lighter at top, darker at bottom — giving
  /// each product a subtle 3D volume.
  static Paint _gradFill(Rect rect, Color c, double opacity) => Paint()
    ..shader = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color.lerp(c, Colors.white, 0.22)!.withValues(alpha: opacity),
        c.withValues(alpha: opacity),
        Color.lerp(c, Colors.black, 0.28)!.withValues(alpha: opacity),
      ],
    ).createShader(rect);

  static Paint _outline(double opacity) => Paint()
    ..color = Colors.black.withValues(alpha: 0.7 * opacity)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2
    ..strokeJoin = StrokeJoin.round;

  static Paint _highlight(double opacity) => Paint()
    ..color = Colors.white.withValues(alpha: 0.32 * opacity);

  /// Small ellipse shadow drawn under the product to ground it on a shelf.
  static void _groundShadow(
      Canvas canvas, Offset base, double width, double opacity) {
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(base.dx, base.dy + 2), width: width, height: 6),
      Paint()..color = Colors.black.withValues(alpha: 0.32 * opacity),
    );
  }

  /// Narrow bright streak on the left edge of a body rect — reads as a
  /// light rim from above/left.
  static void _rimLight(Canvas canvas, Rect rect, double opacity) {
    canvas.drawRect(
      Rect.fromLTWH(rect.left + 2, rect.top + 3, 2.5, rect.height - 6),
      Paint()..color = Colors.white.withValues(alpha: 0.35 * opacity),
    );
  }

  /// Standard label strip with the item emoji. Used on most shapes.
  static void _label(
    Canvas canvas,
    ItemDef def,
    Rect rect, {
    double opacity = 1.0,
    Color bg = Colors.white,
  }) {
    final r = RRect.fromRectAndRadius(rect, Radius.circular(rect.height * 0.2));
    canvas.drawRRect(r, Paint()..color = bg.withValues(alpha: opacity));
    canvas.drawRRect(r, _outline(opacity));
    // Emoji sized to the label height
    final fontSize = rect.height * 0.85;
    if (fontSize < 6) return;
    final p = EmojiCache.instance.get(def.emoji, fontSize);
    final w = EmojiCache.instance.widthOf(def.emoji, fontSize);
    canvas.save();
    canvas.translate(rect.center.dx, rect.center.dy);
    // Clip emoji glyph alpha via colour filter? Not trivial; just draw.
    canvas.drawParagraph(
      p,
      Offset(-w / 2, -fontSize * 0.6),
    );
    canvas.restore();
  }

  // ----- shape implementations -----
  static void _bottle(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    _groundShadow(canvas, base, h * 0.5, op);
    final bodyW = h * 0.45;
    final bodyH = h * 0.75;
    final neckW = h * 0.18;
    final neckH = h * 0.14;
    final capH = h * 0.08;

    final bodyRect = Rect.fromCenter(
        center: Offset(base.dx, base.dy - bodyH / 2),
        width: bodyW,
        height: bodyH);
    final neckRect = Rect.fromCenter(
        center: Offset(base.dx, base.dy - bodyH - neckH / 2),
        width: neckW,
        height: neckH);
    final capRect = Rect.fromCenter(
        center: Offset(base.dx, base.dy - bodyH - neckH - capH / 2),
        width: neckW * 1.1,
        height: capH);

    // body
    canvas.drawRRect(
      RRect.fromRectAndRadius(bodyRect, Radius.circular(h * 0.08)),
      _gradFill(bodyRect, def.color, op),
    );
    _rimLight(canvas, bodyRect, op);
    // neck
    canvas.drawRect(neckRect, _gradFill(neckRect, def.color, op));
    // cap
    canvas.drawRRect(
      RRect.fromRectAndRadius(capRect, Radius.circular(h * 0.02)),
      _fill(Colors.black.withValues(alpha: 0.75), op),
    );
    // outline overall silhouette
    final silhouettePath = Path()
      ..addRRect(RRect.fromRectAndRadius(bodyRect, Radius.circular(h * 0.08)))
      ..addRect(neckRect)
      ..addRRect(RRect.fromRectAndRadius(capRect, Radius.circular(h * 0.02)));
    canvas.drawPath(silhouettePath, _outline(op));

    // highlight sheen
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(bodyRect.left + 3, bodyRect.top + 4, bodyW * 0.2, bodyH * 0.7),
        Radius.circular(h * 0.04),
      ),
      _highlight(op),
    );

    // label band ~middle
    final labelRect = Rect.fromCenter(
      center: Offset(base.dx, base.dy - bodyH * 0.5),
      width: bodyW * 0.92,
      height: bodyH * 0.42,
    );
    _label(canvas, def, labelRect, opacity: op);
  }

  static void _carton(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    _groundShadow(canvas, base, h * 0.6, op);
    final w = h * 0.55;
    final bodyH = h * 0.78;
    final body = Rect.fromLTWH(base.dx - w / 2, base.dy - bodyH, w, bodyH);
    canvas.drawRect(body, _gradFill(body, def.color, op));
    _rimLight(canvas, body, op);
    // Slanted top (carton fold)
    final topY = body.top;
    final foldY = topY - h * 0.18;
    final topPath = Path()
      ..moveTo(body.left, topY)
      ..lineTo(base.dx, foldY)
      ..lineTo(body.right, topY)
      ..close();
    canvas.drawPath(topPath, _fill(def.color, op));
    // Outline
    final outlinePath = Path()
      ..addRect(body)
      ..addPath(topPath, Offset.zero);
    canvas.drawPath(outlinePath, _outline(op));
    // Side crease
    canvas.drawLine(
      Offset(base.dx, foldY),
      Offset(base.dx, body.top),
      _outline(op)..strokeWidth = 1.5,
    );
    // Label
    final labelRect = Rect.fromCenter(
      center: Offset(base.dx, body.center.dy),
      width: w * 0.9,
      height: bodyH * 0.5,
    );
    _label(canvas, def, labelRect, opacity: op);
  }

  static void _can(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    _groundShadow(canvas, base, h * 0.55, op);
    final w = h * 0.52;
    final bodyH = h * 0.72;
    final body = Rect.fromLTWH(base.dx - w / 2, base.dy - bodyH, w, bodyH);
    // Side rim
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, Radius.circular(h * 0.06)),
      _gradFill(body, def.color, op),
    );
    _rimLight(canvas, body, op);
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, Radius.circular(h * 0.06)),
      _outline(op),
    );
    // Top ring
    final topRing = Rect.fromCenter(
      center: Offset(base.dx, body.top),
      width: w,
      height: h * 0.13,
    );
    canvas.drawOval(topRing, _fill(Colors.white.withValues(alpha: 0.75), op));
    canvas.drawOval(topRing, _outline(op));
    // Centre label
    final labelRect = Rect.fromCenter(
      center: Offset(base.dx, body.center.dy + 2),
      width: w * 0.95,
      height: bodyH * 0.5,
    );
    _label(canvas, def, labelRect, opacity: op);
  }

  static void _box(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    _groundShadow(canvas, base, h * 0.75, op);
    final w = h * 0.72;
    final bodyH = h * 0.82;
    final body = Rect.fromLTWH(base.dx - w / 2, base.dy - bodyH, w, bodyH);
    canvas.drawRect(body, _gradFill(body, def.color, op));
    _rimLight(canvas, body, op);
    // top flap (darker)
    canvas.drawRect(
      Rect.fromLTWH(body.left, body.top, w, h * 0.10),
      _fill(Colors.black.withValues(alpha: 0.25), op),
    );
    canvas.drawRect(body, _outline(op));
    // big centre label
    final labelRect = Rect.fromCenter(
      center: Offset(base.dx, body.center.dy + 3),
      width: w * 0.92,
      height: bodyH * 0.55,
    );
    _label(canvas, def, labelRect, opacity: op);
  }

  static void _bag(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    _groundShadow(canvas, base, h * 0.7, op);
    final w = h * 0.70;
    final bodyH = h * 0.78;
    // Puffy rounded body
    final bodyRect = Rect.fromCenter(
      center: Offset(base.dx, base.dy - bodyH / 2),
      width: w,
      height: bodyH,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(bodyRect, Radius.circular(h * 0.20)),
      _gradFill(bodyRect, def.color, op),
    );
    _rimLight(canvas, bodyRect, op);
    canvas.drawRRect(
      RRect.fromRectAndRadius(bodyRect, Radius.circular(h * 0.20)),
      _outline(op),
    );
    // Zig-zag crimped top
    final zigY = bodyRect.top;
    final zigPath = Path()..moveTo(bodyRect.left + 4, zigY);
    const teeth = 6;
    for (var i = 0; i <= teeth; i++) {
      final x = bodyRect.left + 4 + i * ((w - 8) / teeth);
      final y = zigY + (i.isEven ? 0 : -h * 0.05);
      zigPath.lineTo(x, y);
    }
    canvas.drawPath(
      zigPath,
      _outline(op)..strokeWidth = 2,
    );
    // Label
    final labelRect = Rect.fromCenter(
      center: bodyRect.center,
      width: w * 0.85,
      height: bodyH * 0.45,
    );
    _label(canvas, def, labelRect, opacity: op);
  }

  static void _tray(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    _groundShadow(canvas, base, h * 0.8, op);
    final w = h * 0.90;
    final bodyH = h * 0.45;
    final tray = Rect.fromCenter(
      center: Offset(base.dx, base.dy - bodyH / 2),
      width: w,
      height: bodyH,
    );
    // Plastic lid
    canvas.drawRRect(
      RRect.fromRectAndRadius(tray, Radius.circular(h * 0.05)),
      _fill(Colors.white.withValues(alpha: 0.85), op),
    );
    // Coloured contents visible through lid
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        tray.deflate(4),
        Radius.circular(h * 0.04),
      ),
      _fill(def.color, op),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(tray, Radius.circular(h * 0.05)),
      _outline(op),
    );
    // Small label sticker on top
    final labelRect = Rect.fromCenter(
      center: Offset(base.dx, base.dy - bodyH * 0.75),
      width: w * 0.45,
      height: h * 0.22,
    );
    _label(canvas, def, labelRect, opacity: op);
  }

  static void _produce(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    // For produce, lean on the emoji — it already looks like the item. Draw a
    // subtle fruit-shaped shadow behind it for weight.
    final cy = base.dy - h * 0.4;
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(base.dx, cy), width: h * 0.7, height: h * 0.7),
      _fill(def.color, op),
    );
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(base.dx, cy), width: h * 0.7, height: h * 0.7),
      _outline(op),
    );
    // Sheen
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(base.dx - h * 0.12, cy - h * 0.12),
          width: h * 0.2,
          height: h * 0.18),
      _highlight(op),
    );
    // Emoji on top (bigger than label)
    final fontSize = h * 0.55;
    final p = EmojiCache.instance.get(def.emoji, fontSize);
    final w = EmojiCache.instance.widthOf(def.emoji, fontSize);
    canvas.drawParagraph(
      p,
      Offset(base.dx - w / 2, cy - fontSize * 0.6),
    );
  }

  static void _round(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    // Cake/pizza — circle from side view
    final r = h * 0.4;
    final cy = base.dy - r - h * 0.05;
    canvas.drawCircle(Offset(base.dx, cy), r, _fill(def.color, op));
    canvas.drawCircle(Offset(base.dx, cy), r, _outline(op));
    // Emoji on top as a "topping"
    final fontSize = h * 0.5;
    final p = EmojiCache.instance.get(def.emoji, fontSize);
    final w = EmojiCache.instance.widthOf(def.emoji, fontSize);
    canvas.drawParagraph(
      p,
      Offset(base.dx - w / 2, cy - fontSize * 0.6),
    );
  }

  static void _bouquet(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    // Stems: a few thin lines rising
    final stemPaint = Paint()
      ..color = const Color(0xFF4AA35A).withValues(alpha: op)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 5; i++) {
      final t = (i - 2) / 5.0;
      canvas.drawLine(
        Offset(base.dx + t * h * 0.3, base.dy),
        Offset(base.dx + t * h * 0.15, base.dy - h * 0.55),
        stemPaint,
      );
    }
    // Flower blossom cluster
    final cy = base.dy - h * 0.6;
    for (var i = 0; i < 5; i++) {
      final angle = i * (math.pi / 2.5);
      final ox = math.cos(angle) * h * 0.12;
      final oy = math.sin(angle) * h * 0.08 - h * 0.05;
      canvas.drawCircle(
        Offset(base.dx + ox, cy + oy),
        h * 0.12,
        _fill(def.color, op),
      );
      canvas.drawCircle(
        Offset(base.dx + ox, cy + oy),
        h * 0.12,
        _outline(op),
      );
    }
    // Centre
    canvas.drawCircle(
      Offset(base.dx, cy),
      h * 0.06,
      _fill(Colors.white, op),
    );
    // Wrap (triangular paper)
    final wrapPath = Path()
      ..moveTo(base.dx - h * 0.22, base.dy - h * 0.1)
      ..lineTo(base.dx + h * 0.22, base.dy - h * 0.1)
      ..lineTo(base.dx, base.dy)
      ..close();
    canvas.drawPath(
      wrapPath,
      _fill(Colors.white.withValues(alpha: 0.9), op),
    );
    canvas.drawPath(wrapPath, _outline(op));
  }

  static void _wedge(Canvas canvas, ItemDef def, Offset base, double h,
      double op) {
    final w = h * 0.9;
    final top = base.dy - h * 0.7;
    final path = Path()
      ..moveTo(base.dx - w / 2, base.dy)
      ..lineTo(base.dx + w / 2, base.dy)
      ..lineTo(base.dx + w / 4, top)
      ..close();
    canvas.drawPath(path, _fill(def.color, op));
    canvas.drawPath(path, _outline(op));
    // Holes (cheese)
    for (var i = 0; i < 3; i++) {
      canvas.drawCircle(
        Offset(base.dx - w * 0.1 + i * w * 0.15, base.dy - h * 0.3),
        h * 0.06,
        _fill(Colors.white.withValues(alpha: 0.85), op),
      );
    }
  }
}
