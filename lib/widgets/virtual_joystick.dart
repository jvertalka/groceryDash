import 'dart:math' as math;

import 'package:flutter/material.dart';

/// An on-screen virtual joystick. Reports a normalized `(dx, dy)` vector in
/// `[-1, 1]` both axes. Drag the inner knob from the base centre; farther =
/// faster. Call `onChange(Offset.zero)` is sent when released.
///
/// Place at the bottom of the screen on a touch-friendly layer; on desktop
/// the same touches work via mouse.
class VirtualJoystick extends StatefulWidget {
  const VirtualJoystick({
    super.key,
    required this.onChange,
    this.radius = 68,
    this.knobRadius = 30,
  });

  /// Called whenever the stick moves. Vector magnitude <= 1.
  final void Function(Offset vector) onChange;
  final double radius;
  final double knobRadius;

  @override
  State<VirtualJoystick> createState() => _VirtualJoystickState();
}

class _VirtualJoystickState extends State<VirtualJoystick> {
  Offset _center = Offset.zero; // absolute touch origin
  Offset _knob = Offset.zero;   // relative to base centre
  bool _active = false;

  void _startAt(Offset localPos) {
    setState(() {
      _center = localPos;
      _knob = Offset.zero;
      _active = true;
    });
    widget.onChange(Offset.zero);
  }

  void _updateTo(Offset localPos) {
    var d = localPos - _center;
    final len = d.distance;
    if (len > widget.radius) {
      d = d * (widget.radius / len);
    }
    setState(() => _knob = d);
    widget.onChange(Offset(d.dx / widget.radius, d.dy / widget.radius));
  }

  void _end() {
    setState(() {
      _knob = Offset.zero;
      _active = false;
    });
    widget.onChange(Offset.zero);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onPanStart: (d) => _startAt(d.localPosition),
      onPanUpdate: (d) => _updateTo(d.localPosition),
      onPanEnd: (_) => _end(),
      onPanCancel: _end,
      child: CustomPaint(
        painter: _JoystickPainter(
          active: _active,
          center: _center,
          knob: _knob,
          radius: widget.radius,
          knobRadius: widget.knobRadius,
        ),
        child: const SizedBox.expand(),
      ),
    );
  }
}

class _JoystickPainter extends CustomPainter {
  _JoystickPainter({
    required this.active,
    required this.center,
    required this.knob,
    required this.radius,
    required this.knobRadius,
  });

  final bool active;
  final Offset center;
  final Offset knob;
  final double radius;
  final double knobRadius;

  @override
  void paint(Canvas canvas, Size size) {
    if (!active) {
      // "Rest" hint: faint joystick at bottom-left
      final hintCenter = Offset(radius + 24, size.height - radius - 24);
      canvas.drawCircle(
        hintCenter,
        radius,
        Paint()..color = Colors.white.withValues(alpha: 0.18),
      );
      canvas.drawCircle(
        hintCenter,
        radius,
        Paint()
          ..color = Colors.white.withValues(alpha: 0.5)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
      canvas.drawCircle(
        hintCenter,
        knobRadius,
        Paint()..color = Colors.white.withValues(alpha: 0.65),
      );
      return;
    }
    // Live base ring at the user's touch origin
    canvas.drawCircle(
      center,
      radius,
      Paint()..color = Colors.white.withValues(alpha: 0.2),
    );
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
    // Directional arrow from base centre to knob
    if (knob.distance > 4) {
      final paint = Paint()
        ..color = Colors.white.withValues(alpha: 0.8)
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(center, center + knob, paint);
    }
    // Knob
    canvas.drawCircle(
      center + knob,
      knobRadius,
      Paint()..color = const Color(0xFFE05B3F),
    );
    canvas.drawCircle(
      center + knob,
      knobRadius,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(covariant _JoystickPainter old) =>
      old.active != active || old.knob != knob || old.center != center;
}

/// Helper that keeps the knob from jittering from tiny input noise.
Offset deadzone(Offset v, [double min = 0.08]) {
  if (v.distance < min) return Offset.zero;
  return v;
}

/// Rotate a normalized joystick vector by an angle (radians). Not currently
/// used but useful if we later support rotated camera modes.
Offset rotateJoystick(Offset v, double angle) {
  final cos = math.cos(angle);
  final sin = math.sin(angle);
  return Offset(v.dx * cos - v.dy * sin, v.dx * sin + v.dy * cos);
}
