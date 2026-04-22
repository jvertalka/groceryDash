import 'package:flutter/material.dart';

enum ItemRarity { common, rare, fragile, utility }

/// Visual silhouette category used by the sprite renderer. Changes how the
/// item draws on shelves — bottles stand tall with caps, boxes are chunky
/// rectangles with label bands, bags have zig-zag tops, etc.
enum ItemShape {
  bottle,   // tall, domed cap + label band
  carton,   // milk/oj carton with slanted top
  can,      // short cylinder with rim
  box,      // chunky rectangle with big label
  bag,      // rounded squashy shape with zig-zag top
  tray,     // flat meat/deli tray
  produce,  // fruit/veg — emoji-first, soft round shape
  round,    // cake/pizza — circle from side
  bouquet,  // flowers — triangle of colour
  wedge,    // cheese — triangle block
}

class ItemDef {
  final String id;
  final String name;
  final String emoji;
  final Color color;
  final int score;
  final int coin;
  final ItemRarity rarity;
  final ItemShape shape;

  const ItemDef({
    required this.id,
    required this.name,
    required this.emoji,
    required this.color,
    required this.score,
    required this.coin,
    required this.rarity,
    required this.shape,
  });
}

// 30 items spanning the MVP pool.
const List<ItemDef> kItems = [
  // Dairy / cold
  ItemDef(id: 'milk', name: 'Milk', emoji: '🥛', color: Color(0xFFF2F2F2),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.carton),
  ItemDef(id: 'oj', name: 'Orange Juice', emoji: '🍊', color: Color(0xFFE89B3C),
      score: 6, coin: 1, rarity: ItemRarity.common, shape: ItemShape.carton),
  ItemDef(id: 'eggs', name: 'Eggs', emoji: '🥚', color: Color(0xFFF5ECD7),
      score: 8, coin: 2, rarity: ItemRarity.fragile, shape: ItemShape.carton),

  // Boxes
  ItemDef(id: 'cereal', name: 'Cereal', emoji: '🥣', color: Color(0xFFE0B040),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.box),
  ItemDef(id: 'candy', name: 'Candy', emoji: '🍬', color: Color(0xFFE86A92),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.box),
  ItemDef(id: 'tissues', name: 'Tissues', emoji: '🧻', color: Color(0xFFF5F5F5),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.box),
  ItemDef(id: 'pizza', name: 'Frozen Pizza', emoji: '🍕', color: Color(0xFFD2690E),
      score: 7, coin: 1, rarity: ItemRarity.common, shape: ItemShape.box),
  ItemDef(id: 'batteries', name: 'Batteries', emoji: '🔋', color: Color(0xFF5D7B8C),
      score: 6, coin: 1, rarity: ItemRarity.common, shape: ItemShape.box),

  // Bags
  ItemDef(id: 'bread', name: 'Bread', emoji: '🍞', color: Color(0xFFD9A066),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bag),
  ItemDef(id: 'chips', name: 'Chips', emoji: '🍟', color: Color(0xFFE5C07B),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bag),
  ItemDef(id: 'popcorn', name: 'Popcorn', emoji: '🍿', color: Color(0xFFF4E1A1),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bag),
  ItemDef(id: 'charcoal', name: 'Charcoal', emoji: '⬛', color: Color(0xFF2E2E2E),
      score: 6, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bag),
  ItemDef(id: 'tp', name: 'Toilet Paper', emoji: '🧻', color: Color(0xFFEFEFEF),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bag),
  ItemDef(id: 'tortilla', name: 'Tortillas', emoji: '🌮', color: Color(0xFFDFBB7A),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bag),

  // Bottles / cans
  ItemDef(id: 'soda', name: 'Soda', emoji: '🥤', color: Color(0xFF8B3A3A),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bottle),
  ItemDef(id: 'water', name: 'Water', emoji: '💧', color: Color(0xFF6BB3E8),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bottle),
  ItemDef(id: 'mustard', name: 'Mustard', emoji: '🟡', color: Color(0xFFE8B104),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.bottle),
  ItemDef(id: 'soup', name: 'Soup Can', emoji: '🥫', color: Color(0xFFB03A48),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.can),
  ItemDef(id: 'energy', name: 'Energy Drink', emoji: '⚡', color: Color(0xFF4FB477),
      score: 7, coin: 1, rarity: ItemRarity.common, shape: ItemShape.can),
  ItemDef(id: 'salsa', name: 'Salsa', emoji: '🌶️', color: Color(0xFFC0392B),
      score: 6, coin: 1, rarity: ItemRarity.common, shape: ItemShape.can),
  ItemDef(id: 'ramen', name: 'Ramen', emoji: '🍜', color: Color(0xFFDFA95A),
      score: 6, coin: 1, rarity: ItemRarity.common, shape: ItemShape.can),

  // Produce
  ItemDef(id: 'apple', name: 'Apple', emoji: '🍎', color: Color(0xFFD64545),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.produce),
  ItemDef(id: 'banana', name: 'Banana', emoji: '🍌', color: Color(0xFFE8C547),
      score: 5, coin: 1, rarity: ItemRarity.common, shape: ItemShape.produce),

  // Trays / deli
  ItemDef(id: 'beef', name: 'Ground Beef', emoji: '🥩', color: Color(0xFFA83A3A),
      score: 7, coin: 1, rarity: ItemRarity.common, shape: ItemShape.tray),
  ItemDef(id: 'hotdog', name: 'Hot Dogs', emoji: '🌭', color: Color(0xFFC47650),
      score: 6, coin: 1, rarity: ItemRarity.common, shape: ItemShape.tray),
  ItemDef(id: 'icecream', name: 'Ice Cream', emoji: '🍦', color: Color(0xFFF8D6CE),
      score: 7, coin: 1, rarity: ItemRarity.common, shape: ItemShape.tray),

  // Specialties
  ItemDef(id: 'cheese', name: 'Cheese', emoji: '🧀', color: Color(0xFFE8B64C),
      score: 6, coin: 1, rarity: ItemRarity.common, shape: ItemShape.wedge),
  ItemDef(id: 'flowers', name: 'Flowers', emoji: '💐', color: Color(0xFFE86A92),
      score: 8, coin: 2, rarity: ItemRarity.fragile, shape: ItemShape.bouquet),
  ItemDef(id: 'cake', name: 'Birthday Cake', emoji: '🎂', color: Color(0xFFF6B5CC),
      score: 20, coin: 5, rarity: ItemRarity.rare, shape: ItemShape.round),
  ItemDef(id: 'lobster', name: 'Lobster', emoji: '🦞', color: Color(0xFFD64545),
      score: 25, coin: 6, rarity: ItemRarity.rare, shape: ItemShape.tray),
];

ItemDef itemById(String id) => kItems.firstWhere((i) => i.id == id);
