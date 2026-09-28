import type { Product, ProductStatus } from '../types';
import { CATALOG } from './catalog';
import { addDays } from '../lib/format';

/**
 * Fila compacta de inventario semilla.
 * [establecimiento, item, cantidad, días para vencer, días desde ingreso,
 *  ventas/día, tendencia demanda, % descuento, estado]
 */
type Row = [string, string, number, number, number, number, number, number, ProductStatus];

const ROWS: Row[] = [
  // ── Supermercado Verde (sup-1) ──────────────────────────────────────────
  ['sup-1', 'yogur', 24, 2, 12, 6, -0.25, 0, 'en_inventario'],
  ['sup-1', 'yogurGriego', 18, 3, 9, 4.5, -0.1, 35, 'publicado'],
  ['sup-1', 'leche', 40, 5, 14, 12, 0.05, 0, 'en_inventario'],
  ['sup-1', 'aguacate', 15, 4, 6, 1.6, -0.3, 0, 'en_inventario'],
  ['sup-1', 'banano', 22, 3, 5, 7, 0.1, 25, 'publicado'],
  ['sup-1', 'fresas', 12, 2, 4, 3, -0.15, 40, 'publicado'],
  ['sup-1', 'lechuga', 19, 3, 3, 4, -0.2, 0, 'en_inventario'],
  ['sup-1', 'tomate', 28, 6, 4, 9, 0.12, 0, 'en_inventario'],
  ['sup-1', 'pan', 9, 1, 1, 5, -0.05, 45, 'publicado'],
  ['sup-1', 'queso', 11, 9, 10, 2.5, 0.02, 0, 'en_inventario'],
  ['sup-1', 'jugo', 16, 4, 2, 6, 0.2, 20, 'publicado'],
  ['sup-1', 'cajaFrutas', 8, 3, 1, 3, 0.3, 30, 'publicado'],

  // ── Mercado La Colina (sup-2) ───────────────────────────────────────────
  ['sup-2', 'leche', 34, 3, 16, 8, -0.22, 0, 'en_inventario'],
  ['sup-2', 'yogur', 16, 6, 8, 5, 0.08, 0, 'en_inventario'],
  ['sup-2', 'tomate', 31, 2, 6, 6, -0.28, 30, 'publicado'],
  ['sup-2', 'lechuga', 14, 2, 4, 2.4, -0.35, 35, 'publicado'],
  ['sup-2', 'banano', 26, 5, 3, 9, 0.15, 0, 'en_inventario'],
  ['sup-2', 'queso', 8, 4, 12, 1.2, -0.18, 25, 'publicado'],
  ['sup-2', 'jugo', 12, 7, 2, 4, 0.05, 0, 'en_inventario'],
  ['sup-2', 'cajaFrutas', 6, 2, 1, 2.5, 0.25, 35, 'publicado'],
  ['sup-2', 'fresas', 9, 4, 3, 2.8, 0.1, 0, 'en_inventario'],

  // ── Fresco Market Usaquén (sup-3) ───────────────────────────────────────
  ['sup-3', 'yogurGriego', 21, 4, 7, 5.5, -0.12, 0, 'en_inventario'],
  ['sup-3', 'aguacate', 24, 2, 7, 2.2, -0.4, 40, 'publicado'],
  ['sup-3', 'pollo', 7, 2, 1, 3, -0.08, 30, 'publicado'],
  ['sup-3', 'ensalada', 13, 1, 1, 6, 0.1, 40, 'publicado'],
  ['sup-3', 'leche', 44, 8, 10, 14, 0.1, 0, 'en_inventario'],
  ['sup-3', 'pan', 12, 2, 1, 6, 0.05, 0, 'en_inventario'],
  ['sup-3', 'tomate', 18, 7, 3, 7, 0.08, 0, 'en_inventario'],
  ['sup-3', 'cajaFrutas', 5, 3, 1, 2, 0.2, 30, 'publicado'],

  // ── Cocina Raíz (res-1) ─────────────────────────────────────────────────
  ['res-1', 'bowl', 14, 1, 1, 7, -0.15, 35, 'publicado'],
  ['res-1', 'ensalada', 11, 1, 1, 5, -0.2, 0, 'en_inventario'],
  ['res-1', 'pollo', 9, 2, 1, 4, 0.05, 25, 'publicado'],
  ['res-1', 'sandwich', 16, 1, 1, 8, 0.1, 30, 'publicado'],
  ['res-1', 'aguacate', 18, 3, 4, 3, -0.25, 0, 'en_inventario'],
  ['res-1', 'lechuga', 12, 2, 2, 3.5, -0.1, 0, 'en_inventario'],
  ['res-1', 'jugo', 10, 3, 1, 5, 0.18, 20, 'publicado'],

  // ── Panadería El Trigal (res-2) ─────────────────────────────────────────
  ['res-2', 'croissant', 32, 1, 1, 14, -0.1, 40, 'publicado'],
  ['res-2', 'pan', 18, 1, 1, 9, -0.05, 35, 'publicado'],
  ['res-2', 'cajaPan', 10, 1, 1, 4, 0.35, 45, 'publicado'],
  ['res-2', 'sandwich', 12, 1, 1, 6, 0.05, 0, 'en_inventario'],
  ['res-2', 'jugo', 14, 4, 1, 5, 0.1, 0, 'en_inventario'],
  ['res-2', 'queso', 6, 6, 8, 1.5, -0.05, 0, 'en_inventario'],

  // ── Bowl & Green (res-3) ────────────────────────────────────────────────
  ['res-3', 'bowl', 17, 1, 1, 6, -0.3, 0, 'en_inventario'],
  ['res-3', 'ensalada', 15, 2, 1, 5.5, -0.18, 30, 'publicado'],
  ['res-3', 'sandwich', 10, 1, 1, 4.5, 0.02, 0, 'en_inventario'],
  ['res-3', 'aguacate', 20, 3, 5, 2.8, -0.22, 25, 'publicado'],
  ['res-3', 'fresas', 8, 2, 2, 2.5, 0.05, 0, 'en_inventario'],
  ['res-3', 'jugo', 11, 5, 1, 4, 0.12, 0, 'en_inventario'],
];

export function buildSeedProducts(): Product[] {
  return ROWS.map(([estId, key, qty, expiryIn, ageDays, dailySales, trend, discount, status], i) => {
    const c = CATALOG[key];
    return {
      id: `p-${estId}-${key}-${i}`,
      name: c.name,
      description: c.description,
      category: c.category,
      emoji: c.emoji,
      image: c.image,
      photo: c.photo,
      quantity: qty,
      unit: c.unit,
      weightPerUnitKg: c.weightPerUnitKg,
      entryDate: addDays(-ageDays),
      expiryDate: addDays(expiryIn),
      originalPrice: c.price,
      discountPercent: discount,
      establishmentId: estId,
      status,
      dailySales,
      demandTrend: trend,
      isRescueBox: c.isRescueBox,
      featured: discount >= 40,
      createdBy: 'seed',
    } satisfies Product;
  });
}
