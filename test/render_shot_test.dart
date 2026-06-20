// Headless render harness — NOT a real test. Drives the actual
// FirstPersonRenderer with the actual TextureAtlas and writes PNG frames to
// build/shots/. Used to capture before/after screenshots of the wall art.
//
// Run with:  flutter test test/render_shot_test.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:grocery_dash/game/data/carts.dart';
import 'package:grocery_dash/game/entities.dart';
import 'package:grocery_dash/game/rendering/first_person_renderer.dart';
import 'package:grocery_dash/game/rendering/sprite_atlas.dart';
import 'package:grocery_dash/game/rendering/textures.dart';
import 'package:grocery_dash/game/world/grid_world.dart';
import 'package:grocery_dash/game/world/store_world.dart';

void main() {
  testWidgets('capture first-person frames', (tester) async {
    await tester.runAsync(() async {
      const size = Size(960, 540);
      final atlas = await TextureAtlas.build();
      final sprites = await SpriteAtlas.build();
      final world = StoreWorld(seed: 1);
      world.populate();
      final grid = GridWorld.fromLayout(world.layout);
      final cartDef = kCarts.firstWhere((c) => c.id == kDefaultCartId);

      final renderer = FirstPersonRenderer(
        viewport: size,
        atlas: atlas,
        sprites: sprites,
      );

      Future<void> shot(String name, double px, double py, double facing) async {
        final player = Player(x: px, y: py)..facing = facing;
        final cart = Cart(x: px, y: py + 30)..heading = facing;
        final recorder = ui.PictureRecorder();
        final canvas = Canvas(recorder,
            Rect.fromLTWH(0, 0, size.width, size.height));
        renderer.render(canvas, world, grid, player, cart, cartDef, null);
        final picture = recorder.endRecording();
        final img =
            await picture.toImage(size.width.toInt(), size.height.toInt());
        final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
        final dir = Directory('build/shots');
        if (!dir.existsSync()) dir.createSync(recursive: true);
        File('build/shots/$name.png')
            .writeAsBytesSync(bytes!.buffer.asUint8List());
      }

      // Looking north at the produce crates with the north perimeter wall
      // behind/above them — shows produceBin + wall textures together.
      await shot('produce', 200, 300, -3.14159 / 2);
      // Looking north at a checkout counter — shows the counter texture.
      await shot('counter', 240, 1520, -3.14159 / 2);
      // Looking up an open centre aisle — best shows the tiled floor receding.
      await shot('aisle', 540, 1180, -3.14159 / 2);
    });
  });
}
