import { cx } from '../lib/format';

type Tone = 'dark' | 'light' | 'mono';

interface MarkProps {
  className?: string;
  tone?: Tone;
  /** Fondo circular sólido detrás del isotipo */
  boxed?: boolean;
}

const TONES: Record<Tone, { ring: string; leaf: string; rib: string; box: string }> = {
  dark: { ring: '#72B58B', leaf: '#1F5D42', rib: '#DDEFE4', box: '#FFFFFF' },
  light: { ring: '#9ECFB2', leaf: '#DDEFE4', rib: '#1F5D42', box: 'rgba(255,255,255,0.12)' },
  mono: { ring: 'currentColor', leaf: 'currentColor', rib: 'transparent', box: 'transparent' },
};

export function ReverdeMark({ className, tone = 'dark', boxed = false }: MarkProps) {
  const c = TONES[tone];
  return (
    <svg viewBox="0 0 64 64" className={cx('shrink-0', className)} fill="none" aria-hidden="true">
      {boxed && <rect width="64" height="64" rx="18" fill={c.box} />}
      {/* Ciclo: dos flechas circulares = el alimento vuelve a generar valor */}
      <g fill={c.ring} stroke={c.ring} strokeWidth="4.6" strokeLinecap="round">
        <path d="M 6.08 26.49 A 26.5 26.5 0 0 1 52 14.61" fill="none" />
        <path d="M 56.02 20.8 L 55.92 11.2 L 48.08 18.03 Z" stroke="none" />
        <path d="M 57.92 37.51 A 26.5 26.5 0 0 1 12 49.39" fill="none" />
        <path d="M 7.98 43.2 L 8.08 52.8 L 15.92 45.97 Z" stroke="none" />
      </g>
      {/* Hoja: frescura y origen natural del alimento */}
      <path d="M19 45 A26 26 0 0 1 45 19 A26 26 0 0 1 19 45 Z" fill={c.leaf} />
      <path d="M21.5 42.5 L42.5 21.5" stroke={c.rib} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M27 37 L26 30.5 M37 27 L33.5 28" stroke={c.rib} strokeWidth="2.2" strokeLinecap="round" opacity=".75" />
    </svg>
  );
}

interface LogoProps extends MarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
}

const SIZES = {
  sm: { mark: 'h-7 w-7', text: 'text-[17px]', tag: 'text-[10px]' },
  md: { mark: 'h-9 w-9', text: 'text-[21px]', tag: 'text-[11px]' },
  lg: { mark: 'h-12 w-12', text: 'text-[28px]', tag: 'text-xs' },
  xl: { mark: 'h-16 w-16', text: 'text-[38px]', tag: 'text-sm' },
};

export function Logo({ size = 'md', tone = 'dark', showTagline, boxed, className }: LogoProps) {
  const s = SIZES[size];
  const light = tone === 'light';
  return (
    <span className={cx('inline-flex items-center gap-2.5 select-none', className)}>
      <ReverdeMark className={s.mark} tone={tone} boxed={boxed} />
      <span className="flex flex-col leading-none">
        <span className={cx('font-extrabold tracking-[-0.035em]', s.text, light ? 'text-white' : 'text-brand-700')}>
          Re
          <span className={cx('font-semibold', light ? 'text-brand-200' : 'text-brand-400')}>verde</span>
        </span>
        {showTagline && (
          <span className={cx('mt-1 font-medium tracking-wide uppercase', s.tag, light ? 'text-brand-200/80' : 'text-ink-soft')}>
            Menos desperdicio, más valor
          </span>
        )}
      </span>
    </span>
  );
}
