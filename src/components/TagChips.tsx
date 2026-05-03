import { useState, useRef, useEffect } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  onAutoTag?: () => void | Promise<void>;
  autoTagging?: boolean;
}

export function TagChips({ tags, onChange, onAutoTag, autoTagging }: Props) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const remove = (t: string) => onChange(tags.filter(x => x !== t));
  const add = () => {
    const t = val.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setVal('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-4">
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amethyst-50 dark:bg-amethyst-500/10 text-amethyst-700 dark:text-amethyst-300 border border-amethyst-300/40">
          #{t}
          <button onClick={() => remove(t)} className="hover:text-rose-600" title="Remove tag">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={add}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Escape') { setVal(''); setAdding(false); }
          }}
          placeholder="tag"
          className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-[#1a1a1d] border border-warm-200 dark:border-[#26262b] outline-none w-20"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-dashed border-warm-300 dark:border-[#3a3a40] text-warm-500 hover:text-amethyst-600 hover:border-amethyst-400"
        >
          <Plus className="w-3 h-3" /> tag
        </button>
      )}
      {onAutoTag && (
        <button
          onClick={() => onAutoTag()}
          disabled={autoTagging}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full text-warm-500 hover:text-amethyst-600 disabled:opacity-50"
          title="Suggest tags from content"
        >
          <Sparkles className="w-3 h-3" /> {autoTagging ? 'thinking…' : 'auto'}
        </button>
      )}
    </div>
  );
}
