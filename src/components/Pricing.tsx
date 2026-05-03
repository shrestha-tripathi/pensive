import { X, Check, Sparkles, Lock } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Tier {
  name: string;
  price: string;
  cadence: string;
  alt?: string;
  highlight?: boolean;
  tagline: string;
  features: string[];
  cta: string;
  ctaHref: string;
}

const WAITLIST = 'mailto:tripathishrestha9@gmail.com?subject=Pensive%20waitlist&body=I%27d%20love%20early%20access%20to%20Pensive%20Pro.';

const tiers: Tier[] = [
  {
    name: 'Free',
    price: '₹0',
    cadence: 'forever',
    tagline: 'Everything you need to think locally.',
    features: [
      'Unlimited notes & nested pages',
      'On-device Whisper transcription',
      'On-device RAG chat (WebGPU)',
      'Quick switcher, slash & mention menus',
      'Markdown / JSON export',
      'Zero telemetry · zero servers',
    ],
    cta: 'Use Pensive free',
    ctaHref: '#',
  },
  {
    name: 'Pro',
    price: '₹399',
    cadence: '/ month',
    alt: 'or ₹3,999 lifetime',
    highlight: true,
    tagline: 'For power users who want sync without compromise.',
    features: [
      'Everything in Free',
      'E2E-encrypted multi-device sync',
      'Encrypted cloud backups',
      'Priority Whisper-large model downloads',
      'Custom themes & fonts',
      'Early access to new local AI models',
    ],
    cta: 'Join the waitlist',
    ctaHref: WAITLIST,
  },
  {
    name: 'Team',
    price: '₹1,499',
    cadence: '/ seat / month',
    tagline: 'Shared knowledge for small, private teams.',
    features: [
      'Everything in Pro',
      'Shared encrypted workspaces',
      'Per-page access controls',
      'Audit log (client-side signed)',
      'Admin console',
      'Email support',
    ],
    cta: 'Talk to us',
    ctaHref: WAITLIST,
  },
];

export function Pricing({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="relative w-full max-w-6xl my-8 rounded-3xl bg-white dark:bg-warm-900 shadow-2xl border border-warm-200 dark:border-warm-800"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-warm-500 hover:bg-warm-100 dark:hover:bg-warm-800"
          aria-label="Close pricing"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-8 pt-12 pb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amethyst-100 dark:bg-amethyst-900/30 text-amethyst-700 dark:text-amethyst-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Coming soon · Free tier available today
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Simple pricing. Local by default.</h1>
          <p className="mt-3 text-warm-600 dark:text-warm-400 max-w-2xl mx-auto">
            Pensive is free forever. Paid tiers exist only to fund optional, end-to-end encrypted sync — the server still cannot read your notes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 px-6 md:px-8 pb-8">
          {tiers.map(t => (
            <div
              key={t.name}
              className={`relative rounded-2xl p-6 border flex flex-col ${
                t.highlight
                  ? 'border-amethyst-400 dark:border-amethyst-500 bg-gradient-to-b from-amethyst-50 to-white dark:from-amethyst-900/20 dark:to-warm-900 shadow-lg shadow-amethyst-200/40 dark:shadow-amethyst-900/30'
                  : 'border-warm-200 dark:border-warm-800 bg-warm-50/40 dark:bg-warm-900/40'
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amethyst-600 text-white text-xs font-semibold shadow">
                  Most popular
                </div>
              )}
              <h3 className="text-xl font-semibold">{t.name}</h3>
              <p className="text-sm text-warm-600 dark:text-warm-400 mt-1 min-h-[2.5rem]">{t.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{t.price}</span>
                <span className="text-warm-500 text-sm">{t.cadence}</span>
              </div>
              {t.alt && <div className="text-xs text-amethyst-700 dark:text-amethyst-300 mt-1">{t.alt}</div>}
              <ul className="mt-6 space-y-2.5 text-sm flex-1">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-amethyst-600 dark:text-amethyst-400 flex-shrink-0" />
                    <span className="text-warm-700 dark:text-warm-200">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={t.ctaHref}
                onClick={t.ctaHref === '#' ? onClose : undefined}
                className={`mt-6 block text-center px-4 py-2.5 rounded-xl font-medium transition ${
                  t.highlight
                    ? 'bg-amethyst-600 hover:bg-amethyst-700 text-white'
                    : 'bg-warm-100 hover:bg-warm-200 dark:bg-warm-800 dark:hover:bg-warm-700 text-warm-900 dark:text-warm-100'
                }`}
              >
                {t.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="mx-6 md:mx-8 mb-8 p-5 rounded-2xl border border-amethyst-200 dark:border-amethyst-800 bg-amethyst-50/60 dark:bg-amethyst-900/20 flex gap-4">
          <Lock className="w-6 h-6 text-amethyst-600 dark:text-amethyst-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-warm-700 dark:text-warm-200">
            <strong className="text-warm-900 dark:text-white">Privacy guarantee.</strong>{' '}
            The Free tier is fully featured — every AI feature runs on your device. Paid tiers add{' '}
            <em>optional</em> end-to-end encrypted sync. Your encryption key never leaves your browser, so even we cannot decrypt your notes.
          </div>
        </div>

        <div className="px-8 pb-8 text-center text-xs text-warm-500">
          Made in 🇮🇳 by{' '}
          <a className="underline hover:text-amethyst-600" href="https://github.com/shrestha-tripathi" target="_blank" rel="noreferrer">
            @shrestha-tripathi
          </a>{' '}
          · Part of{' '}
          <a className="underline hover:text-amethyst-600" href="https://worksoffline.in" target="_blank" rel="noreferrer">
            worksoffline.in
          </a>
        </div>
      </div>
    </div>
  );
}
