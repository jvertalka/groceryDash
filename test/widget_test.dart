import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:grocery_dash/game/data/items.dart';
import 'package:grocery_dash/game/data/sections.dart';
import 'package:grocery_dash/game/entities.dart';
import 'package:grocery_dash/game/rendering/emoji_cache.dart';
import 'package:grocery_dash/game/world/store_world.dart';

void main() {
  // The procedural fallback builds 64x64 textures (TextureAtlas.kTextureSize).
  // Real dropped-in art is 256x256, so a 256px decode proves the asset is
  // actually bundled and wins over the procedural builder.
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final slot in const ['wall', 'produceBin', 'counter', 'floor']) {
    test('real $slot texture asset loads (256px, not procedural fallback)',
        () async {
      final data = await rootBundle.load('assets/textures/$slot.png');
      final codec =
          await ui.instantiateImageCodec(data.buffer.asUint8List());
      final frame = await codec.getNextFrame();
      expect(frame.image.width, 256, reason: '$slot.png should be real art');
      expect(frame.image.height, 256);
    });
  }

  test('item ids are unique', () {
    final ids = kItems.map((i) => i.id).toList();
    expect(ids.toSet().length, ids.length);
  });

  test('every section references items in the catalogue', () {
    final known = kItems.map((i) => i.id).toSet();
    for (final section in kSections) {
      for (final id in section.itemIdsPrimary) {
        expect(known, contains(id), reason: '${section.id} references $id');
      }
      for (final id in section.itemIdsSecondary) {
        expect(known, contains(id), reason: '${section.id} references $id');
      }
    }
  });

  test('fragile items exist and are scored higher than commons', () {
    final fragiles =
        kItems.where((i) => i.rarity == ItemRarity.fragile).toList();
    expect(fragiles, isNotEmpty);
    expect(fragiles.every((f) => f.coin >= 2), isTrue);
  });

  test('emoji cache reuses the same Paragraph for repeated keys', () {
    final a = EmojiCache.instance.get('🍎', 24);
    final b = EmojiCache.instance.get('🍎', 24);
    expect(identical(a, b), isTrue);
  });

  test('StoreWorld.populate builds a non-empty shelf index', () {
    final world = StoreWorld(seed: 1);
    world.populate();
    expect(world.shelfIndex.slots, isNotEmpty);
    expect(world.checkouts, isNotEmpty);
  });

  test('ShoppingList recount reflects cart contents', () {
    final apple = kItems.firstWhere((i) => i.id == 'apple');
    final banana = kItems.firstWhere((i) => i.id == 'banana');
    final list = ShoppingList([
      ShoppingListEntry(item: apple, needed: 2),
      ShoppingListEntry(item: banana, needed: 1),
    ]);
    final cart = Cart(x: 0, y: 0);
    cart.addItem(apple);
    cart.addItem(apple);
    cart.addItem(banana);
    list.recount(cart);
    expect(list.allComplete, isTrue);
    expect(list.completeCount, 2);
  });
}
