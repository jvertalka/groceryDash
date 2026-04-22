import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../data/carts.dart';
import '../data/items.dart';
import '../data/obstacles.dart';
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

  /// Stocker pallet.
  ui.Image pallet() => _cache['pallet']!;

  /// Size each billboard renders at in **world units**. Used by the raycaster
  /// to scale the sprite for distance.
  double worldSizeFor(String spriteKey) {
    // NPCs are roughly "person sized" in the layout scale.
    if (spriteKey.startsWith('npc_cart')) return 70;
    if (spriteKey.startsWith('npc_kid')) return 55;
    if (spriteKey.startsWith('npc_')) return 65;
    if (spriteKey.startsWith('item_')) return 42;
    if (spriteKey.startsWith('cart_')) return 90;
    if (spriteKey == 'pallet') return 55;
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
    atlas._cache['pallet'] = await _renderPallet();
    return atlas;
  }

  static Future<ui.Image> _renderPallet() async {
    const w = 96;
    const h = 88;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    // Shadow
    canvas.drawOval(
      Rect.fromCenter(
        center: const Offset(w / 2, h - 6.0),
        width: w * 0.9,
        height: 14,
      ),
      Paint()..color = Colors.black.withValues(alpha: 0.35),
    );
    // Wooden pallet planks
    final base =
        Rect.fromLTWH(8, h - 44, w.toDouble() - 16, 36);
    canvas.drawRRect(
      RRect.fromRectAndRadius(base, const Radius.circular(4)),
      Paint()..color = const Color(0xFFA86A38),
    );
    for (var y = base.top + 4.0; y < base.bottom; y += 8) {
      canvas.drawRect(
        Rect.fromLTWH(base.left, y, base.width, 1.5),
        Paint()..color = Colors.black.withValues(alpha: 0.3),
      );
    }
    canvas.drawRRect(
      RRect.fromRectAndRadius(base, const Radius.circular(4)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    // Stacked boxes on top
    final box1 = Rect.fromLTWH(18, h - 76.0, 36, 36);
    final box2 = Rect.fromLTWH(52, h - 62.0, 26, 22);
    canvas.drawRRect(
      RRect.fromRectAndRadius(box1, const Radius.circular(3)),
      Paint()..color = const Color(0xFFC68642),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(box1, const Radius.circular(3)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(box2, const Radius.circular(3)),
      Paint()..color = const Color(0xFFD89F3B),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(box2, const Radius.circular(3)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    // Caution tape
    canvas.drawRect(
      Rect.fromLTWH(8, h - 47.0, w.toDouble() - 16, 3),
      Paint()..color = const Color(0xFFEEC24A),
    );
    return recorder.endRecording().toImage(w, h);
  }

  // ----- renderers -----
  /// Front-facing NPC for the first-person billboard view. Shaded with a
  /// vertical gradient on the torso, a rim highlight on one side, and a
  /// soft drop shadow at the feet for grounding. Styled per obstacle id —
  /// shoppers get a coat, kids are smaller, stockers have an apron, and
  /// runaway carts render as a mini cart silhouette.
  static Future<ui.Image> _renderNpc(ObstacleDef def) async {
    const w = 96;
    const h = 160;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);

    if (def.id == 'cart') {
      // Runaway cart — render a cart-from-front silhouette
      _paintCartFront(canvas, w, h);
    } else {
      _paintHumanFront(canvas, w, h, def);
    }
    return recorder.endRecording().toImage(w, h);
  }

  static void _paintHumanFront(
      Canvas canvas, int w, int h, ObstacleDef def) {
    final cx = w / 2.0;
    final feetY = h - 12.0;

    // Colour choice per NPC archetype
    final (shirtColor, pantsColor, hairColor, skin, accent) = switch (def.id) {
      'stocker' => (
        const Color(0xFFD89F3B),
        const Color(0xFF3D3D3D),
        const Color(0xFF3A2916),
        const Color(0xFFE0A678),
        Colors.white,
      ),
      'kid' => (
        const Color(0xFFE05B3F),
        const Color(0xFF3D4A66),
        const Color(0xFFE5A145),
        const Color(0xFFF4C9A3),
        Colors.transparent,
      ),
      _ => (
        const Color(0xFF3D8AB0),
        const Color(0xFF3D4A66),
        const Color(0xFF3A2916),
        const Color(0xFFF4C9A3),
        Colors.transparent,
      ),
    };

    final sizeMult = def.id == 'kid' ? 0.78 : 1.0;
    // --- Drop shadow ---
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(cx, feetY + 2), width: 46 * sizeMult, height: 10),
      Paint()..color = Colors.black.withValues(alpha: 0.4),
    );

    // --- Legs ---
    final legTop = feetY - 54 * sizeMult;
    final legsPaint = Paint()..color = pantsColor;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx - 11 * sizeMult, legTop, 10 * sizeMult,
            52 * sizeMult),
        const Radius.circular(3),
      ),
      legsPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx + 1 * sizeMult, legTop, 10 * sizeMult,
            52 * sizeMult),
        const Radius.circular(3),
      ),
      legsPaint,
    );

    // --- Shoes ---
    final shoesPaint = Paint()..color = const Color(0xFF2A2A3A);
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(cx - 6 * sizeMult, feetY),
          width: 14 * sizeMult,
          height: 7),
      shoesPaint,
    );
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(cx + 6 * sizeMult, feetY),
          width: 14 * sizeMult,
          height: 7),
      shoesPaint,
    );

    // --- Torso with vertical gradient ---
    final torsoTop = legTop - 52 * sizeMult;
    final torsoW = 40 * sizeMult;
    final torsoRect = Rect.fromLTWH(
      cx - torsoW / 2,
      torsoTop,
      torsoW,
      52 * sizeMult,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(torsoRect, const Radius.circular(8)),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color.lerp(shirtColor, Colors.white, 0.12)!,
            shirtColor,
            Color.lerp(shirtColor, Colors.black, 0.25)!,
          ],
        ).createShader(torsoRect),
    );
    // Rim highlight — left side lighter
    canvas.drawRect(
      Rect.fromLTWH(
          torsoRect.left + 2, torsoRect.top + 4, 3, torsoRect.height - 8),
      Paint()..color = Colors.white.withValues(alpha: 0.3),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(torsoRect, const Radius.circular(8)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    // Apron for stocker
    if (accent != Colors.transparent) {
      final apronRect = Rect.fromLTWH(
        torsoRect.left + 4,
        torsoRect.top + torsoRect.height * 0.35,
        torsoRect.width - 8,
        torsoRect.height * 0.65,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(apronRect, const Radius.circular(4)),
        Paint()..color = accent,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(apronRect, const Radius.circular(4)),
        Paint()
          ..color = Colors.black.withValues(alpha: 0.35)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }

    // --- Arms ---
    final armPaint = Paint()..color = skin;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(torsoRect.left - 8 * sizeMult, torsoRect.top + 4,
            8 * sizeMult, 40 * sizeMult),
        const Radius.circular(4),
      ),
      armPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(torsoRect.right, torsoRect.top + 4, 8 * sizeMult,
            40 * sizeMult),
        const Radius.circular(4),
      ),
      armPaint,
    );

    // --- Head ---
    final headR = 16 * sizeMult;
    final headC = Offset(cx, torsoTop - headR + 2);
    // Neck
    canvas.drawRect(
      Rect.fromCenter(
          center: Offset(cx, torsoTop - 2),
          width: 10 * sizeMult,
          height: 6),
      Paint()..color = Color.lerp(skin, Colors.black, 0.15)!,
    );
    // Head with sphere-ish gradient
    canvas.drawCircle(
      headC,
      headR,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-0.35, -0.35),
          radius: 1.0,
          colors: [
            Color.lerp(skin, Colors.white, 0.15)!,
            skin,
            Color.lerp(skin, Colors.black, 0.25)!,
          ],
        ).createShader(
          Rect.fromCircle(center: headC, radius: headR),
        ),
    );
    canvas.drawCircle(
      headC,
      headR,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    // Hair — arc over the top of the head
    canvas.save();
    final hairRect = Rect.fromCircle(center: headC, radius: headR);
    canvas.clipRect(Rect.fromLTWH(
      hairRect.left,
      hairRect.top,
      hairRect.width,
      hairRect.height * 0.55,
    ));
    canvas.drawCircle(
      headC,
      headR,
      Paint()..color = hairColor,
    );
    canvas.restore();
    // Eyes
    final eyePaint = Paint()..color = Colors.black;
    canvas.drawCircle(headC.translate(-headR * 0.35, -headR * 0.05),
        headR * 0.1, eyePaint);
    canvas.drawCircle(headC.translate(headR * 0.35, -headR * 0.05),
        headR * 0.1, eyePaint);
    // Mouth
    canvas.drawLine(
      headC.translate(-headR * 0.25, headR * 0.35),
      headC.translate(headR * 0.25, headR * 0.35),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.6)
        ..strokeWidth = 1.5,
    );
  }

  static void _paintCartFront(Canvas canvas, int w, int h) {
    final cx = w / 2.0;
    final bottomY = h - 20.0;
    // Shadow
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(cx, bottomY + 6), width: 72, height: 12),
      Paint()..color = Colors.black.withValues(alpha: 0.4),
    );
    // Body
    final body = Rect.fromCenter(
      center: Offset(cx, bottomY - 26),
      width: 60,
      height: 44,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, const Radius.circular(8)),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFD9D9E0), Color(0xFF7C7C85)],
        ).createShader(body),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, const Radius.circular(8)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );
    // Wire mesh
    final mesh = Paint()
      ..color = Colors.black.withValues(alpha: 0.3)
      ..strokeWidth = 1;
    for (var i = 1; i < 5; i++) {
      final t = i / 5;
      canvas.drawLine(
        Offset(body.left + body.width * t, body.top + 3),
        Offset(body.left + body.width * t, body.bottom - 3),
        mesh,
      );
    }
    // Handle bar
    canvas.drawRect(
      Rect.fromLTWH(body.left - 4, body.top - 8, body.width + 8, 6),
      Paint()..color = const Color(0xFFE05B3F),
    );
    // Wheels (peek)
    canvas.drawCircle(Offset(body.left + 8, body.bottom + 4), 6,
        Paint()..color = Colors.black);
    canvas.drawCircle(Offset(body.right - 8, body.bottom + 4), 6,
        Paint()..color = Colors.black);
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
