import { Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';

// Image variant that supports attachmentId (blob in IndexedDB) + caption.
export const AttachmentImage = Image.extend({
  name: 'image',
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      attachmentId: { default: null },
      caption: { default: '' },
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const attrs: Record<string, any> = { ...HTMLAttributes };
    if (node.attrs.attachmentId) {
      attrs['data-attachment-id'] = node.attrs.attachmentId;
      // Leave src blank — Editor.tsx resolves it to a blob: URL after mount.
      delete attrs.src;
    }
    if (node.attrs.caption) attrs['data-caption'] = node.attrs.caption;
    if (node.attrs.alt && !attrs.alt) attrs.alt = node.attrs.alt;
    return ['img', mergeAttributes(attrs)];
  },
});

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
    return [
      { tag: 'div[data-toggle]' },
      { tag: 'details[data-toggle]' }, // back-compat with old saved notes
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-toggle': '',
        'data-open': node.attrs.open ? 'true' : 'false',
        class: `pensive-toggle ${node.attrs.open ? 'is-open' : 'is-closed'}`,
      }),
      [
        'div',
        { class: 'pensive-toggle-summary', contenteditable: 'false' },
        ['span', { class: 'pensive-toggle-chevron' }, '▶'],
        ['span', { class: 'pensive-toggle-summary-text' }, node.attrs.summary],
      ],
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
      toggleToggleOpen:
        () =>
        ({ state, dispatch }: any) => {
          const { selection, tr } = state;
          // Find nearest enclosing toggle node and flip its open attr.
          for (let depth = selection.$from.depth; depth >= 0; depth--) {
            const node = selection.$from.node(depth);
            if (node.type.name === 'toggle') {
              const pos = selection.$from.before(depth);
              if (dispatch) dispatch(tr.setNodeMarkup(pos, undefined, { ...node.attrs, open: !node.attrs.open }));
              return true;
            }
          }
          return false;
        },
    } as any;
  },
});
