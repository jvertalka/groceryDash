import 'package:flutter_test/flutter_test.dart';

import 'package:grocery_dash/game/data/items.dart';
import 'package:grocery_dash/game/data/sections.dart';
import 'package:grocery_dash/game/entities.dart';
import 'package:grocery_dash/game/rendering/emoji_cache.dart';
import 'package:grocery_dash/game/world/store_world.dart';

void main() {
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
