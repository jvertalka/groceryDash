import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/sections.dart';
import '../world/grid_world.dart';

/// Procedurally generates and caches small bitmap textures for raycaster
/// walls. Each texture is rendered once into a [ui.ui.Image] so the raycaster
/// can sample columns with [Canvas.drawui.ImageRect].
///
/// Design note: real textures (from an artist or an asset store) would drop
/// in by replacing the per-section builders with `await decodeui.ImageFromList`
/// calls. The rest of the render path is the same.
class TextureAtlas {
  TextureAtlas._();

  /// Keyed by `cellKind|sectionId|side` where side is N/S/E/W of the
  /// hit face, or a single key if the texture is isotropic.
  final Map<String, ui.Image> _images = {};

  static const int kTextureSize = 64;

  /// Build a complete atlas for the current store. Call once during onLoad.
  static Future<TextureAtlas> build() async {
    final atlas = TextureAtlas._();
    await atlas._generate();
    return atlas;
  }

  ui.Image textureFor(CellKind kind, String? sectionId) {
    final key = '${kind.name}|${sectionId ?? ''}';
    final img = _images[key];
    if (img != null) return img;
    return _images[kind.name] ?? _images.values.first;
  }

  Future<void> _generate() async {
    // Each texture tries an asset file first; falls back to the procedural
    // builder. Drop `assets/textures/<name>.png` files into the project to
    // replace any of these with real art.
    _images['wall'] =
        await _loadOrBuild('wall', () => _buildWall());
    _images['counter'] =
        await _loadOrBuild('counter', () => _buildCounter());
    _images['produceBin'] =
        await _loadOrBuild('produceBin', () => _buildProduceBin());
    _images['fridge'] =
        await _loadOrBuild('fridge', () => _buildFridge());
    for (final section in kSections) {
      final key = 'shelf|${section.id}';
      _images[key] = await _loadOrBuild(
        'shelf_${section.id}',
        () => _buildShelf(section),
      );
    }
    _images['shelf'] = _images['shelf|${kSections.first.id}']!;
  }

  /// Try to load a texture from `assets/textures/<name>.png`; if the asset
  /// doesn't exist or fails to decode, fall back to the procedural builder.
  Future<ui.Image> _loadOrBuild(
      String name, Future<ui.Image> Function() build) async {
    final asset = await _tryAsset('assets/textures/$name.png');
    if (asset != null) return asset;
    return build();
  }

  Future<ui.Image?> _tryAsset(String path) async {
    try {
      final data = await rootBundle.load(path);
      final codec =
          await ui.instantiateImageCodec(data.buffer.asUint8List());
      final frame = await codec.getNextFrame();
      return frame.image;
    } catch (_) {
      return null;
    }
  }

  Future<ui.Image> _buildWall() async {
    return _render((canvas, size) {
      // Warm painted cinderblock: beige base + horizontal mortar lines
      canvas.drawRect(
          Rect.fromLTWH(0, 0, size, size),
          Paint()..color = const Color(0xFFC8B996));
      final mortar = Paint()..color = const Color(0xFF8A7B5C);
      for (var y = 0.0; y < size; y += 14) {
        canvas.drawRect(Rect.fromLTWH(0, y, size, 1.5), mortar);
      }
      // Vertical mortar offset per row
      for (var row = 0; row < size / 14; row++) {
        final offset = (row.isEven ? 0.0 : 20.0);
        for (var x = offset; x < size; x += 40) {
          canvas.drawRect(
              Rect.fromLTWH(x, row * 14.0, 1.5, 14), mortar);
        }
      }
      // Subtle vignette
      canvas.drawRect(
        Rect.fromLTWH(0, 0, size, size),
        Paint()
          ..shader = RadialGradient(
            colors: [
              Colors.transparent,
              Colors.black.withValues(alpha: 0.15),
            ],
            stops: const [0.7, 1.0],
          ).createShader(Rect.fromLTWH(0, 0, size, size)),
      );
    });
  }

  Future<ui.Image> _buildShelf(SectionDef section) async {
    return _render((canvas, size) {
      // Base backboard in the section's muted wall tone
      canvas.drawRect(Rect.fromLTWH(0, 0, size, size),
          Paint()..color = section.wallColor);
      // Three shelf rows with coloured product blocks
      const rows = 3;
      final rowH = size / rows;
      final plank = Paint()..color = const Color(0xFF6E5A3C);
      final rng = math.Random(section.id.hashCode);
      final palette = [
        section.accentColor,
        const Color(0xFFE55A45),
        const Color(0xFF4AA3DF),
        const Color(0xFFE5B04A),
        const Color(0xFF4CAF7A),
        const Color(0xFFB04A7C),
      ];
      for (var r = 0; r < rows; r++) {
        final y = r * rowH;
        // Plank
        canvas.drawRect(
            Rect.fromLTWH(0, y + rowH - 4, size, 3), plank);
        // Product blocks
        var x = 2.0;
        while (x < size - 4) {
          final w = 6 + rng.nextInt(6).toDouble();
          final h = (rowH - 8) * (0.55 + rng.nextDouble() * 0.4);
          final col = palette[rng.nextInt(palette.length)];
          final rect = Rect.fromLTWH(
              x, y + rowH - 4 - h, w, h);
          canvas.drawRect(rect, Paint()..color = col);
          canvas.drawRect(
              rect,
              Paint()
                ..color = Colors.black.withValues(alpha: 0.3)
                ..style = PaintingStyle.stroke
                ..strokeWidth = 0.6);
          x += w + 1.5;
        }
      }
    });
  }

  Future<ui.Image> _buildFridge() async {
    return _render((canvas, size) {
      // Cool blue glass with frost streaks + door handle
      canvas.drawRect(
        Rect.fromLTWH(0, 0, size, size),
        Paint()
          ..shader = const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFE2F1F8), Color(0xFFB0D0DC)],
          ).createShader(Rect.fromLTWH(0, 0, size, size)),
      );
      // Frost particles
      final rng = math.Random(7);
      final frost = Paint()..color = Colors.white.withValues(alpha: 0.7);
      for (var i = 0; i < 18; i++) {
        canvas.drawCircle(
            Offset(rng.nextDouble() * size, rng.nextDouble() * size),
            0.5 + rng.nextDouble() * 1.5,
            frost);
      }
      // Door frame
      canvas.drawRect(
          Rect.fromLTWH(0, 0, size, size),
          Paint()
            ..color = const Color(0xFF6A7B85)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2);
      // Handle
      canvas.drawRect(
          Rect.fromLTWH(size - 6, size * 0.4, 2.5, size * 0.25),
          Paint()..color = const Color(0xFF9BB0BD));
    });
  }

  Future<ui.Image> _buildProduceBin() async {
    return _render((canvas, size) {
      canvas.drawRect(Rect.fromLTWH(0, 0, size, size),
          Paint()..color = const Color(0xFFC68642));
      final plank = Paint()..color = const Color(0xFF8A5E2F);
      for (var y = 12.0; y < size; y += 14) {
        canvas.drawRect(Rect.fromLTWH(0, y, size, 1.5), plank);
      }
      // Vertical slats
      for (var x = 0.0; x < size; x += 10) {
        canvas.drawRect(Rect.fromLTWH(x, 0, 1, size),
            Paint()..color = Colors.black.withValues(alpha: 0.18));
      }
    });
  }

  Future<ui.Image> _buildCounter() async {
    return _render((canvas, size) {
      canvas.drawRect(Rect.fromLTWH(0, 0, size, size),
          Paint()..color = const Color(0xFFB9A984));
      // Conveyor stripe
      canvas.drawRect(
          Rect.fromLTWH(0, size * 0.45, size, size * 0.15),
          Paint()..color = const Color(0xFF2A2A2A));
      // Metal edge
      canvas.drawRect(
          Rect.fromLTWH(0, 0, size, 3),
          Paint()..color = const Color(0xFF8A7A58));
    });
  }

  static Future<ui.Image> _render(
      void Function(Canvas canvas, double size) paint) async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    paint(canvas, kTextureSize.toDouble());
    final picture = recorder.endRecording();
    return picture.toImage(kTextureSize, kTextureSize);
  }
}
