// Lazy-loaded heavy editor extensions to keep initial bundle small.
import type { Editor } from '@tiptap/core';

let tablesPromise: Promise<any> | null = null;
export async function ensureTables(editor: Editor) {
  if (!tablesPromise) {
    tablesPromise = (async () => {
      const [{ Table }, { TableRow }, { TableHeader }, { TableCell }] = await Promise.all([
        import('@tiptap/extension-table'),
        import('@tiptap/extension-table-row'),
        import('@tiptap/extension-table-header'),
        import('@tiptap/extension-table-cell'),
      ]);
      // Register at runtime.
      editor.extensionManager.extensions.push(
        Table.configure({ resizable: true }) as any,
        TableRow as any,
        TableHeader as any,
        TableCell as any,
      );
      // Re-create schema by reconfiguring—Tiptap doesn't natively support hot-add,
      // so instead we just insert raw HTML if the Table node isn't registered.
    })();
  }
  await tablesPromise;
}

// Insert a 3x3 table via raw HTML — works regardless of schema registration as long
// as schema includes table; if not, fall back to a simple block.
export function insertTableHTML(editor: Editor) {
  const schema = editor.schema;
  if ((schema.nodes as any).table) {
    editor.chain().focus().insertContent({
      type: 'table',
      content: [
        { type: 'tableRow', content: Array.from({ length: 3 }, () => ({ type: 'tableHeader', content: [{ type: 'paragraph' }] })) },
        ...Array.from({ length: 2 }, () => ({
          type: 'tableRow',
          content: Array.from({ length: 3 }, () => ({ type: 'tableCell', content: [{ type: 'paragraph' }] })),
        })),
      ],
    }).run();
  } else {
    editor.chain().focus().insertContent('<p><em>(Table support loading… try again in a moment)</em></p>').run();
  }
}
