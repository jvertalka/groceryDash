import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

/// Procedurally-generated sound effects. No external audio files —
/// samples are synthesized once at boot as 16-bit PCM WAV blobs in memory
/// and played via [audioplayers] with a [BytesSource].
///
/// Each call site (footstep, pickup, thud, …) is rate-limited so rapid
/// events don't machine-gun audio.
///
/// Notes:
///   - On web, the first sound has to wait for a user gesture (browser
///     autoplay policy). Since the Start button on the title screen is
///     always tapped, that unlocks the context in practice.
///   - Errors from the player are swallowed — we never want audio to break
///     the game loop (e.g. under test or on unsupported platforms).
class GameAudio {
  GameAudio._();
  static final GameAudio instance = GameAudio._();

  final Map<String, Uint8List> _samples = {};
  final Map<String, AudioPlayer> _players = {};
  final Map<String, DateTime> _lastFired = {};
  bool _initialised = false;
  bool _disabled = false;

  /// Call once during game onLoad. Generates every sample and warms up
  /// an AudioPlayer per sample key.
  Future<void> init() async {
    if (_initialised || _disabled) return;
    _initialised = true;
    try {
      _samples['wheel'] = _synth(
        freq: 140, duration: 0.08, attack: 0.002, decay: 0.05,
        wave: _WaveShape.square, amp: 0.18,
      );
      _samples['footstep'] = _synth(
        freq: 95, duration: 0.08, attack: 0.002, decay: 0.07,
        wave: _WaveShape.noise, amp: 0.35,
      );
      _samples['thud'] = _synth(
        freq: 110, duration: 0.22, attack: 0.001, decay: 0.2,
        wave: _WaveShape.sine, amp: 0.55,
      );
      _samples['pickup'] = _synth(
        freq: 880, duration: 0.13, attack: 0.004, decay: 0.11,
        wave: _WaveShape.sine, amp: 0.35, sweepTo: 1320,
      );
      _samples['park'] = _synth(
        freq: 220, duration: 0.18, attack: 0.002, decay: 0.16,
        wave: _WaveShape.square, amp: 0.3,
      );
      _samples['beep'] = _synth(
        freq: 1320, duration: 0.06, attack: 0.003, decay: 0.05,
        wave: _WaveShape.square, amp: 0.25,
      );
      _samples['thief'] = _synth(
        freq: 520, duration: 0.32, attack: 0.004, decay: 0.3,
        wave: _WaveShape.square, amp: 0.3, sweepTo: 340,
      );
      _samples['speech'] = _synth(
        freq: 480, duration: 0.07, attack: 0.002, decay: 0.06,
        wave: _WaveShape.square, amp: 0.15, sweepTo: 560,
      );
      _samples['contest'] = _synth(
        freq: 260, duration: 0.2, attack: 0.005, decay: 0.18,
        wave: _WaveShape.square, amp: 0.3, sweepTo: 420,
      );
      for (final key in _samples.keys) {
        final p = AudioPlayer();
        await p.setReleaseMode(ReleaseMode.stop);
        _players[key] = p;
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Audio init failed: $e');
      _disabled = true;
    }
  }

  Future<void> _fire(String key,
      {double volume = 1.0, Duration? minGap}) async {
    if (_disabled || !_initialised) return;
    if (minGap != null) {
      final now = DateTime.now();
      final last = _lastFired[key];
      if (last != null && now.difference(last) < minGap) return;
      _lastFired[key] = now;
    }
    final bytes = _samples[key];
    final player = _players[key];
    if (bytes == null || player == null) return;
    try {
      await player.stop();
      await player.setVolume(volume.clamp(0.0, 1.0));
      await player.play(BytesSource(bytes));
    } catch (_) {
      // ignore — audio should never break the run
    }
  }

  // --- public hooks (preserved signatures) ---
  void wheelSqueak({required double speed}) {
    _fire('wheel',
        volume: (speed / 260).clamp(0.1, 0.6),
        minGap: const Duration(milliseconds: 240));
  }

  void footstep({double intensity = 1.0}) {
    _fire('footstep',
        volume: (0.4 + intensity * 0.3).clamp(0.0, 1.0),
        minGap: const Duration(milliseconds: 320));
  }

  void thud({double intensity = 1.0}) {
    _fire('thud',
        volume: (0.5 + intensity * 0.5).clamp(0.2, 1.0),
        minGap: const Duration(milliseconds: 160));
  }

  void pickupChime() {
    _fire('pickup',
        volume: 0.8, minGap: const Duration(milliseconds: 120));
  }

  void parkClunk() {
    _fire('park', volume: 0.9);
  }

  void scannerBeep() {
    _fire('beep',
        volume: 0.9, minGap: const Duration(milliseconds: 220));
  }

  void thiefWarning() {
    _fire('thief',
        volume: 1.0, minGap: const Duration(milliseconds: 1200));
  }

  /// Short blip when an NPC says a line.
  void speechBlip() {
    _fire('speech',
        volume: 0.5, minGap: const Duration(milliseconds: 250));
  }

  /// Sting that opens an item contest.
  void contestOpen() {
    _fire('contest', volume: 0.8);
  }

  // ============================================================
  //  Synth — 22.05kHz mono, 16-bit PCM, wrapped in a minimal WAV.
  // ============================================================

  Uint8List _synth({
    required double freq,
    required double duration,
    required double attack,
    required double decay,
    required _WaveShape wave,
    double amp = 0.4,
    double? sweepTo,
  }) {
    const sampleRate = 22050;
    final numSamples = (duration * sampleRate).toInt();
    final pcm = Int16List(numSamples);
    final rng = math.Random(42);
    for (var i = 0; i < numSamples; i++) {
      final t = i / sampleRate;
      // Envelope: short attack ramp + exponential-ish decay
      double env;
      if (t < attack) {
        env = t / attack;
      } else {
        final rel = (t - attack) / math.max(decay, 1e-4);
        env = math.exp(-rel * 4);
      }
      // Optional pitch sweep
      final f = sweepTo != null
          ? freq + (sweepTo - freq) * (t / duration)
          : freq;
      double s;
      switch (wave) {
        case _WaveShape.sine:
          s = math.sin(2 * math.pi * f * t);
        case _WaveShape.square:
          s = math.sin(2 * math.pi * f * t) >= 0 ? 1.0 : -1.0;
        case _WaveShape.noise:
          s = rng.nextDouble() * 2 - 1;
      }
      final sample = s * env * amp;
      pcm[i] = (sample * 32767).clamp(-32767, 32767).toInt();
    }
    return _wrapWav(pcm.buffer.asUint8List(), sampleRate);
  }

  Uint8List _wrapWav(Uint8List pcmBytes, int sampleRate) {
    final dataLen = pcmBytes.length;
    final totalLen = 44 + dataLen;
    final out = BytesBuilder();
    void u32(int v) {
      out.add([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]);
    }

    void u16(int v) {
      out.add([v & 0xFF, (v >> 8) & 0xFF]);
    }

    out.add('RIFF'.codeUnits);
    u32(totalLen - 8);
    out.add('WAVE'.codeUnits);
    out.add('fmt '.codeUnits);
    u32(16);           // subchunk1 size
    u16(1);            // PCM
    u16(1);            // mono
    u32(sampleRate);
    u32(sampleRate * 2); // byte rate (1 channel × 2 bytes/sample)
    u16(2);            // block align
    u16(16);           // bits per sample
    out.add('data'.codeUnits);
    u32(dataLen);
    out.add(pcmBytes);
    return out.toBytes();
  }
}

enum _WaveShape { sine, square, noise }
