import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Central design tokens. Keep these restrained — any growth here should be
/// deliberate and documented. Screens should never hard-code colors, font
/// sizes, spacing, or radii; they pull from this file.
class AppTokens {
  AppTokens._();

  // --- Surface palette (warm neutrals) ---
  static const Color surface = Color(0xFFF6EFE0);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFEFE5D2);

  // --- Ink (text) ---
  static const Color ink = Color(0xFF231A10);
  static const Color inkDim = Color(0xFF6A5A47);
  static const Color inkSubtle = Color(0xFFA89A84);

  // --- Accents — one primary, one secondary. No more. ---
  static const Color accent = Color(0xFFE05B3F);
  static const Color accentSoft = Color(0xFFFAD9CD);
  static const Color secondary = Color(0xFFD89F3B);

  // --- Semantic ---
  static const Color positive = Color(0xFF4A9A5E);
  static const Color warning = Color(0xFFD89F3B);
  static const Color danger = Color(0xFFCC4A3F);

  // --- Divider ---
  static const Color divider = Color(0xFFE7DDC6);
  static const Color overlayScrim = Color(0x1A23140A);

  // --- Spacing (4-point scale) ---
  static const double s1 = 4;
  static const double s2 = 8;
  static const double s3 = 12;
  static const double s4 = 16;
  static const double s5 = 20;
  static const double s6 = 24;
  static const double s7 = 32;
  static const double s8 = 48;

  // --- Corner radius ---
  static const double rSm = 8;
  static const double rMd = 12;
  static const double rLg = 20;
  static const double rXl = 28;
  static const double rPill = 999;

  // --- Elevation (restrained shadows) ---
  static final List<BoxShadow> elev1 = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      offset: const Offset(0, 1),
      blurRadius: 2,
    ),
  ];
  static final List<BoxShadow> elev2 = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      offset: const Offset(0, 2),
      blurRadius: 6,
    ),
  ];
  static final List<BoxShadow> elev3 = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.08),
      offset: const Offset(0, 4),
      blurRadius: 12,
    ),
  ];
}

/// Typographic ramp. One typeface (Inter) at controlled weights. Letter-
/// spacing is used sparingly — only on small labels where tracking aids
/// legibility.
class AppText {
  AppText._();

  static TextStyle _inter({
    required double size,
    required FontWeight weight,
    double? height,
    double? tracking,
    Color color = AppTokens.ink,
  }) {
    return GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      height: height,
      letterSpacing: tracking,
      color: color,
    );
  }

  // Display: main hero
  static TextStyle displayL({Color color = AppTokens.ink}) =>
      _inter(size: 44, weight: FontWeight.w800, height: 1.0, color: color,
          tracking: -1.2);
  static TextStyle displayM({Color color = AppTokens.ink}) =>
      _inter(size: 32, weight: FontWeight.w800, height: 1.05, color: color,
          tracking: -0.6);

  // Headlines
  static TextStyle headlineL({Color color = AppTokens.ink}) =>
      _inter(size: 24, weight: FontWeight.w700, height: 1.15, color: color);
  static TextStyle headlineM({Color color = AppTokens.ink}) =>
      _inter(size: 20, weight: FontWeight.w700, height: 1.2, color: color);

  // Titles (card titles, chips)
  static TextStyle titleL({Color color = AppTokens.ink}) =>
      _inter(size: 17, weight: FontWeight.w700, height: 1.25, color: color);
  static TextStyle titleM({Color color = AppTokens.ink}) =>
      _inter(size: 15, weight: FontWeight.w700, height: 1.3, color: color);

  // Body
  static TextStyle bodyL({Color color = AppTokens.ink}) =>
      _inter(size: 15, weight: FontWeight.w500, height: 1.4, color: color);
  static TextStyle bodyM({Color color = AppTokens.inkDim}) =>
      _inter(size: 13, weight: FontWeight.w500, height: 1.4, color: color);

  // Caption / label
  static TextStyle caption({Color color = AppTokens.inkDim}) =>
      _inter(size: 12, weight: FontWeight.w500, color: color);
  static TextStyle labelXS({Color color = AppTokens.inkSubtle}) =>
      _inter(
        size: 11,
        weight: FontWeight.w700,
        tracking: 1.4,
        color: color,
      );

  // Numeric — tabular-like weight for HUD readouts
  static TextStyle numericL({Color color = AppTokens.ink}) =>
      _inter(size: 20, weight: FontWeight.w800, color: color,
          tracking: -0.3);
  static TextStyle numericM({Color color = AppTokens.ink}) =>
      _inter(size: 16, weight: FontWeight.w700, color: color);
}

/// Reusable building blocks — kept small. Each corresponds to a tight
/// visual pattern. Screens compose these rather than inventing their own.
class AppSurface extends StatelessWidget {
  const AppSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppTokens.s4),
    this.radius = AppTokens.rLg,
    this.color = AppTokens.surfaceElevated,
    this.elevation = 1,
    this.border = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color color;
  final int elevation;
  final bool border;

  @override
  Widget build(BuildContext context) {
    final shadows = switch (elevation) {
      1 => AppTokens.elev1,
      2 => AppTokens.elev2,
      3 => AppTokens.elev3,
      _ => const <BoxShadow>[],
    };
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
        border: border
            ? Border.all(color: AppTokens.divider, width: 1)
            : null,
        boxShadow: shadows,
      ),
      child: child,
    );
  }
}

/// Tight, understated primary button — no glow, no pulse. Terracotta fill,
/// white text, subtle press depression.
class AppPrimaryButton extends StatefulWidget {
  const AppPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.leading,
    this.expand = false,
  });

  final String label;
  final VoidCallback onPressed;
  final Widget? leading;
  final bool expand;

  @override
  State<AppPrimaryButton> createState() => _AppPrimaryButtonState();
}

class _AppPrimaryButtonState extends State<AppPrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final button = GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        padding: EdgeInsets.symmetric(
          vertical: _pressed ? 14 : 16,
          horizontal: AppTokens.s6,
        ),
        decoration: BoxDecoration(
          color: _pressed
              ? const Color(0xFFC94226)
              : AppTokens.accent,
          borderRadius: BorderRadius.circular(AppTokens.rMd),
          boxShadow: _pressed
              ? AppTokens.elev1
              : AppTokens.elev2,
        ),
        child: Row(
          mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (widget.leading != null) ...[
              widget.leading!,
              const SizedBox(width: AppTokens.s2),
            ],
            Text(
              widget.label,
              style: AppText.titleL(color: Colors.white),
            ),
          ],
        ),
      ),
    );
    return widget.expand
        ? SizedBox(width: double.infinity, child: button)
        : button;
  }
}

/// Quiet chip used for HUD readouts, best-score badges, etc. Single style.
class AppChip extends StatelessWidget {
  const AppChip({
    super.key,
    required this.label,
    this.value,
    this.icon,
    this.dense = false,
    this.tone = AppChipTone.neutral,
  });

  final String label;
  final String? value;
  final Widget? icon;
  final bool dense;
  final AppChipTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, labelColor) = switch (tone) {
      AppChipTone.neutral => (
        AppTokens.surfaceMuted,
        AppTokens.ink,
        AppTokens.inkDim,
      ),
      AppChipTone.accent => (
        AppTokens.accentSoft,
        AppTokens.accent,
        AppTokens.accent,
      ),
      AppChipTone.dark => (
        AppTokens.ink.withValues(alpha: 0.08),
        AppTokens.ink,
        AppTokens.inkDim,
      ),
    };
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? AppTokens.s2 : AppTokens.s3,
        vertical: dense ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppTokens.rPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            icon!,
            SizedBox(width: dense ? AppTokens.s1 : AppTokens.s2),
          ],
          Text(
            label,
            style: AppText.labelXS(color: labelColor),
          ),
          if (value != null) ...[
            const SizedBox(width: AppTokens.s2),
            Text(
              value!,
              style: dense
                  ? AppText.numericM(color: fg)
                  : AppText.numericL(color: fg),
            ),
          ],
        ],
      ),
    );
  }
}

enum AppChipTone { neutral, accent, dark }
