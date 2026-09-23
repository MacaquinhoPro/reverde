import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { cx } from '../../lib/format';

const ICONS = { success: CheckCircle2, info: Info, warn: TriangleAlert };
const TONES = {
  success: 'text-risk-low',
  info: 'text-brand-600',
  warn: 'text-[#D99A2B]',
};

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
      {toasts.map((t) => {
        const tone = t.tone ?? 'success';
        const Icon = ICONS[tone];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-2xl border border-black/5 bg-white/95 p-3.5 shadow-lift backdrop-blur"
          >
            <Icon className={cx('mt-0.5 h-[18px] w-[18px] shrink-0', TONES[tone])} strokeWidth={2.3} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold leading-snug text-ink">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{t.description}</p>
              )}
            </div>
            <button onClick={() => dismissToast(t.id)} className="-m-1 p-1 text-ink-faint hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
