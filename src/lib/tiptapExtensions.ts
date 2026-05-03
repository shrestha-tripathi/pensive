import { Node, mergeAttributes } from '@tiptap/core';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      emoji: { default: '💡' },
      variant: { default: 'info' }, // info | warning | success | error
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        'data-variant': node.attrs.variant,
        class: `pensive-callout pensive-callout-${node.attrs.variant}`,
      }),
      ['span', { class: 'pensive-callout-emoji', contenteditable: 'false' }, node.attrs.emoji],
      ['div', { class: 'pensive-callout-body' }, 0],
    ];
  },
  addCommands() {
    return {
      setCallout:
        (attrs?: { emoji?: string; variant?: string }) =>
        ({ commands }: any) =>
          commands.wrapIn(this.name, attrs ?? {}),
    } as any;
  },
});

export const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      summary: { default: 'Toggle' },
      open: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'details[data-toggle]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-toggle': '',
        open: node.attrs.open ? '' : undefined,
        class: 'pensive-toggle',
      }),
      ['summary', { class: 'pensive-toggle-summary' }, node.attrs.summary],
      ['div', { class: 'pensive-toggle-body' }, 0],
    ];
  },
  addCommands() {
    return {
      setToggle:
        () =>
        ({ commands }: any) =>
          commands.insertContent({
            type: 'toggle',
            attrs: { summary: 'Toggle', open: true },
            content: [{ type: 'paragraph' }],
          }),
    } as any;
  },
});
