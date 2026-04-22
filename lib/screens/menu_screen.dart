import 'package:flutter/material.dart';

import '../game/data/carts.dart';
import '../game/data/modes.dart';
import '../services/player_storage.dart';
import '../ui/design.dart';
import 'game_screen.dart';

/// Calm, typographic menu. One warm surface, clear hierarchy, a single
/// primary action. Camera options live in the settings sheet, not on the
/// main scroll. No gradient backgrounds, no neon, no floating glyphs.
class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key, required this.storage});
  final PlayerStorage storage;

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  late String _selectedCart = widget.storage.selectedCartId;
  GameMode _mode = GameMode.endless;
  CameraMode _camera = CameraMode.firstPerson;

  Future<void> _tapCart(CartDef cart) async {
    final unlocked = widget.storage.unlockedCarts.contains(cart.id);
    if (unlocked) {
      await widget.storage.selectCart(cart.id);
      setState(() => _selectedCart = cart.id);
      return;
    }
    if (widget.storage.coins < cart.unlockCost) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Need ${cart.unlockCost - widget.storage.coins} more coins.',
            style: AppText.bodyM(color: Colors.white),
          ),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppTokens.ink,
        ),
      );
      return;
    }
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTokens.surfaceElevated,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.rLg),
        ),
        title: Text('Unlock ${cart.name}', style: AppText.headlineM()),
        content: Text(
          '${cart.unlockCost} coins. ${cart.tagline}',
          style: AppText.bodyL(color: AppTokens.inkDim),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: AppText.titleM(color: AppTokens.inkDim)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTokens.accent),
            onPressed: () => Navigator.pop(context, true),
            child: Text('Unlock', style: AppText.titleM(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      final ok = await widget.storage.spendCoins(cart.unlockCost);
      if (ok) {
        await widget.storage.unlockCart(cart.id);
        await widget.storage.selectCart(cart.id);
        if (!mounted) return;
        setState(() => _selectedCart = cart.id);
      }
    }
  }

  Future<void> _openSettings() async {
    final result = await showModalBottomSheet<CameraMode>(
      context: context,
      backgroundColor: AppTokens.surfaceElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppTokens.rXl),
        ),
      ),
      builder: (_) => _SettingsSheet(currentCamera: _camera),
    );
    if (result != null) {
      setState(() => _camera = result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedCart = kCarts.firstWhere(
      (c) => c.id == _selectedCart,
      orElse: () => kCarts.first,
    );
    return Scaffold(
      backgroundColor: AppTokens.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppTokens.s5),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top bar — settings + stats.
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppTokens.s3),
                child: Row(
                  children: [
                    _IconButton(
                      icon: Icons.settings_outlined,
                      onTap: _openSettings,
                    ),
                    const Spacer(),
                    AppChip(
                      label: 'BEST',
                      value: widget.storage.highScore.toString(),
                    ),
                    const SizedBox(width: AppTokens.s2),
                    AppChip(
                      label: 'COINS',
                      value: widget.storage.coins.toString(),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: AppTokens.s4),
                      // Hero wordmark — secondary billing to the action.
                      Text('Grocery', style: AppText.displayM()),
                      Text(
                        'Dash.',
                        style: AppText.displayM(color: AppTokens.accent),
                      ),
                      const SizedBox(height: AppTokens.s6),
                      _SectionLabel('Mode'),
                      const SizedBox(height: AppTokens.s3),
                      _ModeCard(
                        mode: GameMode.endless,
                        selected: _mode == GameMode.endless,
                        onTap: () => setState(() => _mode = GameMode.endless),
                      ),
                      const SizedBox(height: AppTokens.s2),
                      _ModeCard(
                        mode: GameMode.shoppingList,
                        selected: _mode == GameMode.shoppingList,
                        onTap: () =>
                            setState(() => _mode = GameMode.shoppingList),
                      ),
                      const SizedBox(height: AppTokens.s6),
                      _SectionLabel('Cart'),
                      const SizedBox(height: AppTokens.s3),
                      _CartPicker(
                        carts: kCarts,
                        selectedId: _selectedCart,
                        unlockedIds: widget.storage.unlockedCarts,
                        onTap: _tapCart,
                      ),
                      const SizedBox(height: AppTokens.s6),
                    ],
                  ),
                ),
              ),

              // Primary action pinned to bottom
              Padding(
                padding: const EdgeInsets.only(bottom: AppTokens.s5),
                child: AppPrimaryButton(
                  label: 'Play',
                  expand: true,
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => GameScreen(
                          storage: widget.storage,
                          cart: selectedCart,
                          mode: _mode,
                          camera: _camera,
                        ),
                      ),
                    ).then((_) => setState(() {}));
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text.toUpperCase(), style: AppText.labelXS());
  }
}

class _IconButton extends StatelessWidget {
  const _IconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.s2),
          child: Icon(icon, size: 22, color: AppTokens.ink),
        ),
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.mode,
    required this.selected,
    required this.onTap,
  });
  final GameMode mode;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppTokens.rLg),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.rLg),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.all(AppTokens.s4),
          decoration: BoxDecoration(
            color: selected
                ? AppTokens.accentSoft
                : AppTokens.surfaceElevated,
            borderRadius: BorderRadius.circular(AppTokens.rLg),
            border: Border.all(
              color: selected ? AppTokens.accent : AppTokens.divider,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              // Minimal indicator
              AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? AppTokens.accent
                        : AppTokens.inkSubtle,
                    width: 2,
                  ),
                  color: selected ? AppTokens.accent : Colors.transparent,
                ),
                child: selected
                    ? const Icon(Icons.check,
                        size: 12, color: Colors.white)
                    : null,
              ),
              const SizedBox(width: AppTokens.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      mode.label,
                      style: AppText.titleL(),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      mode.tagline,
                      style: AppText.bodyM(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartPicker extends StatelessWidget {
  const _CartPicker({
    required this.carts,
    required this.selectedId,
    required this.unlockedIds,
    required this.onTap,
  });

  final List<CartDef> carts;
  final String selectedId;
  final List<String> unlockedIds;
  final void Function(CartDef) onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 128,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.zero,
        itemCount: carts.length,
        separatorBuilder: (_, i) => const SizedBox(width: AppTokens.s3),
        itemBuilder: (_, i) {
          final cart = carts[i];
          final isSelected = cart.id == selectedId;
          final isUnlocked = unlockedIds.contains(cart.id);
          return Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(AppTokens.rLg),
            child: InkWell(
              borderRadius: BorderRadius.circular(AppTokens.rLg),
              onTap: () => onTap(cart),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 128,
                padding: const EdgeInsets.all(AppTokens.s3),
                decoration: BoxDecoration(
                  color: AppTokens.surfaceElevated,
                  borderRadius: BorderRadius.circular(AppTokens.rLg),
                  border: Border.all(
                    color: isSelected
                        ? AppTokens.accent
                        : AppTokens.divider,
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Minimal cart mark (circle w/ cart color)
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: cart.color,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppTokens.ink.withValues(alpha: 0.1),
                          width: 1,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      cart.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.titleM(),
                    ),
                    const SizedBox(height: 2),
                    if (!isUnlocked)
                      Row(
                        children: [
                          Icon(Icons.lock_outline,
                              size: 11, color: AppTokens.inkDim),
                          const SizedBox(width: 4),
                          Text('${cart.unlockCost}',
                              style: AppText.caption()),
                        ],
                      )
                    else
                      Text(
                        isSelected ? 'Selected' : 'Tap to select',
                        style: AppText.caption(
                          color: isSelected
                              ? AppTokens.accent
                              : AppTokens.inkSubtle,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SettingsSheet extends StatefulWidget {
  const _SettingsSheet({required this.currentCamera});
  final CameraMode currentCamera;

  @override
  State<_SettingsSheet> createState() => _SettingsSheetState();
}

class _SettingsSheetState extends State<_SettingsSheet> {
  late CameraMode _camera = widget.currentCamera;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppTokens.s5,
          AppTokens.s4,
          AppTokens.s5,
          AppTokens.s5,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Grab handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppTokens.s4),
                decoration: BoxDecoration(
                  color: AppTokens.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text('Settings', style: AppText.headlineL()),
            const SizedBox(height: AppTokens.s5),
            Text('CAMERA',
                style: AppText.labelXS(color: AppTokens.inkDim)),
            const SizedBox(height: AppTokens.s2),
            for (final c in CameraMode.values)
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => setState(() => _camera = c),
                  borderRadius: BorderRadius.circular(AppTokens.rMd),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppTokens.s2, vertical: AppTokens.s3),
                    child: Row(
                      children: [
                        Icon(
                          c == _camera
                              ? Icons.radio_button_checked
                              : Icons.radio_button_off,
                          color: c == _camera
                              ? AppTokens.accent
                              : AppTokens.inkSubtle,
                          size: 20,
                        ),
                        const SizedBox(width: AppTokens.s3),
                        Expanded(
                          child: Text(c.label, style: AppText.titleM()),
                        ),
                        Text(
                          c == CameraMode.sideScroll
                              ? 'Default'
                              : 'Overhead',
                          style: AppText.caption(),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: AppTokens.s5),
            AppPrimaryButton(
              label: 'Done',
              expand: true,
              onPressed: () => Navigator.of(context).pop(_camera),
            ),
          ],
        ),
      ),
    );
  }
}
