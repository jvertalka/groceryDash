import 'dart:ui';

import 'package:flutter/material.dart';

/// Cartoon drawing utilities — outlined shapes with optional inner highlights
/// and drop shadows. Gives the procedurally-rendered store a comic-book feel.
class Cartoon {
  Cartoon._();

  static const Color ink = Color(0xFF2A1E12);
  static const Color softInk = Color(0xFF52402C);

  static final Paint _inkStroke = Paint()
    ..color = ink
    ..style = PaintingStyle.stroke
    ..strokeWidth = 3
    ..strokeJoin = StrokeJoin.round
    ..strokeCap = StrokeCap.round;

  static final Paint _softInkStroke = Paint()
    ..color = softInk
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2
    ..strokeJoin = StrokeJoin.round;

  static final Paint _dropShadow = Paint()
    ..color = Colors.black.withValues(alpha: 0.16)
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);

  /// Draw a rounded rectangle with a thick dark outline and a drop shadow.
  static void drawCard(
    Canvas canvas,
    Rect rect,
    Color fill, {
    double radius = 10,
    bool shadow = true,
    double strokeWidth = 3,
    Color? stroke,
    Color? highlight,
  }) {
    final rr = RRect.fromRectAndRadius(rect, Radius.circular(radius));
    if (shadow) {
      canvas.drawRRect(rr.shift(const Offset(0, 3)), _dropShadow);
    }
    canvas.drawRRect(rr, Paint()..color = fill);
    if (highlight != null) {
      // Shiny top band
      final hi = Rect.fromLTWH(
        rect.left + 4,
        rect.top + 3,
        rect.width - 8,
        rect.height * 0.18,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(hi, Radius.circular(radius * 0.6)),
        Paint()..color = highlight.withValues(alpha: 0.35),
      );
    }
    final outline = (stroke == null && strokeWidth == 3)
        ? _inkStroke
        : (Paint()
          ..color = stroke ?? ink
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth
          ..strokeJoin = StrokeJoin.round);
    canvas.drawRRect(rr, outline);
  }

  /// Draw a circle with a thick dark outline.
  static void drawBubble(
    Canvas canvas,
    Offset center,
    double radius,
    Color fill, {
    bool shadow = true,
    Color? highlight,
  }) {
    if (shadow) {
      canvas.drawCircle(center.translate(0, 3), radius, _dropShadow);
    }
    canvas.drawCircle(center, radius, Paint()..color = fill);
    if (highlight != null) {
      canvas.drawCircle(
        center.translate(-radius * 0.35, -radius * 0.35),
        radius * 0.35,
        Paint()..color = highlight.withValues(alpha: 0.6),
      );
    }
    canvas.drawCircle(center, radius, _inkStroke);
  }

  /// Linear vertical gradient fill.
  static Paint verticalGradient(Rect rect, Color top, Color bottom) {
    return Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [top, bottom],
      ).createShader(rect);
  }

  /// Get the standard ink-stroke paint (read-only; don't mutate).
  static Paint get inkStroke => _inkStroke;
  static Paint get softStroke => _softInkStroke;
  static Paint get dropShadow => _dropShadow;

  /// Draw ground-level floor tiles in cartoon style.
  static void drawFloor(
    Canvas canvas,
    Rect area, {
    required Color tintA,
    required Color tintB,
    double tileW = 80,
    double tileH = 48,
    double scrollX = 0,
    double scrollY = 0,
  }) {
    // Solid base
    canvas.drawRect(area, Paint()..color = tintA);
    // Diagonal lighter tiles
    final tilePaint = Paint()..color = tintB;
    final startX = -(scrollX % (tileW * 2));
    final startY = -(scrollY % (tileH * 2));
    canvas.save();
    canvas.clipRect(area);
    for (var y = area.top + startY - tileH; y < area.bottom + tileH; y += tileH) {
      final rowOffset = ((y / tileH).floor().isEven ? 0 : tileW);
      for (var x = area.left + startX - tileW + rowOffset;
          x < area.right + tileW;
          x += tileW * 2) {
        canvas.drawRect(Rect.fromLTWH(x, y, tileW, tileH), tilePaint);
      }
    }
    canvas.restore();
  }

  /// Draw a cartoon-style TextSpan centred at a point.
  static void drawLabel(
    Canvas canvas,
    String text,
    Offset at, {
    double fontSize = 12,
    Color color = ink,
    FontWeight weight = FontWeight.w800,
  }) {
    final builder = ParagraphBuilder(ParagraphStyle(
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
      fontSize: fontSize,
      fontWeight: weight,
    ))
      ..pushStyle(TextStyle(color: color).getTextStyle())
      ..addText(text);
    final para = builder.build()
      ..layout(ParagraphConstraints(width: fontSize * text.length));
    canvas.drawParagraph(
      para,
      Offset(at.dx - para.longestLine / 2, at.dy - fontSize * 0.6),
    );
  }
}
