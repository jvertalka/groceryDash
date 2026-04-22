import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../data/carts.dart';
import '../data/items.dart';
import '../data/obstacles.dart';
import 'obstacle_sprites.dart';
import 'product_sprites.dart';

/// Bakes every billboard-worthy object in the world into a `ui.Image` once
/// at load time. The raycaster then draws these as depth-tested billboards
/// over the wall columns.
///
/// Design note: the silhouettes come from the existing top-down sprite
/// generators (`ObstacleSprites`, `ProductSprites`). Rendering them into a
/// `PictureRecorder` and snapshotting the result gives us transparent
/// textures ready for sprite drawing.
class SpriteAtlas {
  SpriteAtlas._();

  final Map<String, ui.Image> _cache = {};

  /// NPC sprites keyed by obstacle id (shopper / stocker / kid / cart / …).
  ui.Image npc(String id) =>
      _cache['npc_$id'] ?? _cache['npc_shopper'] ?? _cache.values.first;

  /// Item sprites keyed by item id.
  ui.Image item(String id) =>
      _cache['item_$id'] ?? _cache.values.first;

  /// Parked cart silhouette.
  ui.Image parkedCart(String cartId) =>
      _cache['cart_$cartId'] ?? _cache['cart_$kDefaultCartId']!;

  /// Size each billboard renders at in **world units**. Used by the raycaster
  /// to scale the sprite for distance.
  double worldSizeFor(String spriteKey) {
    // NPCs are roughly "person sized" in the layout scale.
    if (spriteKey.startsWith('npc_cart')) return 70;
    if (spriteKey.startsWith('npc_kid')) return 55;
    if (spriteKey.startsWith('npc_')) return 65;
    if (spriteKey.startsWith('item_')) return 42;
    if (spriteKey.startsWith('cart_')) return 90;
    return 60;
  }

  static Future<SpriteAtlas> build() async {
    final atlas = SpriteAtlas._();
    // NPCs
    for (final def in kObstacles) {
      if (def.id == 'spill' || def.id == 'grapes') continue; // floor decals
      atlas._cache['npc_${def.id}'] = await _renderNpc(def);
    }
    // Items (every product in the catalogue)
    for (final def in kItems) {
      atlas._cache['item_${def.id}'] = await _renderItem(def);
    }
    // Carts (parked silhouette)
    for (final def in kCarts) {
      atlas._cache['cart_${def.id}'] = await _renderCart(def);
    }
    return atlas;
  }

  // ----- renderers -----
  static Future<ui.Image> _renderNpc(ObstacleDef def) async {
    const w = 96;
    const h = 128;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    // Draw the existing top-down sprite anchored at the bottom of the
    // canvas so its "feet" sit on the billboard baseline.
    ObstacleSprites.draw(
      canvas,
      def,
      Offset(w / 2, h.toDouble() - 8),
      h * 0.85,
      phase: 0,
    );
    return recorder.endRecording().toImage(w, h);
  }

  static Future<ui.Image> _renderItem(ItemDef def) async {
    const w = 80;
    const h = 96;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    ProductSprites.draw(
      canvas,
      def,
      Offset(w / 2, h.toDouble() - 6),
      h * 0.85,
    );
    return recorder.endRecording().toImage(w, h);
  }

  static Future<ui.Image> _renderCart(CartDef def) async {
    const w = 128;
    const h = 112;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    // Anchor cart centre near the bottom
    final cx = w / 2;
    final cy = h - 28;

    // Shadow
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(cx, cy + 16),
        width: w * 0.8,
        height: 12,
      ),
      Paint()..color = Colors.black.withValues(alpha: 0.35),
    );
    // Body
    final body = Rect.fromCenter(
      center: Offset(cx, cy - 8),
      width: w * 0.75,
      height: h * 0.5,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, const Radius.circular(10)),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color.lerp(def.color, Colors.white, 0.2)!,
            def.color,
            Color.lerp(def.color, Colors.black, 0.25)!,
          ],
        ).createShader(body),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, const Radius.circular(10)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
    // Wire mesh
    final mesh = Paint()
      ..color = Colors.white.withValues(alpha: 0.4)
      ..strokeWidth = 1.5;
    for (var i = 1; i < 5; i++) {
      final t = i / 5;
      canvas.drawLine(
        Offset(body.left + body.width * t, body.top + 3),
        Offset(body.left + body.width * t, body.bottom - 3),
        mesh,
      );
    }
    // Handle
    canvas.drawLine(
      Offset(body.left, body.top - 2),
      Offset(body.left - 14, body.top - 22),
      Paint()
        ..color = const Color(0xFFB8BEC6)
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round,
    );
    // Grip
    canvas.drawLine(
      Offset(body.left - 22, body.top - 20),
      Offset(body.left - 8, body.top - 34),
      Paint()
        ..color = const Color(0xFFE05B3F)
        ..strokeWidth = 10
        ..strokeCap = StrokeCap.round,
    );
    // Wheels
    final wheel = Paint()..color = const Color(0xFF1E1E26);
    canvas.drawCircle(Offset(body.left + 12, cy + 10), 8, wheel);
    canvas.drawCircle(Offset(body.right - 12, cy + 10), 8, wheel);

    return recorder.endRecording().toImage(w, h);
  }
}
