import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'screens/title_screen.dart';
import 'services/player_storage.dart';
import 'ui/design.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  final storage = await PlayerStorage.load();
  runApp(GroceryDashApp(storage: storage));
}

class GroceryDashApp extends StatelessWidget {
  const GroceryDashApp({super.key, required this.storage});
  final PlayerStorage storage;

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppTokens.accent,
      brightness: Brightness.light,
      surface: AppTokens.surface,
      primary: AppTokens.accent,
    );
    return MaterialApp(
      title: 'Grocery Dash',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: scheme,
        scaffoldBackgroundColor: AppTokens.surface,
        useMaterial3: true,
        textTheme: TextTheme(
          displayLarge: AppText.displayL(),
          displayMedium: AppText.displayM(),
          headlineLarge: AppText.headlineL(),
          headlineMedium: AppText.headlineM(),
          titleLarge: AppText.titleL(),
          titleMedium: AppText.titleM(),
          bodyLarge: AppText.bodyL(),
          bodyMedium: AppText.bodyM(),
          labelLarge: AppText.titleM(),
          labelSmall: AppText.labelXS(),
        ),
        splashColor: AppTokens.accentSoft.withValues(alpha: 0.5),
        highlightColor: AppTokens.accentSoft.withValues(alpha: 0.3),
      ),
      home: TitleScreen(storage: storage),
    );
  }
}
