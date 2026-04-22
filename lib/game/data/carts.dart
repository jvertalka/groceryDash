import 'package:flutter/material.dart';

class CartDef {
  final String id;
  final String name;
  final String emoji;
  final Color color;
  final int unlockCost; // 0 = unlocked by default
  final String tagline;

  const CartDef({
    required this.id,
    required this.name,
    required this.emoji,
    required this.color,
    required this.unlockCost,
    required this.tagline,
  });
}

const List<CartDef> kCarts = [
  CartDef(id: 'rusty', name: 'Rusty Cart', emoji: '🛒',
      color: Color(0xFFB0B0B0), unlockCost: 0,
      tagline: 'Squeaks ominously.'),
  CartDef(id: 'race', name: 'Kid Race Cart', emoji: '🏎️',
      color: Color(0xFFE05B3F), unlockCost: 50,
      tagline: 'Built for speed. And tantrums.'),
];

const String kDefaultCartId = 'rusty';
