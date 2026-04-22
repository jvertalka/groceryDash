import 'package:shared_preferences/shared_preferences.dart';

import '../game/data/carts.dart';

/// Thin persistence wrapper for coin balance, unlocked carts, selected cart,
/// and high score. Keeps the game loop ignorant of storage details.
class PlayerStorage {
  PlayerStorage._(this._prefs);

  static const _coinsKey = 'gd_coins';
  static const _highScoreKey = 'gd_high_score';
  static const _selectedCartKey = 'gd_selected_cart';
  static const _unlockedCartsKey = 'gd_unlocked_carts';

  final SharedPreferences _prefs;

  static Future<PlayerStorage> load() async {
    final prefs = await SharedPreferences.getInstance();
    final s = PlayerStorage._(prefs);
    // Seed default cart unlock on first run.
    if (!s.unlockedCarts.contains(kDefaultCartId)) {
      await s.unlockCart(kDefaultCartId);
      await s.selectCart(kDefaultCartId);
    }
    return s;
  }

  int get coins => _prefs.getInt(_coinsKey) ?? 0;
  int get highScore => _prefs.getInt(_highScoreKey) ?? 0;
  String get selectedCartId =>
      _prefs.getString(_selectedCartKey) ?? kDefaultCartId;
  List<String> get unlockedCarts =>
      _prefs.getStringList(_unlockedCartsKey) ?? const [];

  Future<void> addCoins(int amount) async {
    await _prefs.setInt(_coinsKey, coins + amount);
  }

  Future<bool> spendCoins(int amount) async {
    if (coins < amount) return false;
    await _prefs.setInt(_coinsKey, coins - amount);
    return true;
  }

  Future<void> maybeUpdateHighScore(int score) async {
    if (score > highScore) {
      await _prefs.setInt(_highScoreKey, score);
    }
  }

  Future<void> unlockCart(String cartId) async {
    final set = {...unlockedCarts, cartId}.toList();
    await _prefs.setStringList(_unlockedCartsKey, set);
  }

  Future<void> selectCart(String cartId) async {
    await _prefs.setString(_selectedCartKey, cartId);
  }
}
