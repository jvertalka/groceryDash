import 'dart:math' as math;

import 'package:flutter/foundation.dart';

/// A PA-style announcement displayed at the top of the HUD. Flavour can be
/// driven by events from the game (flash sale triggered, stocker placed a
/// pallet, manager notice) or a rotating pool of ambient one-liners.
class StoreAnnouncement {
  StoreAnnouncement({required this.text, this.tone = AnnouncementTone.info});
  final String text;
  final AnnouncementTone tone;
}

enum AnnouncementTone { info, sale, warning }

/// Owns a queue of pending announcements + a currently-playing one.
/// Exposes a [ValueListenable] the HUD can watch.
class AnnouncementQueue {
  final ValueNotifier<StoreAnnouncement?> current = ValueNotifier(null);

  final math.Random _rng;
  final List<StoreAnnouncement> _queue = [];
  double _remaining = 0;      // seconds the current line still has on screen
  double _coolDown = 6.0;     // gap before next ambient fires

  AnnouncementQueue({int? seed}) : _rng = math.Random(seed);

  /// Push an event-driven announcement to the front of the queue. Fires
  /// sooner than the ambient cadence.
  void push(StoreAnnouncement a) {
    _queue.insert(0, a);
  }

  /// Called each frame. Handles hold time and the gap before the next one.
  void tick(double dt) {
    if (_remaining > 0) {
      _remaining -= dt;
      if (_remaining <= 0) {
        current.value = null;
        _coolDown = 4 + _rng.nextDouble() * 4;
      }
      return;
    }
    _coolDown -= dt;
    if (_coolDown <= 0) {
      final next = _queue.isNotEmpty ? _queue.removeAt(0) : _ambient();
      current.value = next;
      _remaining = 4.0;
    }
  }

  /// Ambient line pool — quiet store noise.
  StoreAnnouncement _ambient() {
    final pool = _ambientLines;
    return StoreAnnouncement(
      text: pool[_rng.nextInt(pool.length)],
    );
  }

  void dispose() {
    current.dispose();
  }

  static const List<String> _ambientLines = [
    'Attention shoppers — our deli is serving fresh today.',
    'Reminder: please return carts to the corral.',
    'Thank you for shopping with us.',
    'Our floral department has spring arrangements available.',
    'Price check on aisle three, please.',
    'The store will be closing in… some amount of time.',
    'Receipts are required for all exchanges.',
    'Customer service is located near the front entrance.',
  ];
}
