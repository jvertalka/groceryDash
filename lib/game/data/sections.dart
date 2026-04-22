import 'package:flutter/material.dart';

/// Visual + behavioural style for a shelf row within a section.
enum ShelfStyle {
  woodenCrates, // produce
  bakeryShelf,  // bakery — warm brown with bread
  deliCounter,  // deli — glass front with meats/cheeses
  coolerFridge, // dairy — white fridge
  freezerCase,  // frozen — white/blue with frost
  snackRack,    // snacks & drinks — colourful rack
  warehouseShelf, // household — tall grey shelving
}

/// A themed region of the store. Seven stacked horizontally in world space.
/// Each owns its own palette, shelf style, floor tile colour, and an item
/// pool biased toward products that belong here (e.g. produce in Produce).
class SectionDef {
  final String id;
  final String name;
  final String emoji;
  final ShelfStyle shelfStyle;
  final Color floorTintA;
  final Color floorTintB;
  final Color wallColor;
  final Color accentColor;
  final List<String> itemIdsPrimary;
  final List<String> itemIdsSecondary;

  const SectionDef({
    required this.id,
    required this.name,
    required this.emoji,
    required this.shelfStyle,
    required this.floorTintA,
    required this.floorTintB,
    required this.wallColor,
    required this.accentColor,
    required this.itemIdsPrimary,
    this.itemIdsSecondary = const [],
  });
}

const List<SectionDef> kSections = [
  SectionDef(
    id: 'produce',
    name: 'Produce',
    emoji: '🥬',
    shelfStyle: ShelfStyle.woodenCrates,
    floorTintA: Color(0xFFEDE3C6),
    floorTintB: Color(0xFFD8CC9E),
    wallColor: Color(0xFFB7D8A3),
    accentColor: Color(0xFF4AA35A),
    itemIdsPrimary: ['apple', 'banana', 'oj'],
    itemIdsSecondary: ['flowers'],
  ),
  SectionDef(
    id: 'bakery',
    name: 'Bakery',
    emoji: '🥖',
    shelfStyle: ShelfStyle.bakeryShelf,
    floorTintA: Color(0xFFF4E9CE),
    floorTintB: Color(0xFFDEC692),
    wallColor: Color(0xFFD9A066),
    accentColor: Color(0xFF8C5A2B),
    itemIdsPrimary: ['bread', 'cake'],
    itemIdsSecondary: ['popcorn', 'candy'],
  ),
  SectionDef(
    id: 'deli',
    name: 'Deli',
    emoji: '🧀',
    shelfStyle: ShelfStyle.deliCounter,
    floorTintA: Color(0xFFEEE5D2),
    floorTintB: Color(0xFFD4C8A8),
    wallColor: Color(0xFFE8C06D),
    accentColor: Color(0xFFB03A48),
    itemIdsPrimary: ['cheese', 'beef', 'hotdog', 'lobster'],
  ),
  SectionDef(
    id: 'dairy',
    name: 'Dairy',
    emoji: '🥛',
    shelfStyle: ShelfStyle.coolerFridge,
    floorTintA: Color(0xFFE7EEF3),
    floorTintB: Color(0xFFC9D7E0),
    wallColor: Color(0xFFCBE3EF),
    accentColor: Color(0xFF3D8AB0),
    itemIdsPrimary: ['milk', 'eggs', 'cheese'],
  ),
  SectionDef(
    id: 'frozen',
    name: 'Frozen',
    emoji: '🧊',
    shelfStyle: ShelfStyle.freezerCase,
    floorTintA: Color(0xFFDEECF2),
    floorTintB: Color(0xFFB4CFDB),
    wallColor: Color(0xFF9BC4DA),
    accentColor: Color(0xFF2F6D8A),
    itemIdsPrimary: ['icecream', 'pizza'],
    itemIdsSecondary: ['ramen'],
  ),
  SectionDef(
    id: 'snacks',
    name: 'Snacks & Drinks',
    emoji: '🍿',
    shelfStyle: ShelfStyle.snackRack,
    floorTintA: Color(0xFFF3E7D2),
    floorTintB: Color(0xFFDDCBA4),
    wallColor: Color(0xFFE5B04A),
    accentColor: Color(0xFFD64545),
    itemIdsPrimary: ['chips', 'soda', 'candy', 'popcorn'],
    itemIdsSecondary: ['energy', 'cereal'],
  ),
  SectionDef(
    id: 'household',
    name: 'Household',
    emoji: '🧻',
    shelfStyle: ShelfStyle.warehouseShelf,
    floorTintA: Color(0xFFE8E4D9),
    floorTintB: Color(0xFFCAC3B0),
    wallColor: Color(0xFFB0ABA0),
    accentColor: Color(0xFF5D7B8C),
    itemIdsPrimary: ['batteries', 'tp', 'tissues', 'water'],
    itemIdsSecondary: ['mustard', 'salsa'],
  ),
];

SectionDef sectionById(String id) =>
    kSections.firstWhere((s) => s.id == id);

/// Index into kSections from a world-x coordinate (each section is 1600px).
const double kSectionWidth = 1600;
int sectionIndexFor(double worldX) {
  final i = (worldX / kSectionWidth).floor().clamp(0, kSections.length - 1);
  return i;
}
