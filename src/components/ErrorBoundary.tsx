import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { pushToast } from './Toast';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
    pushToast({
      kind: 'error',
      title: 'A component crashed',
      body: error.message?.slice(0, 200) ?? 'Unknown error',
      durationMs: 8000,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <div className="font-semibold">Something went wrong here</div>
        <div className="text-sm text-warm-500 max-w-md break-words">
          {this.state.error.message || 'Unknown error'}
        </div>
        <div className="flex gap-2 mt-1">
          <button
            onClick={this.reset}
            className="px-3 py-1.5 rounded-md bg-amethyst-500 text-white text-sm flex items-center gap-1.5 hover:bg-amethyst-600"
          >
            <RefreshCw size={14} /> Try again
          </button>
          <button
            onClick={() => location.reload()}
            className="px-3 py-1.5 rounded-md border border-warm-300 dark:border-stone-700 text-sm hover:bg-warm-100 dark:hover:bg-stone-800"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
