import 'package:flame/game.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../game/data/carts.dart';
import '../game/data/modes.dart';
import '../game/entities.dart';
import '../game/grocery_dash_game.dart';
import '../game/run_result.dart';
import '../game/world/shelf.dart';
import '../services/player_storage.dart';
import '../ui/design.dart';
import '../widgets/virtual_joystick.dart';
import 'summary_screen.dart';

class GameScreen extends StatefulWidget {
  const GameScreen({
    super.key,
    required this.storage,
    required this.cart,
    required this.mode,
    required this.camera,
  });

  final PlayerStorage storage;
  final CartDef cart;
  final GameMode mode;
  final CameraMode camera;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with WidgetsBindingObserver {
  late final GroceryDashGame _game;
  late final ValueNotifier<CameraMode> _cameraNotifier;
  bool _ended = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _cameraNotifier = ValueNotifier<CameraMode>(widget.camera);
    _game = GroceryDashGame(
      cartDef: widget.cart,
      previousHighScore: widget.storage.highScore,
      onRunEnded: _handleRunEnded,
      mode: widget.mode,
      cameraMode: _cameraNotifier,
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraNotifier.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _game.paused = true;
    }
  }

  Future<void> _handleRunEnded(RunResult result) async {
    if (_ended) return;
    _ended = true;
    await widget.storage.addCoins(result.coinsEarned);
    await widget.storage.maybeUpdateHighScore(result.score);
    if (!mounted) return;
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => SummaryScreen(
          result: result,
          storage: widget.storage,
          cart: widget.cart,
          mode: widget.mode,
          camera: widget.camera,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTokens.ink,
      body: Focus(
        autofocus: true,
        onKeyEvent: _onKeyEvent,
        child: Stack(
          children: [
            Positioned.fill(child: GameWidget(game: _game)),

            // Joystick lives in the left half of the bottom, so right-side
            // buttons stay reachable.
            Positioned(
              left: 0,
              right: 180,
              top: MediaQuery.of(context).size.height * 0.42,
              bottom: 0,
              child: VirtualJoystick(onChange: (v) => _game.setJoystick(v)),
            ),

            _TopHud(
              game: _game,
              onClose: () => Navigator.of(context).pop(),
            ),

            _BottomRightActions(game: _game),

            _ShelfFacePanel(game: _game),

            _BannerToast(notifier: _game.bannerNotifier),
          ],
        ),
      ),
    );
  }

  KeyEventResult _onKeyEvent(FocusNode node, KeyEvent event) {
    if (event is KeyDownEvent || event is KeyRepeatEvent) {
      if (event.logicalKey == LogicalKeyboardKey.space ||
          event.logicalKey == LogicalKeyboardKey.enter) {
        _game.setInteractHeld(true);
        if (event is KeyDownEvent) _game.onInteractPressed();
        return KeyEventResult.handled;
      }
      if (event.logicalKey == LogicalKeyboardKey.keyP ||
          event.logicalKey == LogicalKeyboardKey.tab) {
        if (event is KeyDownEvent) _game.toggleCartAttached();
        return KeyEventResult.handled;
      }
      var v = _game.joystick;
      const unit = 1.0;
      if (event.logicalKey == LogicalKeyboardKey.arrowLeft ||
          event.logicalKey == LogicalKeyboardKey.keyA) {
        v = Offset(-unit, v.dy);
      } else if (event.logicalKey == LogicalKeyboardKey.arrowRight ||
          event.logicalKey == LogicalKeyboardKey.keyD) {
        v = Offset(unit, v.dy);
      } else if (event.logicalKey == LogicalKeyboardKey.arrowUp ||
          event.logicalKey == LogicalKeyboardKey.keyW) {
        v = Offset(v.dx, -unit);
      } else if (event.logicalKey == LogicalKeyboardKey.arrowDown ||
          event.logicalKey == LogicalKeyboardKey.keyS) {
        v = Offset(v.dx, unit);
      } else {
        return KeyEventResult.ignored;
      }
      _game.setJoystick(v);
      return KeyEventResult.handled;
    }
    if (event is KeyUpEvent) {
      if (event.logicalKey == LogicalKeyboardKey.space ||
          event.logicalKey == LogicalKeyboardKey.enter) {
        _game.setInteractHeld(false);
        return KeyEventResult.handled;
      }
      final movement = <LogicalKeyboardKey>{
        LogicalKeyboardKey.arrowLeft,
        LogicalKeyboardKey.arrowRight,
        LogicalKeyboardKey.arrowUp,
        LogicalKeyboardKey.arrowDown,
        LogicalKeyboardKey.keyA,
        LogicalKeyboardKey.keyD,
        LogicalKeyboardKey.keyW,
        LogicalKeyboardKey.keyS,
      };
      if (movement.contains(event.logicalKey)) {
        _game.setJoystick(Offset.zero);
        return KeyEventResult.handled;
      }
    }
    return KeyEventResult.ignored;
  }
}

// ============================================================
//  Top HUD — shopping list primary, then a warning strip for
//  unattended cart, plus a close button.
// ============================================================

class _TopHud extends StatelessWidget {
  const _TopHud({required this.game, required this.onClose});
  final GroceryDashGame game;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            AppTokens.s4, AppTokens.s3, AppTokens.s4, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CloseButton(onTap: onClose),
                const SizedBox(width: AppTokens.s3),
                Expanded(
                  child: _ShoppingListPanel(game: game),
                ),
              ],
            ),
            const SizedBox(height: AppTokens.s2),
            _UnattendedStrip(notifier: game.unattendedNotifier),
          ],
        ),
      ),
    );
  }
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: AppTokens.surfaceElevated,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.close, size: 18, color: AppTokens.ink),
        ),
      ),
    );
  }
}

/// Shopping list panel — reads `game.list` through a ValueNotifier so it
/// rebuilds both when the list is replaced during onLoad() and when entries
/// are recounted as the cart changes.
class _ShoppingListPanel extends StatelessWidget {
  const _ShoppingListPanel({required this.game});
  final GroceryDashGame game;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppTokens.s3, vertical: AppTokens.s2),
      decoration: BoxDecoration(
        color: AppTokens.surfaceElevated.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(AppTokens.rLg),
        border: Border.all(color: AppTokens.divider),
      ),
      // totalNotifier updates whenever _syncListNotifiers fires (including
      // immediately after the list is populated in onLoad), so we rebuild
      // the whole panel contents off it.
      child: ValueListenableBuilder<int>(
        valueListenable: game.totalNotifier,
        builder: (ctx, total, child) {
          return ValueListenableBuilder<int>(
            valueListenable: game.collectedNotifier,
            builder: (ctx2, collected, child2) {
              final entries = game.list.entries;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('SHOPPING LIST', style: AppText.labelXS()),
                      const Spacer(),
                      Text('$collected / $total',
                          style: AppText.numericM(color: AppTokens.ink)),
                    ],
                  ),
                  if (entries.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Text('Loading list…',
                          style: AppText.caption(color: AppTokens.inkDim)),
                    )
                  else ...[
                    const SizedBox(height: 4),
                    for (final entry in entries) _ListRow(entry: entry),
                  ],
                ],
              );
            },
          );
        },
      ),
    );
  }
}

class _ListRow extends StatelessWidget {
  const _ListRow({required this.entry});
  final ShoppingListEntry entry;
  @override
  Widget build(BuildContext context) {
    final done = entry.complete;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? AppTokens.positive : Colors.transparent,
              border: Border.all(
                color: done ? AppTokens.positive : AppTokens.inkSubtle,
                width: 1.5,
              ),
            ),
            child: done
                ? const Icon(Icons.check, size: 10, color: Colors.white)
                : null,
          ),
          const SizedBox(width: AppTokens.s2),
          Expanded(
            child: Text(
              entry.item.name,
              overflow: TextOverflow.ellipsis,
              style: AppText.bodyM(
                color: done ? AppTokens.inkSubtle : AppTokens.ink,
              ).copyWith(
                decoration: done ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
          Text(
            '${entry.collected}/${entry.needed}',
            style: AppText.caption(
              color: done ? AppTokens.positive : AppTokens.inkDim,
            ),
          ),
        ],
      ),
    );
  }
}

/// Shows a thin warning bar while the cart is unattended. Intensifies as
/// time passes.
class _UnattendedStrip extends StatelessWidget {
  const _UnattendedStrip({required this.notifier});
  final ValueListenable<double> notifier;
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: notifier,
      builder: (ctx, seconds, child) {
        if (seconds < 1) return const SizedBox(height: 0);
        final danger = seconds > 8;
        return Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppTokens.s3, vertical: 6),
          decoration: BoxDecoration(
            color: danger
                ? AppTokens.danger.withValues(alpha: 0.88)
                : AppTokens.warning.withValues(alpha: 0.88),
            borderRadius: BorderRadius.circular(AppTokens.rPill),
          ),
          child: Row(
            children: [
              const Icon(Icons.shopping_cart_outlined,
                  size: 14, color: Colors.white),
              const SizedBox(width: AppTokens.s2),
              Text(
                danger
                    ? 'Cart unattended — items at risk'
                    : 'Cart parked',
                style: AppText.labelXS(color: Colors.white),
              ),
              const Spacer(),
              Text('${seconds.toStringAsFixed(0)}s',
                  style: AppText.labelXS(color: Colors.white)),
            ],
          ),
        );
      },
    );
  }
}

// ============================================================
//  Bottom-right: park/take + interact
// ============================================================

class _BottomRightActions extends StatelessWidget {
  const _BottomRightActions({required this.game});
  final GroceryDashGame game;
  @override
  Widget build(BuildContext context) {
    return Positioned(
      right: AppTokens.s4,
      bottom: AppTokens.s6,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          _ParkButton(notifier: game.cartParkedNotifier, onTap: game.toggleCartAttached),
          const SizedBox(height: AppTokens.s3),
          _InteractButton(game: game),
        ],
      ),
    );
  }
}

class _ParkButton extends StatelessWidget {
  const _ParkButton({required this.notifier, required this.onTap});
  final ValueListenable<bool> notifier;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: notifier,
      builder: (ctx, parked, child) {
        return Material(
          color: Colors.transparent,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: Container(
              width: 54,
              height: 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppTokens.surfaceElevated,
                shape: BoxShape.circle,
                border: Border.all(color: AppTokens.divider, width: 1),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    parked
                        ? Icons.directions_walk
                        : Icons.shopping_cart_outlined,
                    size: 20,
                    color: AppTokens.ink,
                  ),
                  const SizedBox(height: 1),
                  Text(
                    parked ? 'TAKE' : 'PARK',
                    style: AppText.labelXS()
                        .copyWith(fontSize: 8, letterSpacing: 1),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _InteractButton extends StatelessWidget {
  const _InteractButton({required this.game});
  final GroceryDashGame game;
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<InteractPrompt?>(
      valueListenable: game.promptNotifier,
      builder: (ctx, prompt, child) {
        final active = prompt != null;
        return ValueListenableBuilder<double>(
          valueListenable: game.reachProgressNotifier,
          builder: (ctx2, reach, child2) {
            return ValueListenableBuilder<double>(
              valueListenable: game.checkoutProgressNotifier,
              builder: (ctx3, checkout, child3) {
                final progress = checkout > 0 ? checkout : reach;
                return GestureDetector(
                  onTapDown: (_) => game.setInteractHeld(true),
                  onTapUp: (_) => game.setInteractHeld(false),
                  onTapCancel: () => game.setInteractHeld(false),
                  onTap: game.onInteractPressed,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        width: 96,
                        height: 96,
                        decoration: BoxDecoration(
                          color: active
                              ? AppTokens.accent
                              : AppTokens.ink.withValues(alpha: 0.3),
                          shape: BoxShape.circle,
                          boxShadow: active ? AppTokens.elev3 : null,
                        ),
                      ),
                      if (progress > 0)
                        SizedBox(
                          width: 96,
                          height: 96,
                          child: CircularProgressIndicator(
                            value: progress,
                            strokeWidth: 4,
                            valueColor: const AlwaysStoppedAnimation(Colors.white),
                            backgroundColor:
                                Colors.white.withValues(alpha: 0.2),
                          ),
                        ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            prompt?.label ?? '—',
                            style: AppText.titleL(
                              color: active
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: 0.5),
                            ),
                          ),
                          if (prompt?.subLabel != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              prompt!.subLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.caption(
                                color: Colors.white.withValues(alpha: 0.85),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }
}

// ============================================================
//  Banner — single transient message at the top-centre
// ============================================================

class _BannerToast extends StatelessWidget {
  const _BannerToast({required this.notifier});
  final ValueListenable<String?> notifier;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String?>(
      valueListenable: notifier,
      builder: (ctx, text, child) {
        final visible = text != null;
        return Positioned(
          top: MediaQuery.of(context).padding.top + 220,
          left: AppTokens.s5,
          right: AppTokens.s5,
          child: IgnorePointer(
            child: AnimatedOpacity(
              opacity: visible ? 1 : 0,
              duration: const Duration(milliseconds: 180),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppTokens.s4, vertical: AppTokens.s2),
                  decoration: BoxDecoration(
                    color: AppTokens.ink.withValues(alpha: 0.88),
                    borderRadius: BorderRadius.circular(AppTokens.rMd),
                  ),
                  child: Text(
                    text ?? '',
                    textAlign: TextAlign.center,
                    style: AppText.bodyM(color: Colors.white),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ============================================================
//  Shelf-face selector — appears at the left side of the screen
//  when the player is near a shelf. Lists the items visible on
//  that face; tapping one focuses it (and the GRAB button will
//  reach for it next).
// ============================================================

class _ShelfFacePanel extends StatelessWidget {
  const _ShelfFacePanel({required this.game});
  final GroceryDashGame game;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: game.shelfFaceTickNotifier,
      builder: (ctx, tick, child) {
        final slots = game.shelfFaceSlots();
        if (slots.isEmpty) return const SizedBox.shrink();
        // Cap the visible list and put the focused one first for readability
        final focus = game.focusedSlot;
        final ordered = <ShelfSlot>[];
        if (focus != null && slots.contains(focus)) ordered.add(focus);
        for (final s in slots) {
          if (!identical(s, focus)) ordered.add(s);
        }
        final show = ordered.take(6).toList();

        return Positioned(
          left: AppTokens.s3,
          top: MediaQuery.of(context).padding.top + 220,
          child: IgnorePointer(
            ignoring: false,
            child: Container(
              padding: const EdgeInsets.all(AppTokens.s2),
              decoration: BoxDecoration(
                color: AppTokens.surfaceElevated.withValues(alpha: 0.96),
                borderRadius: BorderRadius.circular(AppTokens.rMd),
                boxShadow: AppTokens.elev2,
                border: Border.all(color: AppTokens.divider),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 4, vertical: 2),
                    child: Text('ON THIS SHELF', style: AppText.labelXS()),
                  ),
                  const SizedBox(height: 2),
                  for (final slot in show)
                    _ShelfFaceRow(
                      slot: slot,
                      focused: identical(slot, focus),
                      onTap: () => game.setFocusedSlot(slot),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ShelfFaceRow extends StatelessWidget {
  const _ShelfFaceRow({
    required this.slot,
    required this.focused,
    required this.onTap,
  });
  final ShelfSlot slot;
  final bool focused;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppTokens.rSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.rSm),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: focused
                ? AppTokens.accentSoft
                : Colors.transparent,
            borderRadius: BorderRadius.circular(AppTokens.rSm),
            border: Border.all(
              color: focused ? AppTokens.accent : Colors.transparent,
              width: focused ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: slot.item.color,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.black.withValues(alpha: 0.35),
                    width: 1,
                  ),
                ),
              ),
              const SizedBox(width: AppTokens.s2),
              SizedBox(
                width: 110,
                child: Text(
                  slot.item.name,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.bodyM(
                    color: focused ? AppTokens.accent : AppTokens.ink,
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
