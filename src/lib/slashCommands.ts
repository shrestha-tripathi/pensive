import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import type { Editor, Range } from '@tiptap/core';

export interface SlashItem {
  title: string;
  description: string;
  icon: string;
  group: string;
  keywords?: string[];
  shortcut?: string;
  command: (editor: Editor, range: Range) => void;
}

export const SlashCommands = Extension.create<{ items: SlashItem[]; render: () => any }>({
  name: 'slashCommands',
  addOptions() {
    return { items: [], render: () => ({}) };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }: any) => {
          (props as SlashItem).command(editor, range);
        },
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          return this.options.items.filter(it => {
            if (!q) return true;
            const hay = (it.title + ' ' + (it.keywords ?? []).join(' ') + ' ' + it.description).toLowerCase();
            return hay.includes(q);
          });
        },
        render: this.options.render,
      } as SuggestionOptions),
    ];
  },
});
