import { useMemo, useState } from 'react';
import { Brain, Check, ChevronDown, HelpCircle, Sparkles, TrendingUp } from 'lucide-react';
import type { ActionType, Product } from '../types';
import { buildRecommendation, computeRisk, finalPrice } from '../lib/ai';
import { useApp } from '../store/AppContext';
import { cop, cx } from '../lib/format';
import { Button } from './ui/Button';
import { ProgressBar, ScoreRing } from './ui/Primitives';
import { RiskBadge } from './ui/Badge';

export function useProductAi(product: Product) {
  const { promoOutcomes } = useApp();
  return useMemo(() => {
    const risk = computeRisk(product);
    const rec = buildRecommendation(product, risk, promoOutcomes);
    return { risk, rec };
  }, [product, promoOutcomes]);
}

/** "¿Por qué recomendamos esto?" — explicabilidad del modelo. */
export function RiskExplainer({ product, defaultOpen = true }: { product: Product; defaultOpen?: boolean }) {
  const { risk } = useProductAi(product);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-brand-50/60"
      >
        <HelpCircle className="h-4 w-4 shrink-0 text-brand-600" />
        <span className="flex-1 text-[14px] font-bold text-ink">¿Por qué recomendamos esto?</span>
        <ChevronDown className={cx('h-4 w-4 text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="animate-fade-in space-y-3.5 border-t border-black/5 px-4 py-4">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            El modelo estima una probabilidad de desperdicio del{' '}
            <strong className="text-ink">{risk.wasteProbability} %</strong> para este producto. Estos son los
            factores que más pesan:
          </p>
          <ul className="space-y-3">
            {risk.factors.map((f) => (
              <li key={f.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-ink">{f.label}</span>
                  <span className="shrink-0 text-[11.5px] font-bold text-ink-faint">+{f.weight} pts</span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{f.detail}</p>
                <ProgressBar
                  value={(f.weight / 58) * 100}
                  tone={f.weight >= 30 ? 'red' : f.weight >= 14 ? 'amber' : 'green'}
                  className="mt-1.5 h-1.5"
                />
              </li>
            ))}
          </ul>
          <p className="rounded-xl bg-brand-50 px-3 py-2.5 text-[12px] leading-relaxed text-brand-700">
            Risk Score = riesgo por vencimiento + riesgo por stock + riesgo por baja rotación + patrones
            históricos de demanda.
          </p>
        </div>
      )}
    </div>
  );
}

/** Panel completo: score, recomendación, aprendizaje y CTAs. */
export function AiRecommendationPanel({
  product,
  onApplied,
  compact,
}: {
  product: Product;
  onApplied?: (action: ActionType) => void;
  compact?: boolean;
}) {
  const { risk, rec } = useProductAi(product);
  const { applyRecommendation, toast, appliedRecs } = useApp();
  const applied = appliedRecs.includes(product.id);

  const run = (action: ActionType) => {
    const message = applyRecommendation(product.id, action, rec.suggestedDiscount);
    toast({ title: 'Recomendación aplicada', description: message });
    onApplied?.(action);
  };

  const newPrice = Math.round((product.originalPrice * (1 - rec.suggestedDiscount / 100)) / 50) * 50;

  return (
    <div className="overflow-hidden rounded-2xl bg-brand-700 text-white shadow-glow">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-bold">Recomendación de Reverde IA</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
          <Brain className="h-3 w-3" /> {rec.confidence} % confianza
        </span>
      </div>

      <div className="px-4 py-4">
        <div className={cx('flex gap-4', compact ? 'items-center' : 'flex-col sm:flex-row sm:items-center')}>
          {!compact && (
            <div className="shrink-0 rounded-2xl bg-white/10 p-2">
              <ScoreRing score={risk.score} level={risk.level} size={96} stroke={8} label="Riesgo" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold leading-snug">{rec.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-100">{rec.rationale}</p>
          </div>
        </div>

        {rec.suggestedDiscount > product.discountPercent && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/10 px-3.5 py-3">
            <TrendingUp className="h-4 w-4 shrink-0 text-brand-200" />
            <div className="text-[13px]">
              <span className="text-brand-100">Precio sugerido: </span>
              <span className="font-bold">{cop(newPrice)}</span>
              <span className="ml-1.5 text-brand-200 line-through">{cop(finalPrice(product))}</span>
            </div>
          </div>
        )}

        {rec.learningNote && (
          <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-3">
            <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-200">
              <Brain className="h-3 w-3" /> El sistema aprende
            </p>
            <p className="text-[12.5px] leading-relaxed text-brand-100">{rec.learningNote}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {rec.actions.map((a) => (
            <Button
              key={a.type}
              size="sm"
              variant={a.primary ? 'secondary' : 'light'}
              onClick={() => run(a.type)}
              icon={a.primary ? <Sparkles className="h-3.5 w-3.5" /> : undefined}
            >
              {a.label}
            </Button>
          ))}
        </div>

        {applied && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-200">
            <Check className="h-3.5 w-3.5" /> Ya aplicaste una acción sobre este producto.
          </p>
        )}
      </div>
    </div>
  );
}

export function RiskSummaryRow({ product }: { product: Product }) {
  const { risk } = useProductAi(product);
  return (
    <div className="flex items-center gap-2">
      <RiskBadge level={risk.level} score={risk.score} size="sm" />
      <span className="text-[12px] text-ink-faint">{risk.wasteProbability} % desperdicio</span>
    </div>
  );
}
