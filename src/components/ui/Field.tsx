import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Check, Search } from 'lucide-react';
import { cx } from '../../lib/format';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="label-base">{label}</label>}
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('input-base', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('input-base resize-none', className)} rows={3} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'input-base cursor-pointer appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236B756F\' stroke-width=\'2.2\' stroke-linecap=\'round\'><path d=\'M6 9l6 6 6-6\'/></svg>")] bg-[length:18px] bg-[right_0.75rem_center] bg-no-repeat pr-10',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function SearchInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input className="input-base pl-10" {...rest} />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className={cx(
        'inline-flex items-center gap-1 rounded-xl bg-black/[0.035] p-1',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-[9px] font-semibold transition-all duration-200',
            size === 'sm' ? 'px-2.5 py-1.5 text-[12px]' : 'px-3.5 py-2 text-[13px]',
            value === o.value
              ? 'bg-white text-brand-700 shadow-soft'
              : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 text-sm font-medium text-ink"
    >
      <span
        className={cx(
          'relative h-6 w-11 rounded-full transition-colors duration-300',
          checked ? 'bg-brand-600' : 'bg-black/15',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

/**
 * Casilla de verificación con etiqueta rica. Nunca llega marcada por defecto:
 * las autorizaciones de datos personales exigen una manifestación expresa del
 * titular (Decreto 1074 de 2015, art. 2.2.2.25.2.3).
 */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  required,
  className,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          required={required}
          onChange={(e) => onChange(e.target.checked)}
          className={cx(
            'peer h-5 w-5 cursor-pointer appearance-none rounded-[6px] border bg-white transition-all duration-200',
            'checked:border-brand-700 checked:bg-brand-700',
            'focus-visible:ring-4 focus-visible:ring-brand-200',
            checked ? 'border-brand-700' : 'border-black/20 hover:border-brand-400',
          )}
        />
        <Check
          className="pointer-events-none absolute h-3.5 w-3.5 scale-50 text-white opacity-0 transition-all duration-200 peer-checked:scale-100 peer-checked:opacity-100"
          strokeWidth={3.2}
        />
      </span>
      <label htmlFor={inputId} className="cursor-pointer select-none text-[13.5px] leading-relaxed text-ink">
        {label}
        {required && <span className="ml-1 font-bold text-[#B4453D]" title="Obligatorio">*</span>}
        {hint && <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-soft">{hint}</span>}
      </label>
    </div>
  );
}
