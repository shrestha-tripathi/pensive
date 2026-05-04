import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { searchEmoji, type EmojiEntry } from './emojiData';

/** `:smile` style autocomplete that inserts the emoji glyph as plain text. */
export const EmojiSuggest = Extension.create<{ render: () => any }>({
  name: 'emojiSuggest',
  addOptions() {
    return { render: () => ({}) };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: ':',
        startOfLine: false,
        allowSpaces: false,
        // Don't trigger on `::` or inside URLs/code etc. — Suggestion's default
        // behaviour already won't fire if the previous char is non-whitespace
        // for most cases; we additionally require at least 1 char of query
        // before showing matches (handled by render logic).
        command: ({ editor, range, props }: any) => {
          const item = props as EmojiEntry;
          editor.chain().focus().insertContentAt(range, item.e + ' ').run();
        },
        items: ({ query }: { query: string }) => {
          if (!query) return [];
          return searchEmoji(query, 10);
        },
        render: this.options.render,
      } as SuggestionOptions),
    ];
  },
});
