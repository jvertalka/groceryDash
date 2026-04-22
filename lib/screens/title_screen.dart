import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../services/player_storage.dart';
import '../ui/design.dart';
import 'menu_screen.dart';

/// Title screen: one hero moment. Typography-led, single subtle ambient
/// motion (gentle horizontal parallax on a minimal cart silhouette). No
/// glow, no pulse, no floating emoji. Tap anywhere advances.
class TitleScreen extends StatefulWidget {
  const TitleScreen({super.key, required this.storage});
  final PlayerStorage storage;

  @override
  State<TitleScreen> createState() => _TitleScreenState();
}

class _TitleScreenState extends State<TitleScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 18),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _go() {
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 260),
        pageBuilder: (context, a, b) => MenuScreen(storage: widget.storage),
        transitionsBuilder: (context, anim, b, child) {
          return FadeTransition(opacity: anim, child: child);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTokens.surface,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _go,
        child: SafeArea(
          child: Stack(
            children: [
              // Decorative cart drifting across the lower third. Calm, slow,
              // stays in the background.
              Positioned.fill(
                child: IgnorePointer(
                  child: AnimatedBuilder(
                    animation: _ctrl,
                    builder: (ctx, child) => CustomPaint(
                      painter: _AmbientCartPainter(t: _ctrl.value),
                    ),
                  ),
                ),
              ),

              // Top row — high score chip, quietly.
              Padding(
                padding: const EdgeInsets.all(AppTokens.s5),
                child: Align(
                  alignment: Alignment.topRight,
                  child: widget.storage.highScore > 0
                      ? AppChip(
                          label: 'BEST',
                          value: widget.storage.highScore.toString(),
                        )
                      : const SizedBox.shrink(),
                ),
              ),

              // Centered hero content
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppTokens.s6),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Spacer(),
                    Text(
                      'Grocery',
                      style: AppText.displayL(color: AppTokens.ink)
                          .copyWith(height: 0.95),
                    ),
                    Text(
                      'Dash.',
                      style: AppText.displayL(color: AppTokens.accent)
                          .copyWith(
                        fontSize: 64,
                        height: 0.95,
                      ),
                    ),
                    const SizedBox(height: AppTokens.s4),
                    Text(
                      'Navigate the aisles. Build a chaotic basket.',
                      textAlign: TextAlign.center,
                      style: AppText.bodyL(color: AppTokens.inkDim),
                    ),
                    const Spacer(),
                    const Spacer(),
                  ],
                ),
              ),

              // Bottom action
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTokens.s6,
                  vertical: AppTokens.s6,
                ),
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AppPrimaryButton(
                        label: 'Start',
                        onPressed: _go,
                        expand: true,
                      ),
                      const SizedBox(height: AppTokens.s3),
                      Text(
                        'Tap anywhere to begin',
                        style: AppText.caption(color: AppTokens.inkSubtle),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Quiet horizon of ambient drifting shapes. A single muted cart silhouette
/// moves slowly across the lower band; a few neutral "aisle" marks provide
/// visual rhythm. Nothing pulses or flashes.
class _AmbientCartPainter extends CustomPainter {
  _AmbientCartPainter({required this.t});
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final bandTop = size.height * 0.58;
    final bandBottom = size.height * 0.78;
    // Horizon line — very faint.
    final horizonPaint = Paint()..color = AppTokens.divider;
    canvas.drawRect(
      Rect.fromLTWH(0, bandBottom - 1, size.width, 1),
      horizonPaint,
    );

    // Faint aisle vertical ticks stretching across
    final tickPaint = Paint()
      ..color = AppTokens.surfaceMuted
      ..strokeWidth = 2;
    const tickCount = 6;
    for (var i = 0; i < tickCount; i++) {
      final x = size.width * (i + 0.5) / tickCount;
      canvas.drawLine(
        Offset(x, bandTop + 12),
        Offset(x, bandBottom - 8),
        tickPaint,
      );
    }

    // Drifting cart silhouette — single slow sweep.
    final cartX = ((t * 0.6) % 1.0) * (size.width + 180) - 90;
    final cartY = (bandTop + bandBottom) / 2 - 6;
    _paintSilhouette(canvas, cartX, cartY);
  }

  void _paintSilhouette(Canvas canvas, double cx, double cy) {
    final paint = Paint()..color = AppTokens.ink.withValues(alpha: 0.06);
    // Basket body
    final body = Rect.fromCenter(center: Offset(cx, cy), width: 80, height: 44);
    canvas.drawRRect(
      RRect.fromRectAndRadius(body, const Radius.circular(8)),
      paint,
    );
    // Handle post
    canvas.drawLine(
      Offset(cx - 40, cy - 22),
      Offset(cx - 54, cy - 40),
      Paint()
        ..color = AppTokens.ink.withValues(alpha: 0.06)
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round,
    );
    // Wheels
    final wheel = Paint()..color = AppTokens.ink.withValues(alpha: 0.08);
    canvas.drawCircle(Offset(cx - 28, cy + 28), 7, wheel);
    canvas.drawCircle(Offset(cx + 28, cy + 28), 7, wheel);
    // soft ground shadow
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(cx, cy + 36),
          width: 92, height: 10),
      Paint()..color = AppTokens.ink.withValues(alpha: 0.03),
    );
    // Decorative "speed lines" (very faint, a single pair)
    final streak = Paint()..color = AppTokens.ink.withValues(alpha: 0.04);
    for (var i = 0; i < 2; i++) {
      final dx = 80 + i * 20.0;
      final y = cy - 4 + i * 8;
      canvas.drawRect(Rect.fromLTWH(cx + dx, y, 26, 2), streak);
    }
    // Unused math import keeps lints quiet if we add wobble later.
    math.pi;
  }

  @override
  bool shouldRepaint(covariant _AmbientCartPainter old) => old.t != t;
}
