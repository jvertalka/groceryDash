/// Game modes exposed in the menu.
enum GameMode {
  endless,
  shoppingList,
}

/// Camera perspectives the player can choose from the menu.
enum CameraMode {
  firstPerson,
  sideScroll,
  topDown,
}

extension GameModeX on GameMode {
  String get label => switch (this) {
        GameMode.endless => 'Endless Dash',
        GameMode.shoppingList => 'Shopping List',
      };

  String get tagline => switch (this) {
        GameMode.endless =>
          'Survive the aisles. Collect chaos. Combo for glory.',
        GameMode.shoppingList =>
          'Grab every item on your list before the timer runs out.',
      };

  String get emoji => switch (this) {
        GameMode.endless => '💥',
        GameMode.shoppingList => '📝',
      };
}

extension CameraModeX on CameraMode {
  String get label => switch (this) {
        CameraMode.firstPerson => 'First Person',
        CameraMode.sideScroll => 'Follow Cam',
        CameraMode.topDown => 'Store Map',
      };

  String get emoji => switch (this) {
        CameraMode.firstPerson => '🛒',
        CameraMode.sideScroll => '👁',
        CameraMode.topDown => '🗺️',
      };
}
