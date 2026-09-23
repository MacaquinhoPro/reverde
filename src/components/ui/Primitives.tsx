import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cx, initials } from '../../lib/format';
import { RISK_META } from '../../lib/ai';
import type { RiskLevel } from '../../types';

export function Card({
  children,
  className,
  hover,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: 'div' | 'section' | 'article';
}) {
  return <As className={cx('card', hover && 'card-hover', className)}>{children}</As>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-[17px] font-bold tracking-tight text-ink sm:text-[19px]">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  icon,
  tone = 'default',
  hint,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  icon?: ReactNode;
  tone?: 'default' | 'brand' | 'amber' | 'red';
  hint?: string;
  className?: string;
}) {
  const tones = {
    default: 'bg-white',
    brand: 'bg-brand-700 text-white border-transparent',
    amber: 'bg-[#FDF8EE]',
    red: 'bg-[#FDF1F0]',
  } as const;
  const light = tone === 'brand';
  return (
    <div className={cx('card p-4 sm:p-5 transition-all duration-300 hover:shadow-lift', tones[tone], className)}>
      <div className="flex items-center justify-between gap-3">
        <p className={cx('text-[12.5px] font-medium leading-tight', light ? 'text-brand-100' : 'text-ink-soft')}>
          {label}
        </p>
        {icon && (
          <span
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]',
              light ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-600',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className={cx('text-[26px] font-extrabold tracking-[-0.03em] sm:text-[30px]', light ? 'text-white' : 'text-ink')}>
          {value}
        </span>
        {unit && <span className={cx('text-sm font-semibold', light ? 'text-brand-200' : 'text-ink-soft')}>{unit}</span>}
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-2 flex items-center gap-1.5">
          {delta !== undefined && (
            <span
              className={cx(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-bold',
                light
                  ? 'bg-white/15 text-white'
                  : delta >= 0
                    ? 'bg-[#EAF6EF] text-risk-low'
                    : 'bg-[#FCEDEC] text-[#B4453D]',
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {delta >= 0 ? '+' : ''}
              {Math.round(delta)} %
            </span>
          )}
          {hint && (
            <span className={cx('text-[11.5px] leading-tight', light ? 'text-brand-200' : 'text-ink-faint')}>{hint}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 px-6 py-12 text-center">
      {icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-500 shadow-soft">
          {icon}
        </span>
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({
  name,
  hue = 152,
  size = 'md',
  className,
}: {
  name: string;
  hue?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-[13px]', lg: 'h-14 w-14 text-base' };
  return (
    <span
      className={cx('inline-flex items-center justify-center rounded-full font-bold', sizes[size], className)}
      style={{ background: `hsl(${hue} 42% 92%)`, color: `hsl(${hue} 45% 28%)` }}
    >
      {initials(name)}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  className,
}: {
  value: number;
  tone?: 'brand' | 'amber' | 'red' | 'green';
  className?: string;
}) {
  const tones = { brand: 'bg-brand-600', amber: 'bg-risk-mid', red: 'bg-risk-high', green: 'bg-risk-low' };
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-black/[0.06]', className)}>
      <div
        className={cx('h-full rounded-full transition-all duration-700 ease-out', tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** Anillo con el Risk Score, protagonista de la vista de recomendación. */
export function ScoreRing({
  score,
  level,
  size = 112,
  stroke = 9,
  label = 'Risk Score',
}: {
  score: number;
  level: RiskLevel;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const meta = RISK_META[level];
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(28,40,34,.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={meta.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(score, 100)) / 100}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold tracking-tight text-ink">{score}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      </div>
    </div>
  );
}

/** Ficha visual del producto: gradiente de categoría + emoji. Sin dependencias externas. */
export function ProductThumb({
  emoji,
  image,
  size = 'md',
  className,
  children,
}: {
  emoji: string;
  image: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  children?: ReactNode;
}) {
  const sizes = {
    xs: 'h-9 w-9 text-lg rounded-[10px]',
    sm: 'h-12 w-12 text-2xl rounded-xl',
    md: 'h-16 w-16 text-3xl rounded-2xl',
    lg: 'h-24 w-24 text-5xl rounded-2xl',
    xl: 'h-40 w-full text-7xl rounded-2xl',
    full: 'w-full',
  };
  return (
    <div
      className={cx(
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br',
        image,
        sizes[size],
        className,
      )}
    >
      <span className="drop-shadow-sm">{emoji}</span>
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx('h-px w-full bg-black/5', className)} />;
}
