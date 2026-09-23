import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react';
import type { RiskLevel } from '../../types';
import { RISK_META } from '../../lib/ai';
import { cx } from '../../lib/format';

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'amber' | 'red' | 'green' | 'dark';
  className?: string;
  icon?: ReactNode;
}) {
  const tones = {
    neutral: 'bg-black/[0.04] text-ink-soft',
    brand: 'bg-brand-100 text-brand-700',
    amber: 'bg-[#FDF3E1] text-[#A9761A]',
    red: 'bg-[#FCEDEC] text-[#B4453D]',
    green: 'bg-[#EAF6EF] text-risk-low',
    dark: 'bg-brand-700 text-white',
  } as const;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tracking-tight',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const ICONS: Record<RiskLevel, typeof CheckCircle2> = {
  bajo: CheckCircle2,
  medio: CircleAlert,
  alto: AlertTriangle,
};

export function RiskBadge({
  level,
  score,
  size = 'md',
  showScore = true,
}: {
  level: RiskLevel;
  score?: number;
  size?: 'sm' | 'md';
  showScore?: boolean;
}) {
  const meta = RISK_META[level];
  const Icon = ICONS[level];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1',
        meta.bg,
        meta.text,
        meta.ring,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.4} />
      {meta.label}
      {showScore && score !== undefined && (
        <span className="opacity-60">· {score}</span>
      )}
    </span>
  );
}

export function DiscountTag({ percent, className }: { percent: number; className?: string }) {
  if (percent <= 0) return null;
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full bg-brand-700 px-2.5 py-1 text-[12px] font-extrabold text-white shadow-glow',
        className,
      )}
    >
      −{Math.round(percent)} %
    </span>
  );
}
