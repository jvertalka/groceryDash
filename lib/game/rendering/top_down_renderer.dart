import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../data/carts.dart';
import '../data/sections.dart';
import '../entities.dart';
import '../world/store_layout.dart';
import '../world/store_world.dart';

/// Overhead map view: the whole store scaled to fit the screen. Shows where
/// shelves, NPCs, the cart, the player, and checkout lanes are. Intended as
/// a quick orientation view, not the main game view.
class TopDownRenderer {
  TopDownRenderer({required this.viewport});
  Size viewport;

  double _scaleFor(Size world) {
    final sx = viewport.width / world.width;
    final sy = viewport.height / world.height;
    return math.min(sx, sy) * 0.95;
  }

  void renderShoppingTrip(
    Canvas canvas,
    StoreWorld world,
    Player player,
    Cart cart,
    CartDef cartDef,
  ) {
    final scale = _scaleFor(world.size);
    canvas.save();
    final offset = Offset(
      (viewport.width - world.size.width * scale) / 2,
      (viewport.height - world.size.height * scale) / 2,
    );
    canvas.translate(offset.dx, offset.dy);
    canvas.scale(scale);

    canvas.drawRect(
      Rect.fromLTWH(0, 0, world.size.width, world.size.height),
      Paint()..color = const Color(0xFFEEE7D4),
    );

    for (final z in world.layout.zones) {
      final section = sectionById(z.sectionId);
      canvas.drawRect(z.rect,
          Paint()..color = section.floorTintA.withValues(alpha: 0.5));
    }

    for (final s in world.layout.solids) {
      final fill = switch (s.kind) {
        SolidKind.wall => const Color(0xFF8A7E60),
        SolidKind.shelf => s.wallColor,
        SolidKind.produceBin => const Color(0xFFC68642),
        SolidKind.fridge => const Color(0xFFD4ECF5),
        SolidKind.counter => const Color(0xFFB9A984),
      };
      canvas.drawRRect(
        RRect.fromRectAndRadius(s.rect, const Radius.circular(6)),
        Paint()..color = fill,
      );
    }

    // NPCs as small dots
    for (final n in world.npcs) {
      if (n.consumed) continue;
      canvas.drawCircle(Offset(n.x, n.y), 8,
          Paint()..color = n.def.color);
    }

    // Cart
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
            center: Offset(cart.x, cart.y),
            width: 40,
            height: 28),
        const Radius.circular(6),
      ),
      Paint()..color = cartDef.color,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
            center: Offset(cart.x, cart.y),
            width: 40,
            height: 28),
        const Radius.circular(6),
      ),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    if (cart.state == CartState.parked) {
      canvas.drawCircle(
        Offset(cart.x, cart.y),
        36,
        Paint()
          ..color = const Color(0xFFE05B3F).withValues(alpha: 0.7)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3,
      );
    }

    // Player
    canvas.drawCircle(
        Offset(player.x, player.y), 10,
        Paint()..color = const Color(0xFF3D8AB0));
    canvas.drawCircle(
      Offset(player.x, player.y),
      10,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    canvas.drawCircle(
      Offset(player.x, player.y),
      30,
      Paint()
        ..color = const Color(0xFFFFD166).withValues(alpha: 0.9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );

    // Checkouts highlighted
    for (final c in world.checkouts) {
      canvas.drawRect(
        c.rect,
        Paint()
          ..color = const Color(0xFFE05B3F).withValues(alpha: 0.8)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }

    canvas.restore();
  }
}
