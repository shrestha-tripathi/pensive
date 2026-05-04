import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  durationMs?: number;
}

interface Ctx {
  show: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  success: (title: string, body?: string) => string;
  error: (title: string, body?: string) => string;
  warning: (title: string, body?: string) => string;
  info: (title: string, body?: string) => string;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Safe no-op fallback so non-provider callers (e.g. error boundary) don't crash.
    return {
      show: () => '',
      dismiss: () => {},
      success: () => '',
      error: () => '',
      warning: () => '',
      info: () => '',
    };
  }
  return ctx;
}

// Module-level escape hatch so non-React code (e.g. global error handlers) can toast.
let _push: ((t: Omit<Toast, 'id'>) => string) | null = null;
export function pushToast(t: Omit<Toast, 'id'>): string {
  return _push ? _push(t) : '';
}

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS: Record<ToastKind, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  error:   'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  info:    'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(ts => ts.filter(t => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) { clearTimeout(tm); timers.current.delete(id); }
  }, []);

  const show = useCallback((t: Omit<Toast, 'id'>): string => {
    const id = Math.random().toString(36).slice(2);
    const dur = t.durationMs ?? (t.kind === 'error' ? 6000 : 3500);
    setToasts(ts => [...ts, { ...t, id }]);
    if (dur > 0) {
      const tm = window.setTimeout(() => dismiss(id), dur);
      timers.current.set(id, tm);
    }
    return id;
  }, [dismiss]);

  // Wire module-level pushToast.
  useEffect(() => {
    _push = show;
    return () => { _push = null; };
  }, [show]);

  // Surface uncaught errors as toasts.
  useEffect(() => {
    const onErr = (ev: ErrorEvent) => {
      // Ignore ResizeObserver chatter and known benign browser noise.
      const msg = String(ev.message || '');
      if (/ResizeObserver|Script error\.?$/i.test(msg)) return;
      show({ kind: 'error', title: 'Something went wrong', body: msg.slice(0, 180) });
    };
    const onRej = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      const msg = reason?.message ? String(reason.message) : String(reason || '');
      if (!msg || /ResizeObserver/i.test(msg)) return;
      show({ kind: 'error', title: 'Unhandled error', body: msg.slice(0, 180) });
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, [show]);

  const api: Ctx = {
    show,
    dismiss,
    success: (title, body) => show({ kind: 'success', title, body }),
    error:   (title, body) => show({ kind: 'error',   title, body }),
    warning: (title, body) => show({ kind: 'warning', title, body }),
    info:    (title, body) => show({ kind: 'info',    title, body }),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-[calc(100vw-2rem)]">
        {toasts.map(t => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-lg border backdrop-blur-md shadow-lg px-3 py-2.5 flex items-start gap-2.5 animate-[slideIn_.18s_ease-out] ${COLORS[t.kind]}`}
            >
              <Icon size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-snug">{t.title}</div>
                {t.body ? <div className="text-xs mt-0.5 opacity-80 leading-snug break-words">{t.body}</div> : null}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
