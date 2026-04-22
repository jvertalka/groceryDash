import 'data/items.dart';
import 'data/obstacles.dart';

/// Immutable snapshot of a completed shopping trip for the receipt screen.
class RunResult {
  final int score;
  final int coinsEarned;
  final Duration duration;
  final List<ItemDef> basket;
  final List<Object> completedCombos; // retained for API compat; always []
  final ObstacleDef? crashCause;
  final String basketIdentity;
  final bool isNewHighScore;
  final int fragilesBroken;

  const RunResult({
    required this.score,
    required this.coinsEarned,
    required this.duration,
    required this.basket,
    required this.completedCombos,
    required this.crashCause,
    required this.basketIdentity,
    required this.isNewHighScore,
    this.fragilesBroken = 0,
  });
}
