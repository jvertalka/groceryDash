import 'dart:ui' as ui;

/// Caches laid-out `ui.Paragraph` objects for emoji strings so the render
/// loop never allocates a TextPainter. Entries are keyed by (emoji, size).
///
/// Typical cost on the hot path drops from ~6μs per call (allocating a
/// TextPainter + laying out) to a cheap map lookup + Canvas.drawParagraph.
class EmojiCache {
  EmojiCache._();
  static final EmojiCache instance = EmojiCache._();

  final Map<String, ui.Paragraph> _cache = {};

  ui.Paragraph get(String emoji, double fontSize) {
    final key = '$emoji|$fontSize';
    final cached = _cache[key];
    if (cached != null) return cached;
    final style = ui.ParagraphStyle(
      textAlign: ui.TextAlign.center,
      textDirection: ui.TextDirection.ltr,
      fontSize: fontSize,
    );
    final builder = ui.ParagraphBuilder(style)..addText(emoji);
    final paragraph = builder.build()
      ..layout(ui.ParagraphConstraints(width: fontSize * 3));
    _cache[key] = paragraph;
    return paragraph;
  }

  /// Width of the laid-out paragraph (used for centring). Cached via the
  /// same object since Paragraph.width is stable after layout.
  double widthOf(String emoji, double fontSize) =>
      get(emoji, fontSize).longestLine;
}
