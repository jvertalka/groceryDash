import 'package:flutter/foundation.dart';

/// Central audio hook surface. No assets are bundled yet — these methods
/// are call sites so the game logic already fires the right events. When
/// real audio is dropped in (e.g. via `flame_audio` or `audioplayers`),
/// only the body of each method changes.
///
/// Usage:
///   GameAudio.instance.footstep();
///   GameAudio.instance.wheelSqueak(speed: 0.8);
///
/// Each call is rate-limited to avoid machine-gunning sounds on high-tick
/// events.
class GameAudio {
  GameAudio._();
  static final GameAudio instance = GameAudio._();

  final Map<String, DateTime> _lastFired = {};

  bool _rateLimited(String key, Duration minGap) {
    final now = DateTime.now();
    final last = _lastFired[key];
    if (last != null && now.difference(last) < minGap) return true;
    _lastFired[key] = now;
    return false;
  }

  /// Player cart rolling — pitched by speed. Called continuously while
  /// the cart is moving; rate-limited internally.
  void wheelSqueak({required double speed}) {
    if (_rateLimited('wheel', const Duration(milliseconds: 260))) return;
    _log('wheel (speed=${speed.toStringAsFixed(1)})');
  }

  /// Single footstep on-foot; pitched by player speed.
  void footstep({double intensity = 1.0}) {
    if (_rateLimited('footstep', const Duration(milliseconds: 320))) return;
    _log('footstep (intensity=${intensity.toStringAsFixed(1)})');
  }

  /// Collision thud — cart or player hit an obstacle.
  void thud({double intensity = 1.0}) {
    if (_rateLimited('thud', const Duration(milliseconds: 180))) return;
    _log('thud ($intensity)');
  }

  /// Item dropped off shelf into cart. Short confirmation chime.
  void pickupChime() {
    if (_rateLimited('pickup', const Duration(milliseconds: 120))) return;
    _log('pickup chime');
  }

  /// Cart parked. Little clunk + rolling-to-stop.
  void parkClunk() {
    _log('park clunk');
  }

  /// Checkout barcode scanner beep.
  void scannerBeep() {
    if (_rateLimited('beep', const Duration(milliseconds: 250))) return;
    _log('scanner beep');
  }

  /// Warning chirp when cart is unattended and a thief is approaching.
  void thiefWarning() {
    if (_rateLimited('thief', const Duration(milliseconds: 1200))) return;
    _log('thief warning');
  }

  void _log(String event) {
    if (kDebugMode) {
      // Silent placeholder — flip to debugPrint when debugging.
    }
  }
}
