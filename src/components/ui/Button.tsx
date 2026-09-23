import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'light';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-glow hover:shadow-lift',
  secondary: 'bg-brand-100 text-brand-700 hover:bg-brand-200 active:bg-brand-300',
  outline: 'bg-white text-ink border border-black/10 hover:border-brand-300 hover:bg-brand-50',
  ghost: 'bg-transparent text-ink-soft hover:bg-brand-50 hover:text-brand-700',
  danger: 'bg-[#FCEDEC] text-[#B4453D] hover:bg-[#F8DAD8]',
  light: 'bg-white/15 text-white hover:bg-white/25 backdrop-blur',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-[52px] px-7 text-[15px] gap-2.5 rounded-2xl',
};

const base =
  'inline-flex items-center justify-center font-semibold transition-all duration-200 ' +
  'active:scale-[.97] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  to?: string;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  to,
  block,
  icon,
  iconRight,
  className,
  children,
  ...rest
}: Props) {
  const cls = cx(base, VARIANTS[variant], SIZES[size], block && 'w-full', className);
  if (to) {
    return (
      <Link to={to} className={cls}>
        {icon}
        {children}
        {iconRight}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

export function IconButton({
  className,
  children,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-all duration-200',
        'hover:bg-brand-50 hover:text-brand-700 active:scale-95 focus-visible:ring-4 focus-visible:ring-brand-200 focus-visible:outline-none',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
