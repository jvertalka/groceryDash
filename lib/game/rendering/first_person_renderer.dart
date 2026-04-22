import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../data/carts.dart';
import '../entities.dart';
import '../world/grid_world.dart';
import '../world/shelf.dart';
import '../world/store_world.dart';
import 'sprite_atlas.dart';
import 'textures.dart';

/// Result of casting a single ray. Captured so the floor-caster and sprite
/// sorter can reuse the per-column wall distance (Z-buffer).
class _RayHit {
  _RayHit({
    required this.distance,
    required this.cell,
    required this.sectionId,
    required this.wallU,
    required this.sideNS,
  });
  final double distance;   // perpendicular distance to wall
  final CellKind cell;
  final String? sectionId;
  final double wallU;      // 0..1 across the wall face
  final bool sideNS;       // true if hit a N/S face (for shading)
}

/// First-person raycasting renderer. Uses DDA grid traversal per screen
/// column, samples the matching column from a pre-built texture, and draws
/// it with `Canvas.drawImageRect`.
///
/// Retro-FPS aesthetic — flat floor/ceiling with distance darkening, no
/// lighting model beyond that, sprites rendered as billboards (added in a
/// later pass).
class FirstPersonRenderer {
  FirstPersonRenderer({
    required this.viewport,
    required this.atlas,
    required this.sprites,
  });
  Size viewport;
  TextureAtlas atlas;
  SpriteAtlas sprites;

  /// Visual lag for the cart — cart display heading trails player.facing.
  /// Updated from the game class each frame.
  double cartDisplayHeading = 0;
  double cartPitchOffset = 0;   // +ve leans forward (accel), -ve back (brake)

  /// Horizontal FOV in radians. ~72° gives a comfortable "pushing a cart"
  /// feel without fish-eye.
  static const double _fov = 72 * math.pi / 180;

  /// Internal render resolution. Lower = faster at the cost of blockiness.
  /// 1.0 = native pixel columns; 2.0 = half the columns stretched.
  final double _pixelStep = 2.0;

  /// Persistent Z-buffer (depth per screen column) reused for sprite sort.
  List<double> _zBuffer = [];

  /// Head bob accumulator — driven externally by walking speed.
  double _bobPhase = 0;

  void updateHeadBob(double dt, double speed) {
    // Only bob when moving; scale by speed.
    if (speed > 5) {
      _bobPhase += dt * speed * 0.035;
    }
  }

  void render(
    Canvas canvas,
    StoreWorld world,
    GridWorld grid,
    Player player,
    Cart cart,
    CartDef cartDef,
    ShelfSlot? focusedSlot,
  ) {
    final w = viewport.width;
    final h = viewport.height;

    // Head bob
    final bob = math.sin(_bobPhase * 2) * 4;
    final horizon = h * 0.5 + bob;

    // --- Ceiling + floor backgrounds (flat cheap fill) ---
    _drawSkyAndFloor(canvas, w, h, horizon);

    // --- Raycast walls ---
    final columns = (w / _pixelStep).ceil();
    _zBuffer = List<double>.filled(columns, double.infinity);

    final camX = player.x;
    final camY = player.y;
    final facing = player.facing;
    for (var i = 0; i < columns; i++) {
      // Camera-space x in [-1, +1]
      final cx = 2 * (i / columns) - 1;
      final rayAngle = facing + cx * _fov / 2;
      final hit = _castRay(grid, camX, camY, rayAngle);
      _zBuffer[i] = hit.distance;
      if (hit.distance >= 1e9) continue;
      _drawColumn(canvas, i, columns, w, h, horizon, hit, rayAngle, facing);
    }

    // --- Billboards (NPCs, parked cart, focused shelf item) ---
    _drawSprites(
      canvas,
      world,
      camX,
      camY,
      facing,
      cart,
      cartDef,
      focusedSlot,
      w,
      h,
      horizon,
    );

    // --- Foreground: cart pushed out ahead of the camera ---
    _drawForegroundCart(canvas, w, h, horizon, cartDef, cart, player);

    // --- Crosshair ---
    _drawCrosshair(canvas, w, horizon, focusedSlot != null);
  }

  // ----- backgrounds -----
  void _drawSkyAndFloor(Canvas canvas, double w, double h, double horizon) {
    // Ceiling — warm lit with downward gradient
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, horizon),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFFEFE7D2),
            const Color(0xFFC8B996).withValues(alpha: 0.9),
          ],
        ).createShader(Rect.fromLTWH(0, 0, w, horizon)),
    );
    // Floor — checkered band with perspective falloff
    canvas.drawRect(
      Rect.fromLTWH(0, horizon, w, h - horizon),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF867a5c),
            const Color(0xFFC8B996),
          ],
        ).createShader(Rect.fromLTWH(0, horizon, w, h - horizon)),
    );
  }

  // ----- ray march (DDA) -----
  _RayHit _castRay(GridWorld grid, double ox, double oy, double angle) {
    final rx = math.cos(angle);
    final ry = math.sin(angle);
    final cellSize = grid.cellSize;

    // Current cell
    var mapX = (ox / cellSize).floor();
    var mapY = (oy / cellSize).floor();

    // Distance to step one full cell along each axis (in world units)
    final deltaX = (rx == 0) ? 1e9 : (cellSize / rx).abs();
    final deltaY = (ry == 0) ? 1e9 : (cellSize / ry).abs();

    // Initial side distances (world units until we cross a cell boundary)
    final int stepX;
    final int stepY;
    double sideX;
    double sideY;
    if (rx < 0) {
      stepX = -1;
      sideX = (ox - mapX * cellSize) / -rx;
    } else {
      stepX = 1;
      sideX = ((mapX + 1) * cellSize - ox) / rx;
    }
    if (ry < 0) {
      stepY = -1;
      sideY = (oy - mapY * cellSize) / -ry;
    } else {
      stepY = 1;
      sideY = ((mapY + 1) * cellSize - oy) / ry;
    }

    bool sideNS = false;
    CellKind hit = CellKind.empty;
    // Safety cap
    const int maxSteps = 64;
    for (var i = 0; i < maxSteps; i++) {
      if (sideX < sideY) {
        sideX += deltaX;
        mapX += stepX;
        sideNS = false;
      } else {
        sideY += deltaY;
        mapY += stepY;
        sideNS = true;
      }
      hit = grid.cellAt(mapX, mapY);
      if (hit.solid) break;
    }
    if (!hit.solid) {
      return _RayHit(
        distance: 1e9,
        cell: CellKind.empty,
        sectionId: null,
        wallU: 0,
        sideNS: false,
      );
    }

    // Perpendicular distance (avoids fish-eye)
    final double perp;
    final double wallU;
    if (!sideNS) {
      final dx = (mapX * cellSize + (stepX == 1 ? 0 : cellSize) - ox) / rx;
      perp = dx;
      // Wall U = fractional y at hit point
      final hitY = oy + dx * ry;
      wallU = ((hitY % cellSize) / cellSize).clamp(0, 0.9999);
    } else {
      final dy = (mapY * cellSize + (stepY == 1 ? 0 : cellSize) - oy) / ry;
      perp = dy;
      final hitX = ox + dy * rx;
      wallU = ((hitX % cellSize) / cellSize).clamp(0, 0.9999);
    }

    return _RayHit(
      distance: perp,
      cell: hit,
      sectionId: grid.sectionAt(mapX, mapY),
      wallU: wallU,
      sideNS: sideNS,
    );
  }

  // ----- draw a single vertical strip -----
  void _drawColumn(
    Canvas canvas,
    int colIndex,
    int totalColumns,
    double w,
    double h,
    double horizon,
    _RayHit hit,
    double rayAngle,
    double facing,
  ) {
    // Corrected distance (already perpendicular). Convert to screen height.
    final d = math.max(hit.distance, 0.1);
    // Project the top of a wall of world height into screen pixels.
    // height_on_screen = (worldHeight * focal) / d
    // focal derived from viewport + FOV.
    final focal = (w / 2) / math.tan(_fov / 2);
    final wallWorldH = hit.cell.height;
    final stripH = (wallWorldH * focal) / d;
    // Cells are anchored with their base at horizon + (cameraHeight * focal / d)
    const cameraHeight = 90.0; // eye level above floor
    final baseY = horizon + (cameraHeight * focal) / d;
    final topY = baseY - stripH;

    // Pick a texture
    final tex = atlas.textureFor(hit.cell, hit.sectionId);
    final texW = tex.width.toDouble();
    final texCol = (hit.wallU * texW).floor().clamp(0, tex.width - 1);

    // Source rect: one pixel column of the texture
    final src = Rect.fromLTWH(texCol.toDouble(), 0, 1, tex.height.toDouble());
    final dst = Rect.fromLTWH(
      colIndex * _pixelStep,
      topY,
      _pixelStep + 0.5,
      baseY - topY,
    );
    // Per-side shading (N/S faces slightly darker for definition)
    final shade = hit.sideNS ? 0.78 : 1.0;
    // Distance-based darkening (fog)
    final distFog = (1 / (1 + d / 800)).clamp(0.15, 1.0);
    final fade = shade * distFog;
    final paint = Paint()
      ..filterQuality = FilterQuality.none
      ..colorFilter = ColorFilter.mode(
        Color.fromRGBO(0, 0, 0, (1 - fade).clamp(0, 1)),
        BlendMode.darken,
      );
    canvas.drawImageRect(tex, src, dst, paint);
  }

  // ----- sprite billboards -----
  /// Collects every billboard-worthy entity in view, sorts by distance
  /// descending, and draws each with per-column z-test against the wall
  /// depth buffer.
  void _drawSprites(
    Canvas canvas,
    StoreWorld world,
    double camX,
    double camY,
    double facing,
    Cart cart,
    CartDef cartDef,
    ShelfSlot? focused,
    double w,
    double h,
    double horizon,
  ) {
    final candidates = <_Billboard>[];

    // NPCs
    for (final n in world.npcs) {
      if (n.consumed) continue;
      if (n.def.id == 'spill' || n.def.id == 'grapes') continue;
      candidates.add(_Billboard(
        x: n.x,
        y: n.y,
        image: sprites.npc(n.def.id),
        worldSize: sprites.worldSizeFor('npc_${n.def.id}'),
        groundAnchor: 1.0,
      ));
    }

    // Parked cart
    if (cart.state == CartState.parked) {
      candidates.add(_Billboard(
        x: cart.x,
        y: cart.y,
        image: sprites.parkedCart(cartDef.id),
        worldSize: sprites.worldSizeFor('cart_${cartDef.id}'),
        groundAnchor: 1.0,
      ));
    }

    // Currently-focused shelf item (draws in front of the shelf wall so
    // the player sees what they're about to grab).
    if (focused != null && !focused.empty) {
      candidates.add(_Billboard(
        x: focused.position.dx,
        y: focused.position.dy,
        image: sprites.item(focused.item.id),
        worldSize: sprites.worldSizeFor('item_${focused.item.id}'),
        groundAnchor: 0.55, // floats at shelf mid-height
        tint: const Color(0x33FFD166),
      ));
    }

    if (candidates.isEmpty) return;

    // Transform to camera space (+X = forward) so we can sort by depth
    final cosA = math.cos(-facing);
    final sinA = math.sin(-facing);
    for (final b in candidates) {
      final dx = b.x - camX;
      final dy = b.y - camY;
      b.relX = dx * cosA - dy * sinA;
      b.relY = dx * sinA + dy * cosA;
    }
    candidates.removeWhere((b) => b.relX <= 1); // cull behind camera
    candidates.sort((a, c) => c.relX.compareTo(a.relX));

    final focal = (w / 2) / math.tan(_fov / 2);
    const cameraHeight = 90.0;

    for (final b in candidates) {
      final rx = b.relX;
      final ry = b.relY;
      final screenX = w / 2 + (ry * focal) / rx;
      final screenSize = (b.worldSize * focal) / rx;
      if (screenSize < 2) continue;

      // Billboard base sits on the ground plane at this depth.
      final baseY = horizon + (cameraHeight * focal) / rx;
      // Ground anchor = 1.0 means full-height sprite standing on baseY;
      // 0.55 means mid-shelf floater (shifted up).
      final topY = baseY - screenSize * b.groundAnchor - screenSize * (1 - b.groundAnchor) * 0.5;
      final leftX = screenX - screenSize / 2;

      final cols = (w / _pixelStep).ceil();
      final firstCol = math.max(0, (leftX / _pixelStep).floor());
      final lastCol = math.min(cols - 1, ((leftX + screenSize) / _pixelStep).ceil());
      if (firstCol >= lastCol) continue;

      final img = b.image;
      final texW = img.width.toDouble();
      final texH = img.height.toDouble();
      final tintPaint = b.tint != null
          ? (Paint()
            ..colorFilter = ui.ColorFilter.mode(b.tint!, BlendMode.srcATop)
            ..filterQuality = FilterQuality.none)
          : (Paint()..filterQuality = FilterQuality.none);

      for (var col = firstCol; col <= lastCol; col++) {
        // Depth test vs wall buffer — skip if a wall is closer.
        if (col < _zBuffer.length && rx >= _zBuffer[col]) continue;
        final sx = col * _pixelStep;
        final u = (sx - leftX) / screenSize;
        if (u < 0 || u > 1) continue;
        final texCol = (u * texW).floor().clamp(0, texW.toInt() - 1);
        final src = Rect.fromLTWH(texCol.toDouble(), 0, 1, texH);
        final dst = Rect.fromLTWH(sx, topY, _pixelStep + 0.5, screenSize);
        canvas.drawImageRect(img, src, dst, tintPaint);
      }

      // Grab highlight halo (under the focused item)
      if (b.tint != null) {
        canvas.drawCircle(
          Offset(screenX, baseY - screenSize * 0.3),
          screenSize * 0.55,
          Paint()
            ..color = const Color(0xFFE05B3F).withValues(alpha: 0.18)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
        );
      }
    }
  }

  // ----- foreground cart -----
  /// A simplified cart silhouette drawn in the bottom third, giving the
  /// "I'm pushing this" feel. Sways with head bob.
  void _drawForegroundCart(
    Canvas canvas,
    double w,
    double h,
    double horizon,
    CartDef def,
    Cart cart,
    Player player,
  ) {
    if (cart.state == CartState.parked) return;
    // Heading lag: when player turns, cart swings behind. Positive diff =
    // player turned right, cart leans right relative to camera.
    final headingDiff = _shortestAngle(cartDisplayHeading - player.facing);
    // Positive pitch (acceleration) pushes the cart away from camera (smaller
    // apparent), negative (brake) pulls it closer and downward.
    final pitch = cartPitchOffset;
    final sway = math.sin(_bobPhase * 2) * 4 + headingDiff * 80;
    final pitchY = pitch * 12; // brake: cart drops in view; accel: cart lifts
    final cx = w / 2 + sway;
    final basketTop = h * (0.72 - pitch * 0.015) + pitchY;
    final basketBot = h + 20 + pitchY;
    final basketNear = w * 0.45;
    final basketFar = w * 0.28;

    final path = Path()
      ..moveTo(cx - basketNear, basketBot)
      ..lineTo(cx + basketNear, basketBot)
      ..lineTo(cx + basketFar, basketTop)
      ..lineTo(cx - basketFar, basketTop)
      ..close();
    canvas.drawPath(path, Paint()..color = Colors.black.withValues(alpha: 0.28));

    // Fill with cart color + gradient
    canvas.drawPath(
      path,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color.lerp(def.color, Colors.white, 0.15)!,
            def.color,
            Color.lerp(def.color, Colors.black, 0.18)!,
          ],
        ).createShader(Rect.fromLTWH(0, basketTop, w, basketBot - basketTop)),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
    // Wire mesh
    final mesh = Paint()
      ..color = Colors.white.withValues(alpha: 0.28)
      ..strokeWidth = 1.5;
    for (var i = 1; i < 6; i++) {
      final t = i / 6;
      final xt = cx - basketFar + basketFar * 2 * t;
      final xb = cx - basketNear + basketNear * 2 * t;
      canvas.drawLine(Offset(xt, basketTop), Offset(xb, basketBot), mesh);
    }
    // Cross mesh
    for (var i = 1; i < 3; i++) {
      final t = i / 3;
      final y = basketTop + (basketBot - basketTop) * t;
      final halfAtY = basketFar + (basketNear - basketFar) * t;
      canvas.drawLine(Offset(cx - halfAtY, y), Offset(cx + halfAtY, y), mesh);
    }
    // Handle grip bar
    final gripY = basketTop - 18;
    canvas.drawLine(
      Offset(cx - basketFar - 12, gripY),
      Offset(cx + basketFar + 12, gripY),
      Paint()
        ..color = const Color(0xFFB8BEC6)
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawLine(
      Offset(cx - basketFar, gripY + 4),
      Offset(cx + basketFar, gripY + 4),
      Paint()
        ..color = const Color(0xFFE05B3F)
        ..strokeWidth = 10
        ..strokeCap = StrokeCap.round,
    );
  }

  double _shortestAngle(double d) {
    var x = d % (2 * math.pi);
    if (x > math.pi) x -= 2 * math.pi;
    if (x < -math.pi) x += 2 * math.pi;
    return x;
  }

  void _drawCrosshair(Canvas canvas, double w, double horizon, bool active) {
    final cx = w / 2;
    final color = active
        ? const Color(0xFFE05B3F)
        : Colors.white.withValues(alpha: 0.45);
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
        Offset(cx - 6, horizon), Offset(cx - 2, horizon), paint);
    canvas.drawLine(
        Offset(cx + 2, horizon), Offset(cx + 6, horizon), paint);
    canvas.drawLine(
        Offset(cx, horizon - 6), Offset(cx, horizon - 2), paint);
    canvas.drawLine(
        Offset(cx, horizon + 2), Offset(cx, horizon + 6), paint);
  }
}

/// Scratch data for a single billboard under render. Mutable so we can
/// write back the camera-space coords after the transform pass.
class _Billboard {
  _Billboard({
    required this.x,
    required this.y,
    required this.image,
    required this.worldSize,
    this.groundAnchor = 1.0,
    this.tint,
  });
  final double x;
  final double y;
  final ui.Image image;
  final double worldSize;
  /// Anchor point along the sprite's height where the ground is assumed to
  /// be. 1.0 = feet on the ground, 0.5 = centred (floating), 0.0 = anchored
  /// by top.
  final double groundAnchor;
  final Color? tint;
  double relX = 0;
  double relY = 0;
}
