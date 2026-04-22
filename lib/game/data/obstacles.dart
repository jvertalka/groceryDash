import 'package:flutter/material.dart';

class ObstacleDef {
  final String id;
  final String name;
  final String emoji;
  final Color color;
  final double widthLanes; // how many lanes it occupies (1 or 2)

  const ObstacleDef({
    required this.id,
    required this.name,
    required this.emoji,
    required this.color,
    this.widthLanes = 1,
  });
}

const List<ObstacleDef> kObstacles = [
  ObstacleDef(id: 'beans', name: 'Bean Pyramid', emoji: '🥫', color: Color(0xFFB04A2E)),
  ObstacleDef(id: 'display', name: 'Cardboard Display', emoji: '📦', color: Color(0xFFC68642)),
  ObstacleDef(id: 'watermelon', name: 'Watermelon Bin', emoji: '🍉', color: Color(0xFF4CAF50)),
  ObstacleDef(id: 'spill', name: 'Wet Floor', emoji: '💦', color: Color(0xFF7EC8E3)),
  ObstacleDef(id: 'cart', name: 'Runaway Cart', emoji: '🛒', color: Color(0xFF9E9E9E)),
  ObstacleDef(id: 'shopper', name: 'Slow Shopper', emoji: '🧓', color: Color(0xFF8E7CC3)),
  ObstacleDef(id: 'kid', name: 'Running Kid', emoji: '🧒', color: Color(0xFFEB8A50)),
  ObstacleDef(id: 'mop', name: 'Mop Bucket', emoji: '🪣', color: Color(0xFF4A6FA5)),
  ObstacleDef(id: 'stocker', name: 'Stock Clerk', emoji: '👷', color: Color(0xFFE0A638)),
  ObstacleDef(id: 'grapes', name: 'Spilled Grapes', emoji: '🍇', color: Color(0xFF7B2E8A)),
];
