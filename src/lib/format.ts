/** Utilidades de formato para Reverde (Colombia, COP). */

export const cop = (value: number): string =>
  '$' + Math.round(value).toLocaleString('es-CO', { maximumFractionDigits: 0 });

/** Versión compacta para KPIs: $1,84 M */
export const copCompact = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2).replace('.', ',') + ' M';
  if (Math.abs(value) >= 1_000) return '$' + Math.round(value / 1000) + 'k';
  return cop(value);
};

export const kg = (value: number): string =>
  value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';

export const pct = (value: number): string => Math.round(value) + ' %';

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

export const formatDateShort = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return `${formatDateShort(iso)} · ${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
};

export const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const daysUntil = (iso: string): number => {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday().getTime()) / 86_400_000);
};

export const addDays = (days: number, from: Date = new Date()): string => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

export const expiryLabel = (iso: string): string => {
  const d = daysUntil(iso);
  if (d < 0) return 'Vencido';
  if (d === 0) return 'Vence hoy';
  if (d === 1) return 'Vence mañana';
  return `Vence en ${d} días`;
};

export const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
};

export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

export const uid = (prefix = 'id'): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const orderCode = (): string =>
  'RV-' + Math.random().toString(36).slice(2, 7).toUpperCase();

export const initials = (name: string): string =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();

/**
 * Pluraliza la unidad de un producto en español: "11 unidades", "1 bandeja",
 * "3 kg". Sin esto el `${unit}s` literal producía "unidads" y "cajas" mal
 * formados en alertas, inventario y marketplace.
 */
const UNIT_PLURAL: Record<string, string> = {
  unidad: 'unidades',
  kg: 'kg',
  g: 'g',
  litro: 'litros',
  bandeja: 'bandejas',
  caja: 'cajas',
};

export const unitLabel = (unit: string, qty = 2): string =>
  qty === 1 ? unit : (UNIT_PLURAL[unit] ?? `${unit}s`);

/** "11 unidades" · "1 caja" */
export const qtyLabel = (qty: number, unit: string): string => `${qty} ${unitLabel(unit, qty)}`;
