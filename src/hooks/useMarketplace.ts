import { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { ESTABLISHMENTS } from '../data/establishments';
import { computeRisk, finalPrice } from '../lib/ai';
import type { Product } from '../types';

export interface MarketplaceFilters {
  query?: string;
  category?: string;
  establishmentType?: 'todos' | 'supermercado' | 'restaurante';
  establishmentId?: string;
  maxDistance?: number;
  maxPrice?: number;
  minDiscount?: number;
  expiringSoon?: boolean;
  sort?: 'relevancia' | 'descuento' | 'precio' | 'distancia' | 'vencimiento';
}

/** Catálogo público: solo productos publicados y con stock. */
export function useMarketplaceProducts(filters: MarketplaceFilters = {}) {
  const { products } = useApp();

  return useMemo(() => {
    const estById = new Map(ESTABLISHMENTS.map((e) => [e.id, e]));
    let list: Product[] = products.filter((p) => p.status === 'publicado' && p.quantity > 0);

    if (filters.query?.trim()) {
      const q = filters.query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (estById.get(p.establishmentId)?.name.toLowerCase().includes(q) ?? false),
      );
    }
    if (filters.category && filters.category !== 'todas') list = list.filter((p) => p.category === filters.category);
    if (filters.establishmentId) list = list.filter((p) => p.establishmentId === filters.establishmentId);
    if (filters.establishmentType && filters.establishmentType !== 'todos')
      list = list.filter((p) => estById.get(p.establishmentId)?.type === filters.establishmentType);
    if (filters.maxDistance !== undefined)
      list = list.filter((p) => (estById.get(p.establishmentId)?.distanceKm ?? 0) <= filters.maxDistance!);
    if (filters.maxPrice !== undefined) list = list.filter((p) => finalPrice(p) <= filters.maxPrice!);
    if (filters.minDiscount) list = list.filter((p) => p.discountPercent >= filters.minDiscount!);
    if (filters.expiringSoon) list = list.filter((p) => computeRisk(p).daysLeft <= 2);

    const sorted = [...list];
    sorted.sort((a, b) => {
      const da = estById.get(a.establishmentId)?.distanceKm ?? 0;
      const db = estById.get(b.establishmentId)?.distanceKm ?? 0;
      switch (filters.sort) {
        case 'descuento': return b.discountPercent - a.discountPercent;
        case 'precio': return finalPrice(a) - finalPrice(b);
        case 'distancia': return da - db;
        case 'vencimiento': return computeRisk(a).daysLeft - computeRisk(b).daysLeft;
        default:
          // Relevancia: destacados primero, luego mayor urgencia y descuento.
          return (
            Number(b.featured ?? false) - Number(a.featured ?? false) ||
            computeRisk(b).score - computeRisk(a).score
          );
      }
    });
    return sorted;
  }, [products, filters]);
}
