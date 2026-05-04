import { useRef, useState } from 'react';
import { X, Trash2, RefreshCw, Upload } from 'lucide-react';
import type { TranscriberSettings } from '../hooks/useTranscriber';
import { reindexAll } from '../lib/vectorIndex';

interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  fromManifest: boolean;
  warnings: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  settings: TranscriberSettings;
  setSettings: (s: TranscriberSettings) => void;
  onClearAll: () => void;
  onImportZip?: (file: File) => Promise<ImportSummary>;
}

export function SettingsPanel({ open, onClose, settings, setSettings, onClearAll, onImportZip }: Props) {
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!open) return null;

  const doReindex = async () => {
    setReindexing(true);
    setReindexMsg('Reindexing…');
    try {
      const n = await reindexAll({ onProgress: (d, t) => setReindexMsg(`Reindexing ${d}/${t}…`) });
      setReindexMsg(`Reindexed ${n} note${n === 1 ? '' : 's'}.`);
    } catch (e: any) {
      setReindexMsg(`Failed: ${e?.message ?? e}`);
    } finally {
      setReindexing(false);
    }
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !onImportZip) return;
    if (!/\.zip$/i.test(file.name)) {
      setImportMsg('Please select a .zip file.');
      return;
    }
    setImporting(true);
    setImportMsg('Reading workspace…');
    setImportSummary(null);
    try {
      const result = await onImportZip(file);
      setImportSummary(result);
      const total = result.added + result.updated;
      setImportMsg(
        total === 0 && result.skipped === 0
          ? 'Nothing to import.'
          : `Imported ${result.added} new, updated ${result.updated}, skipped ${result.skipped} (already current)${result.fromManifest ? '' : ' · markdown-only mode'}`
      );
    } catch (err: any) {
      setImportMsg('Import failed: ' + (err?.message ?? err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-canvas dark:bg-[#17171a] w-full max-w-md rounded-xl shadow-2xl border border-warm-200 dark:border-[#26262b] p-5 max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-warm-500 hover:text-warm-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-warm-500 uppercase tracking-wide">Whisper model</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-[#1a1a1d] border border-warm-200 dark:border-[#26262b] text-sm"
              value={settings.model}
              onChange={e => setSettings({ ...settings, model: e.target.value })}
            >
              <option value="Xenova/whisper-tiny.en">whisper-tiny.en (~40MB · fastest)</option>
              <option value="Xenova/whisper-base.en">whisper-base.en (~150MB · better)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-warm-500 uppercase tracking-wide">Language</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-md bg-white dark:bg-[#1a1a1d] border border-warm-200 dark:border-[#26262b] text-sm"
              value={settings.language}
              onChange={e => setSettings({ ...settings, language: e.target.value })}
            >
              <option value="english">English</option>
            </select>
          </div>
          <div className="pt-2 border-t border-warm-200 dark:border-[#26262b]">
            <label className="text-xs text-warm-500 uppercase tracking-wide">Semantic search</label>
            <button
              onClick={doReindex}
              disabled={reindexing}
              className="mt-1 flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] text-warm-700 dark:text-warm-300 disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-4 h-4 ${reindexing ? 'animate-spin' : ''}`} /> Reindex all notes
            </button>
            {reindexMsg && <div className="text-[11px] text-warm-500 mt-1">{reindexMsg}</div>}
          </div>

          {onImportZip && (
            <div className="pt-2 border-t border-warm-200 dark:border-[#26262b]">
              <label className="text-xs text-warm-500 uppercase tracking-wide">Sync · Import workspace</label>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={handleFile}
              />
              <button
                onClick={handlePickFile}
                disabled={importing}
                className="mt-1 flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-amethyst-300 dark:border-amethyst-500/40 bg-amethyst-50 dark:bg-amethyst-500/10 hover:bg-amethyst-100 dark:hover:bg-amethyst-500/20 text-amethyst-700 dark:text-amethyst-300 disabled:opacity-50 transition"
              >
                <Upload className={`w-4 h-4 ${importing ? 'animate-pulse' : ''}`} /> {importing ? 'Importing…' : 'Import workspace ZIP'}
              </button>
              <p className="text-[11px] text-warm-500 mt-1.5 leading-relaxed">
                Pick a previously-exported Pensive ZIP from another device. Newer
                versions of each note overwrite older copies; nothing is deleted.
              </p>
              {importMsg && <div className="text-[11px] text-warm-600 dark:text-warm-300 mt-1">{importMsg}</div>}
              {importSummary && importSummary.warnings.length > 0 && (
                <details className="mt-1">
                  <summary className="text-[11px] text-amber-600 dark:text-amber-400 cursor-pointer">
                    {importSummary.warnings.length} warning{importSummary.warnings.length === 1 ? '' : 's'}
                  </summary>
                  <ul className="text-[11px] text-warm-500 mt-1 ml-3 list-disc space-y-0.5">
                    {importSummary.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}
                    {importSummary.warnings.length > 8 && <li>…and {importSummary.warnings.length - 8} more.</li>}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-warm-200 dark:border-[#26262b]">
            <button
              onClick={() => { if (confirm('Delete ALL notes? This cannot be undone.')) onClearAll(); }}
              className="flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700"
            >
              <Trash2 className="w-4 h-4" /> Clear all notes & data
            </button>
          </div>
          <p className="text-[11px] text-warm-500 leading-relaxed pt-2">
            Pensive runs entirely in your browser. Notes, embeddings, and the AI model all live on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
