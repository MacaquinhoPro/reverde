/**
 * Gráficas de Reverde.
 *
 * Todas son de una sola serie: cada medida vive en su propio eje y en su propia
 * tarjeta (nunca dos escalas en un mismo gráfico). La paleta de riesgo fue
 * validada para daltonismo y siempre va acompañada de texto, nunca solo color.
 */
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/Primitives';
import { cx } from '../../lib/format';

const INK_MUTED = '#9BA5A0';
const GRID = 'rgba(28,40,34,0.07)';
export const BRAND = '#1F5D42';
export const BRAND_SOFT = '#72B58B';
/** Paleta de riesgo validada (contraste + separación para daltonismo). */
export const RISK_COLORS = { bajo: '#3F9E6B', medio: '#E0A81C', alto: '#C8453E' } as const;

const axis = {
  tick: { fill: INK_MUTED, fontSize: 11, fontWeight: 600 },
  axisLine: false as const,
  tickLine: false as const,
};

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  unit,
}: {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
  formatter?: (v: number) => string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-xl border border-black/5 bg-white/97 px-3 py-2 shadow-lift backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 text-[15px] font-extrabold text-ink">
        {formatter ? formatter(v) : v.toLocaleString('es-CO')}
        {unit && <span className="ml-1 text-[12px] font-semibold text-ink-soft">{unit}</span>}
      </p>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx('p-4 sm:p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14.5px] font-bold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] text-ink-soft">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

interface SeriesProps {
  data: Record<string, unknown>[];
  dataKey: string;
  height?: number;
  formatter?: (v: number) => string;
  unit?: string;
}

export function AreaTrend({ data, dataKey, height = 190, formatter, unit }: SeriesProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="rvArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={46} />
        <Tooltip
          cursor={{ stroke: BRAND_SOFT, strokeWidth: 1, strokeDasharray: '4 4' }}
          content={<ChartTooltip formatter={formatter} unit={unit} />}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#rvArea)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarTrend({ data, dataKey, height = 190, formatter, unit, color = BRAND }: SeriesProps & { color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }} barCategoryGap="28%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={46} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
        <Tooltip
          cursor={{ fill: 'rgba(31,93,66,0.05)' }}
          content={<ChartTooltip formatter={formatter} unit={unit} />}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({ data, dataKey, height = 190, formatter, unit }: SeriesProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={46} />
        <Tooltip
          cursor={{ stroke: BRAND_SOFT, strokeWidth: 1, strokeDasharray: '4 4' }}
          content={<ChartTooltip formatter={formatter} unit={unit} />}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={BRAND}
          strokeWidth={2}
          dot={{ r: 3, fill: '#fff', stroke: BRAND, strokeWidth: 2 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Distribución de riesgo: barras horizontales con etiqueta de texto siempre visible. */
export function RiskDistribution({
  low,
  medium,
  high,
}: {
  low: number;
  medium: number;
  high: number;
}) {
  const total = Math.max(low + medium + high, 1);
  const rows = [
    { key: 'alto', label: 'Alto riesgo', value: high, color: RISK_COLORS.alto },
    { key: 'medio', label: 'Riesgo medio', value: medium, color: RISK_COLORS.medio },
    { key: 'bajo', label: 'Bajo riesgo', value: low, color: RISK_COLORS.bajo },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
            <span className="flex items-center gap-2 font-medium text-ink">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="font-bold text-ink">
              {r.value}
              <span className="ml-1 font-medium text-ink-faint">
                · {Math.round((r.value / total) * 100)} %
              </span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(r.value / total) * 100}%`, background: r.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Riesgo promedio por categoría: una sola medida, color por nivel + etiqueta. */
export function CategoryRiskChart({
  data,
  height = 210,
}: {
  data: { category: string; score: number; items: number }[];
  height?: number;
}) {
  const colorFor = (s: number) => (s >= 70 ? RISK_COLORS.alto : s >= 40 ? RISK_COLORS.medio : RISK_COLORS.bajo);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }} barCategoryGap="26%">
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} {...axis} />
        <YAxis type="category" dataKey="category" {...axis} width={118} />
        <Tooltip cursor={{ fill: 'rgba(31,93,66,0.05)' }} content={<ChartTooltip unit="/100" />} />
        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.category} fill={colorFor(d.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Mini sparkline para tarjetas compactas. */
export function Sparkline({ data, dataKey }: { data: Record<string, unknown>[]; dataKey: string }) {
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="rvSpark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND_SOFT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND_SOFT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={BRAND_SOFT} strokeWidth={2} fill="url(#rvSpark)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
