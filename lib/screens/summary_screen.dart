import 'package:flutter/material.dart';

import '../game/data/carts.dart';
import '../game/data/modes.dart';
import '../game/run_result.dart';
import '../services/player_storage.dart';
import '../ui/design.dart';
import 'game_screen.dart';
import 'menu_screen.dart';

/// Receipt-style summary. One hero statistic at the top, a clean itemised
/// list of everything the player bought, then secondary metadata. No joke
/// headlines. Designed as a satisfying recap, not a punchline.
class SummaryScreen extends StatelessWidget {
  const SummaryScreen({
    super.key,
    required this.result,
    required this.storage,
    required this.cart,
    required this.mode,
    required this.camera,
  });

  final RunResult result;
  final PlayerStorage storage;
  final GameMode mode;
  final CameraMode camera;
  final CartDef cart;

  @override
  Widget build(BuildContext context) {
    // Aggregate basket by item id
    final counts = <String, int>{};
    for (final it in result.basket) {
      counts[it.id] = (counts[it.id] ?? 0) + 1;
    }
    final grouped = counts.entries.map((e) {
      final item = result.basket.firstWhere((it) => it.id == e.key);
      return _ReceiptLine(name: item.name, qty: e.value, price: item.score);
    }).toList();

    final itemsTotal =
        grouped.fold<int>(0, (sum, r) => sum + r.qty * r.price);

    return Scaffold(
      backgroundColor: AppTokens.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppTokens.s5,
            AppTokens.s4,
            AppTokens.s5,
            AppTokens.s5,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Header(identity: result.basketIdentity),
              const SizedBox(height: AppTokens.s5),
              Expanded(
                child: _ReceiptCard(
                  lines: grouped,
                  subtotal: itemsTotal,
                  earnedCoins: result.coinsEarned,
                  newBest: result.isNewHighScore,
                  score: result.score,
                  duration: result.duration,
                ),
              ),
              const SizedBox(height: AppTokens.s4),
              Row(
                children: [
                  Expanded(
                    child: _SecondaryButton(
                      label: 'Menu',
                      onTap: () {
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(
                            builder: (_) => MenuScreen(storage: storage),
                          ),
                          (r) => false,
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: AppTokens.s3),
                  Expanded(
                    flex: 2,
                    child: AppPrimaryButton(
                      label: 'Again',
                      expand: true,
                      onPressed: () {
                        Navigator.of(context).pushReplacement(
                          MaterialPageRoute(
                            builder: (_) => GameScreen(
                              storage: storage,
                              cart: cart,
                              mode: mode,
                              camera: camera,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.identity});
  final String identity;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Receipt', style: AppText.labelXS()),
        const SizedBox(height: 4),
        Text(identity, style: AppText.displayM()),
      ],
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  const _ReceiptCard({
    required this.lines,
    required this.subtotal,
    required this.earnedCoins,
    required this.newBest,
    required this.score,
    required this.duration,
  });
  final List<_ReceiptLine> lines;
  final int subtotal;
  final int earnedCoins;
  final bool newBest;
  final int score;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return AppSurface(
      padding: const EdgeInsets.all(AppTokens.s4),
      elevation: 1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('GROCERY DASH',
                  style: AppText.labelXS(color: AppTokens.ink)),
              const Spacer(),
              Text(_timeOf(duration),
                  style: AppText.labelXS(color: AppTokens.inkDim)),
            ],
          ),
          const SizedBox(height: AppTokens.s2),
          const _DottedDivider(),
          const SizedBox(height: AppTokens.s2),
          if (lines.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppTokens.s4),
              child: Text(
                'Empty-handed run.',
                style: AppText.bodyM(),
              ),
            )
          else
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  for (final line in lines)
                    _ReceiptRow(line: line),
                ],
              ),
            ),
          const _DottedDivider(),
          const SizedBox(height: AppTokens.s2),
          _TotalRow(label: 'Subtotal', value: subtotal.toString()),
          _TotalRow(label: 'Coins earned', value: '+$earnedCoins'),
          const SizedBox(height: AppTokens.s2),
          Row(
            children: [
              Text('SCORE', style: AppText.labelXS()),
              const Spacer(),
              Text(
                score.toString(),
                style: AppText.displayM(
                  color: newBest ? AppTokens.accent : AppTokens.ink,
                ),
              ),
            ],
          ),
          if (newBest) ...[
            const SizedBox(height: 4),
            Text(
              'New personal best',
              style: AppText.bodyM(color: AppTokens.accent),
            ),
          ],
        ],
      ),
    );
  }

  static String _timeOf(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds.remainder(60);
    return '${m}m ${s.toString().padLeft(2, '0')}s';
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({required this.line});
  final _ReceiptLine line;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            child: Text(
              '×${line.qty}',
              style: AppText.bodyM(color: AppTokens.inkDim),
            ),
          ),
          Expanded(
            child: Text(line.name, style: AppText.bodyL()),
          ),
          Text(
            (line.qty * line.price).toString(),
            style: AppText.numericM(),
          ),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text(label, style: AppText.bodyM()),
          const Spacer(),
          Text(value, style: AppText.numericM()),
        ],
      ),
    );
  }
}

class _DottedDivider extends StatelessWidget {
  const _DottedDivider();
  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DotPainter(),
      child: const SizedBox(height: 2),
    );
  }
}

class _DotPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = AppTokens.divider;
    const dot = 2.0;
    const gap = 3.0;
    var x = 0.0;
    while (x < size.width) {
      canvas.drawCircle(Offset(x, size.height / 2), dot / 2, paint);
      x += dot + gap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

class _SecondaryButton extends StatelessWidget {
  const _SecondaryButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppTokens.rMd),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.rMd),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppTokens.surfaceElevated,
            borderRadius: BorderRadius.circular(AppTokens.rMd),
            border: Border.all(color: AppTokens.divider),
          ),
          child: Text(label, style: AppText.titleL(color: AppTokens.ink)),
        ),
      ),
    );
  }
}

class _ReceiptLine {
  _ReceiptLine({required this.name, required this.qty, required this.price});
  final String name;
  final int qty;
  final int price;
}
