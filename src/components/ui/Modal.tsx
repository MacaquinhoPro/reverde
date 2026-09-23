import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/format';
import { IconButton } from './Button';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' };

/** Modal centrado en escritorio, bottom sheet en móvil. */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift',
          'animate-slide-up sm:animate-scale-in sm:rounded-3xl',
          SIZES[size],
        )}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-black/10 sm:hidden" />
        {(title || subtitle) && (
          <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-4 sm:px-7 sm:pt-6">
            <div>
              {title && <h2 className="text-[19px] font-bold text-ink">{title}</h2>}
              {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{subtitle}</p>}
            </div>
            <IconButton label="Cerrar" onClick={onClose} className="-mr-2 -mt-1 shrink-0">
              <X className="h-5 w-5" />
            </IconButton>
          </header>
        )}
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-5 sm:px-7">{children}</div>
        {footer && (
          <footer className="safe-bottom shrink-0 border-t border-black/5 bg-canvas px-5 py-4 sm:px-7">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Panel lateral (escritorio) / bottom sheet (móvil) para filtros y perfil. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: Omit<Props, 'size'>) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-stretch sm:justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-[3px]" onClick={onClose} />
      <aside
        className={cx(
          'relative flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-white shadow-lift animate-slide-up',
          'sm:max-h-none sm:w-[400px] sm:rounded-none sm:rounded-l-3xl sm:animate-fade-in',
        )}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-black/10 sm:hidden" />
        <header className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[17px] font-bold text-ink">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose} className="-mr-2">
            <X className="h-5 w-5" />
          </IconButton>
        </header>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4 sm:px-6">{children}</div>
        {footer && (
          <footer className="safe-bottom shrink-0 border-t border-black/5 bg-canvas px-5 py-4 sm:px-6">{footer}</footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
