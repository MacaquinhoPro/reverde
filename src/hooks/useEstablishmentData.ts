import { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { byEstablishment } from '../data/establishments';
import { buildAlertCopy, buildRecommendation, computeRisk } from '../lib/ai';
import type { Alert, Product, Recommendation, ComputedRisk } from '../types';

export interface ScoredProduct {
  product: Product;
  risk: ComputedRisk;
  recommendation: Recommendation;
}

/** Inventario, ventas y alertas del establecimiento de la sesión actual. */
export function useEstablishmentData(establishmentIdOverride?: string) {
  const { user, products, sales, promoOutcomes, dismissed } = useApp();
  const establishmentId = establishmentIdOverride ?? user?.establishmentId;

  return useMemo(() => {
    const establishment = byEstablishment(establishmentId);
    const myProducts = products.filter((p) => p.establishmentId === establishmentId);
    const mySales = sales.filter((s) => s.establishmentId === establishmentId);

    const scored: ScoredProduct[] = myProducts
      .map((product) => {
        const risk = computeRisk(product);
        return { product, risk, recommendation: buildRecommendation(product, risk, promoOutcomes) };
      })
      .sort((a, b) => b.risk.score - a.risk.score);

    const now = Date.now();
    const alerts: Alert[] = scored
      .filter(({ product, risk }) => {
        if (risk.level === 'bajo' || product.quantity === 0) return false;
        const until = dismissed[product.id];
        return !until || new Date(until).getTime() < now;
      })
      .map(({ product, risk, recommendation }) => {
        const copy = buildAlertCopy(product, risk, recommendation);
        return {
          id: `a_${product.id}`,
          productId: product.id,
          establishmentId: product.establishmentId,
          level: risk.level,
          title: copy.title,
          body: copy.body,
          createdAt: new Date(now - risk.score * 60_000).toISOString(),
        } satisfies Alert;
      });

    return { establishment, establishmentId, myProducts, mySales, scored, alerts };
  }, [establishmentId, products, sales, promoOutcomes, dismissed]);
}
