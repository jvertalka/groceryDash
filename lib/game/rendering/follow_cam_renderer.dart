import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../data/carts.dart';
import '../data/sections.dart';
import '../entities.dart';
import '../world/shelf.dart';
import '../world/store_layout.dart';
import '../world/store_world.dart';
import 'obstacle_sprites.dart';
import 'product_sprites.dart';

/// Follow-cam top-down renderer for the shopping-trip game. Camera follows
/// the player (which may be separate from the cart when parked). Draws
/// shelves with discrete product slots, the parked cart if any, NPCs, and
/// the player character as a separate sprite.
class FollowCamRenderer {
  FollowCamRenderer({required this.viewport});
  Size viewport;

  double _camX = 0;
  double _camY = 0;

  Offset worldToScreen(double wx, double wy) =>
      Offset(wx - _camX, wy - _camY);

  Rect get viewRect =>
      Rect.fromLTWH(_camX, _camY, viewport.width, viewport.height);

  void _updateCamera(StoreWorld world, double focusX, double focusY) {
    final targetCamX = focusX - viewport.width / 2;
    final targetCamY = focusY - viewport.height * 0.55;
    _camX = targetCamX.clamp(0.0, world.size.width - viewport.width);
    _camY = targetCamY.clamp(0.0, world.size.height - viewport.height);
    if (world.size.width < viewport.width) {
      _camX = (world.size.width - viewport.width) / 2;
    }
    if (world.size.height < viewport.height) {
      _camY = (world.size.height - viewport.height) / 2;
    }
  }

  void renderShoppingTrip(
    Canvas canvas,
    StoreWorld world,
    Player player,
    Cart cart,
    CartDef cartDef,
    ShelfSlot? focusedSlot,
  ) {
    _updateCamera(world, player.x, player.y);
    canvas.save();
    canvas.translate(-_camX, -_camY);

    _drawFloor(canvas, world);
    _drawSectionZones(canvas, world);
    _drawSolids(canvas, world);
    _drawCheckoutLabels(canvas, world);
    _drawShelfSlots(canvas, world, focusedSlot);
    _drawNpcs(canvas, world);
    _drawCart(canvas, cart, cartDef);
    _drawPlayer(canvas, player);

    canvas.restore();

    _drawAmbientOverlay(canvas);
  }

  // -------- floor --------
  void _drawFloor(Canvas canvas, StoreWorld world) {
    final bounds = Rect.fromLTWH(0, 0, world.size.width, world.size.height);
    canvas.drawRect(bounds, Paint()..color = const Color(0xFFEEE7D4));
    const tile = 80.0;
    final dark = Paint()..color = const Color(0xFFDFD4B6);
    for (var y = 0.0; y < bounds.height; y += tile) {
      for (var x = 0.0; x < bounds.width; x += tile) {
        final isDark = ((x / tile).floor() + (y / tile).floor()).isEven;
        if (isDark) canvas.drawRect(Rect.fromLTWH(x, y, tile, tile), dark);
      }
    }
  }

  // -------- section zone tints --------
  void _drawSectionZones(Canvas canvas, StoreWorld world) {
    for (final zone in world.layout.zones) {
      final section = sectionById(zone.sectionId);
      canvas.drawRect(
        zone.rect,
        Paint()..color = section.floorTintA.withValues(alpha: 0.3),
      );
    }
  }

  // -------- solids --------
  void _drawSolids(Canvas canvas, StoreWorld world) {
    for (final s in world.layout.solids) {
      if (!s.rect.overlaps(viewRect)) continue;
      switch (s.kind) {
        case SolidKind.wall:
          canvas.drawRect(s.rect, Paint()..color = const Color(0xFF8A7E60));
          canvas.drawRect(
            s.rect,
            Paint()
              ..color = Colors.black.withValues(alpha: 0.5)
              ..style = PaintingStyle.stroke
              ..strokeWidth = 2,
          );
        case SolidKind.shelf:
          _shelfBlock(canvas, s);
        case SolidKind.produceBin:
          _produceBin(canvas, s);
        case SolidKind.fridge:
          _fridge(canvas, s);
        case SolidKind.counter:
          _counter(canvas, s);
      }
    }
  }

  void _shelfBlock(Canvas canvas, SolidRect s) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          s.rect.shift(const Offset(2, 5)), const Radius.circular(6)),
      Paint()..color = Colors.black.withValues(alpha: 0.18),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(s.rect, const Radius.circular(6)),
      Paint()..color = s.wallColor,
    );
    // Subtle stripes — product rows seen from above
    final stripe = Paint()..color = Colors.black.withValues(alpha: 0.08);
    for (var y = s.rect.top + 8; y < s.rect.bottom - 4; y += 22) {
      canvas.drawRect(
          Rect.fromLTWH(s.rect.left + 4, y, s.rect.width - 8, 2), stripe);
    }
    canvas.drawRRect(
      RRect.fromRectAndRadius(s.rect, const Radius.circular(6)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    // Section name along the top
    final section = sectionById(s.sectionId);
    final label = section.name.toUpperCase();
    final builder = ui.ParagraphBuilder(ui.ParagraphStyle(
      textAlign: TextAlign.center,
      fontSize: 10,
      fontWeight: FontWeight.w800,
    ))
      ..pushStyle(TextStyle(
        color: Colors.black.withValues(alpha: 0.45),
        letterSpacing: 2,
      ).getTextStyle())
      ..addText(label);
    final para = builder.build()..layout(ui.ParagraphConstraints(width: s.rect.width));
    canvas.drawParagraph(para, Offset(s.rect.left, s.rect.top - 18));
  }

  void _produceBin(Canvas canvas, SolidRect s) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          s.rect.shift(const Offset(2, 5)), const Radius.circular(4)),
      Paint()..color = Colors.black.withValues(alpha: 0.2),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(s.rect, const Radius.circular(4)),
      Paint()..color = const Color(0xFFC68642),
    );
    final plank = Paint()..color = Colors.black.withValues(alpha: 0.25);
    for (var y = s.rect.top + 14; y < s.rect.bottom - 4; y += 14) {
      canvas.drawLine(
          Offset(s.rect.left + 2, y), Offset(s.rect.right - 2, y), plank);
    }
    canvas.drawRRect(
      RRect.fromRectAndRadius(s.rect, const Radius.circular(4)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.45)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
  }

  void _fridge(Canvas canvas, SolidRect s) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          s.rect.shift(const Offset(2, 5)), const Radius.circular(8)),
      Paint()..color = Colors.black.withValues(alpha: 0.2),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(s.rect, const Radius.circular(8)),
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0xFFE2F1F8), Color(0xFFB0D0DC)],
        ).createShader(s.rect),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(s.rect, const Radius.circular(8)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.45)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
  }

  void _counter(Canvas canvas, SolidRect s) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(s.rect, const Radius.circular(4)),
      Paint()..color = const Color(0xFFB9A984),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(s.rect, const Radius.circular(4)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    // Conveyor stripe
    canvas.drawRect(
      Rect.fromLTWH(s.rect.left + 8, s.rect.center.dy - 3,
          s.rect.width - 16, 6),
      Paint()..color = const Color(0xFF2A2A2A),
    );
  }

  // -------- checkout labels --------
  void _drawCheckoutLabels(Canvas canvas, StoreWorld world) {
    for (var i = 0; i < world.checkouts.length; i++) {
      final c = world.checkouts[i];
      final labelPos = Offset(c.rect.center.dx, c.rect.top - 28);
      final builder = ui.ParagraphBuilder(ui.ParagraphStyle(
        textAlign: TextAlign.center,
        fontSize: 11,
        fontWeight: FontWeight.w800,
      ))
        ..pushStyle(TextStyle(
          color: Colors.black.withValues(alpha: 0.55),
          letterSpacing: 2,
        ).getTextStyle())
        ..addText('CHECKOUT ${i + 1}');
      final para = builder.build()..layout(const ui.ParagraphConstraints(width: 180));
      canvas.drawParagraph(para, Offset(labelPos.dx - 90, labelPos.dy));
    }
  }

  // -------- shelf slot items --------
  void _drawShelfSlots(
      Canvas canvas, StoreWorld world, ShelfSlot? focused) {
    for (final s in world.shelfIndex.slots) {
      if (s.empty) continue;
      if (!viewRect.contains(s.position)) continue;
      // Focused slot: pulsing ring underneath
      if (identical(s, focused)) {
        canvas.drawCircle(
          s.position,
          22,
          Paint()
            ..color = const Color(0xFFE05B3F).withValues(alpha: 0.25)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
        );
        canvas.drawCircle(
          s.position,
          20,
          Paint()
            ..color = const Color(0xFFE05B3F)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
      ProductSprites.draw(canvas, s.item, s.position, 34);
    }
  }

  // -------- NPCs --------
  void _drawNpcs(Canvas canvas, StoreWorld world) {
    final visible = world.npcs
        .where((n) => !n.consumed && viewRect.contains(Offset(n.x, n.y)))
        .toList()
      ..sort((a, b) => a.y.compareTo(b.y));
    for (final n in visible) {
      ObstacleSprites.draw(canvas, n.def, Offset(n.x, n.y), 60,
          phase: n.wobble);
      if (n.isThieving) {
        // Small red warning above a thief
        canvas.drawCircle(
          Offset(n.x, n.y - 46),
          8,
          Paint()..color = const Color(0xFFE05B3F),
        );
        canvas.drawCircle(
          Offset(n.x, n.y - 46),
          8,
          Paint()
            ..color = Colors.white
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5,
        );
        // "!" glyph
        canvas.drawRect(
          Rect.fromCenter(
              center: Offset(n.x, n.y - 48), width: 2, height: 7),
          Paint()..color = Colors.white,
        );
      }
    }
  }

  // -------- cart --------
  void _drawCart(Canvas canvas, Cart cart, CartDef def) {
    final parked = cart.state == CartState.parked;
    canvas.save();
    canvas.translate(cart.x, cart.y);
    canvas.rotate(cart.heading - math.pi / 2); // face the heading

    const bodyW = 40.0;
    const bodyH = 30.0;
    // Shadow
    canvas.drawOval(
      Rect.fromCenter(
          center: const Offset(0, 10), width: bodyW * 0.9, height: 10),
      Paint()..color = Colors.black.withValues(alpha: 0.28),
    );
    // Body
    final body = Rect.fromCenter(
      center: Offset.zero,
      width: bodyW,
      height: bodyH,
    );
    final bodyColor = parked
        ? Color.lerp(def.color, Colors.white, 0.15)!
        : def.color;
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, const Radius.circular(6)),
      Paint()..color = bodyColor,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, const Radius.circular(6)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    // Wire mesh hatch
    final mesh = Paint()
      ..color = Colors.white.withValues(alpha: 0.4)
      ..strokeWidth = 1;
    for (var i = 1; i < 4; i++) {
      final t = i / 4.0;
      canvas.drawLine(
        Offset(-bodyW / 2 + bodyW * t, body.top + 2),
        Offset(-bodyW / 2 + bodyW * t, body.bottom - 2),
        mesh,
      );
    }
    // Handle bar (front of cart)
    canvas.drawLine(
      Offset(-bodyW / 2, -bodyH / 2 - 2),
      Offset(bodyW / 2, -bodyH / 2 - 2),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.5)
        ..strokeWidth = 2,
    );
    // Basket contents suggestion (shows a few stacked colour blocks if
    // basket is non-empty)
    if (cart.basket.isNotEmpty) {
      for (var i = 0; i < math.min(3, cart.basket.length); i++) {
        final item = cart.basket[cart.basket.length - 1 - i];
        canvas.drawRect(
          Rect.fromLTWH(-bodyW / 2 + 3 + i * 4, -bodyH / 2 + 3, 3, bodyH - 6),
          Paint()..color = item.color,
        );
      }
    }
    canvas.restore();
    // Parked indicator ring
    if (parked) {
      canvas.drawCircle(
        Offset(cart.x, cart.y),
        32,
        Paint()
          ..color = const Color(0xFFE05B3F).withValues(alpha: 0.25)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }
  }

  // -------- player --------
  void _drawPlayer(Canvas canvas, Player player) {
    // Shadow
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(player.x, player.y + 12), width: 22, height: 8),
      Paint()..color = Colors.black.withValues(alpha: 0.3),
    );
    // Feet (two ovals)
    final feetY = player.y + 8;
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(player.x - 4, feetY), width: 6, height: 4),
      Paint()..color = const Color(0xFF2A2A3A),
    );
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(player.x + 4, feetY), width: 6, height: 4),
      Paint()..color = const Color(0xFF2A2A3A),
    );
    // Body (torso)
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
            center: Offset(player.x, player.y + 1),
            width: 16,
            height: 18),
        const Radius.circular(4),
      ),
      Paint()..color = const Color(0xFF3D8AB0),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
            center: Offset(player.x, player.y + 1),
            width: 16,
            height: 18),
        const Radius.circular(4),
      ),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );
    // Head
    final headCenter = Offset(player.x, player.y - 10);
    canvas.drawCircle(headCenter, 7,
        Paint()..color = const Color(0xFFF4C9A3));
    canvas.drawCircle(
      headCenter,
      7,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );
    // Hair
    canvas.drawArc(
      Rect.fromCircle(center: headCenter, radius: 7),
      math.pi * 1.15,
      math.pi * 0.75,
      false,
      Paint()
        ..color = const Color(0xFF3A2916)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5,
    );
    // Reach animation: outstretched arm
    if (player.isReaching) {
      final dir = player.facing;
      final reachX = math.cos(dir) * 16;
      final reachY = math.sin(dir) * 16;
      canvas.drawLine(
        Offset(player.x, player.y - 2),
        Offset(player.x + reachX, player.y - 2 + reachY),
        Paint()
          ..color = const Color(0xFFF4C9A3)
          ..strokeWidth = 4
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  // -------- ambient --------
  void _drawAmbientOverlay(Canvas canvas) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, viewport.width, viewport.height),
      Paint()
        ..shader = RadialGradient(
          center: Alignment.center,
          radius: 1.1,
          colors: [
            Colors.transparent,
            Colors.black.withValues(alpha: 0.22),
          ],
          stops: const [0.6, 1.0],
        ).createShader(
            Rect.fromLTWH(0, 0, viewport.width, viewport.height)),
    );
  }
}
