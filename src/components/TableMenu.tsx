// Floating menu shown when the cursor is inside a table.
// Mimics Notion's table controls: add/remove rows & cols, toggle header, delete.
// Also rendered as the right-click context menu.

import type { Editor } from '@tiptap/react';
import {
  Plus, Minus, Trash2, Rows, Columns, Heading,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
} from 'lucide-react';

interface Props {
  editor: Editor;
  onClose?: () => void;
}

export function TableMenu({ editor, onClose }: Props) {
  const run = (fn: () => boolean | void) => {
    fn();
    onClose?.();
  };

  const Btn = ({ onClick, label, icon, danger }: { onClick: () => void; label: string; icon: React.ReactNode; danger?: boolean }) => (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs rounded-md transition ${danger
        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15'
        : 'text-warm-700 dark:text-warm-300 hover:bg-warm-100 dark:hover:bg-[#26262b]'}`}
    >
      <span className="w-3.5 h-3.5 flex items-center justify-center text-warm-500">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="pensive-table-menu min-w-[200px] py-1 rounded-lg border border-warm-200 dark:border-[#26262b] bg-white dark:bg-[#1a1a1d] shadow-xl">
      <div className="px-2.5 pt-1 pb-1 text-[10px] uppercase tracking-wide text-warm-500">Row</div>
      <Btn onClick={() => run(() => editor.chain().focus().addRowBefore().run())} label="Insert row above" icon={<ArrowUp className="w-3.5 h-3.5" />} />
      <Btn onClick={() => run(() => editor.chain().focus().addRowAfter().run())} label="Insert row below" icon={<ArrowDown className="w-3.5 h-3.5" />} />
      <Btn onClick={() => run(() => editor.chain().focus().deleteRow().run())} label="Delete row" icon={<Minus className="w-3.5 h-3.5" />} danger />

      <div className="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-wide text-warm-500">Column</div>
      <Btn onClick={() => run(() => editor.chain().focus().addColumnBefore().run())} label="Insert column left" icon={<ArrowLeft className="w-3.5 h-3.5" />} />
      <Btn onClick={() => run(() => editor.chain().focus().addColumnAfter().run())} label="Insert column right" icon={<ArrowRight className="w-3.5 h-3.5" />} />
      <Btn onClick={() => run(() => editor.chain().focus().deleteColumn().run())} label="Delete column" icon={<Minus className="w-3.5 h-3.5" />} danger />

      <div className="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-wide text-warm-500">Table</div>
      <Btn onClick={() => run(() => editor.chain().focus().toggleHeaderRow().run())} label="Toggle header row" icon={<Heading className="w-3.5 h-3.5" />} />
      <Btn onClick={() => run(() => editor.chain().focus().toggleHeaderColumn().run())} label="Toggle header column" icon={<Columns className="w-3.5 h-3.5" />} />
      <Btn onClick={() => run(() => editor.chain().focus().mergeOrSplit().run())} label="Merge / split cells" icon={<Rows className="w-3.5 h-3.5" />} />
      <Btn onClick={() => run(() => editor.chain().focus().deleteTable().run())} label="Delete table" icon={<Trash2 className="w-3.5 h-3.5" />} danger />

      <div className="border-t border-warm-200 dark:border-[#26262b] mt-1 pt-1">
        <Btn
          onClick={() => run(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
          label="Insert new table"
          icon={<Plus className="w-3.5 h-3.5" />}
        />
      </div>
    </div>
  );
}
