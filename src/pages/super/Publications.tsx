import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ShoppingBag } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { ESTABLISHMENTS, byEstablishment } from '../../data/establishments';
import { CATEGORIES } from '../../data/catalog';
import { computeRisk, finalPrice } from '../../lib/ai';
import { cop, expiryLabel, kg, qtyLabel, unitLabel } from '../../lib/format';
import { Card, EmptyState, KpiCard, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Badge, RiskBadge } from '../../components/ui/Badge';
import { SearchInput, Select } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';

export default function Publications() {
  const { products } = useApp();
  const [query, setQuery] = useState('');
  const [establishment, setEstablishment] = useState('todos');
  const [category, setCategory] = useState('todas');

  const rows = useMemo(() => {
    return products
      .filter((p) => p.status === 'publicado')
      .filter((p) => (establishment === 'todos' ? true : p.establishmentId === establishment))
      .filter((p) => (category === 'todas' ? true : p.category === category))
      .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
      .map((p) => ({ product: p, risk: computeRisk(p) }))
      .sort((a, b) => b.risk.score - a.risk.score);
  }, [products, query, establishment, category]);

  const totalValue = rows.reduce((s, r) => s + finalPrice(r.product) * r.product.quantity, 0);
  const totalKg = rows.reduce((s, r) => s + r.product.weightPerUnitKg * r.product.quantity, 0);
  const avgDiscount = rows.length ? rows.reduce((s, r) => s + r.product.discountPercent, 0) / rows.length : 0;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Publicaciones de la red"
        subtitle="Todo lo que está disponible ahora mismo en el marketplace de Reverde."
        action={
          <Button to="/tienda/explorar" variant="outline" size="sm" icon={<Eye className="h-4 w-4" />}>
            Ver marketplace
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Publicaciones activas" value={String(rows.length)} icon={<ShoppingBag className="h-4 w-4" />} tone="brand" />
        <KpiCard label="Valor publicado" value={cop(totalValue)} icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard label="Alimento en oferta" value={totalKg.toFixed(1).replace('.', ',')} unit="kg" icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard label="Descuento promedio" value={`${Math.round(avgDiscount)} %`} icon={<ShoppingBag className="h-4 w-4" />} />
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <SearchInput className="flex-1" placeholder="Buscar producto…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select value={establishment} onChange={(e) => setEstablishment(e.target.value)} className="lg:w-56">
            <option value="todos">Todos los establecimientos</option>
            {ESTABLISHMENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="lg:w-52">
            <option value="todas">Todas las categorías</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="Sin publicaciones" description="Ningún producto coincide con los filtros seleccionados." />
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 lg:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/5 bg-canvas/60 text-[11.5px] uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-3 py-3 font-semibold">Establecimiento</th>
                  <th className="px-3 py-3 font-semibold">Stock</th>
                  <th className="px-3 py-3 font-semibold">Vence</th>
                  <th className="px-3 py-3 font-semibold">Precio</th>
                  <th className="px-3 py-3 font-semibold">Desc.</th>
                  <th className="px-4 py-3 font-semibold">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map(({ product, risk }) => (
                  <tr key={product.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <Link to={`/tienda/producto/${product.id}`} className="flex items-center gap-3">
                        <ProductThumb emoji={product.emoji} image={product.image} photo={product.photo} alt={product.name} size="xs" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-ink hover:text-brand-700">{product.name}</span>
                          <span className="block truncate text-[11.5px] text-ink-faint">{product.category}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-soft">{byEstablishment(product.establishmentId)?.name}</td>
                    <td className="px-3 py-3 text-[13px] text-ink">
                      {product.quantity} <span className="text-ink-faint">{unitLabel(product.unit, product.quantity)}</span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-soft">{expiryLabel(product.expiryDate)}</td>
                    <td className="px-3 py-3 text-[13px] font-bold text-brand-700">{cop(finalPrice(product))}</td>
                    <td className="px-3 py-3"><Badge tone="brand">−{product.discountPercent} %</Badge></td>
                    <td className="px-4 py-3"><RiskBadge level={risk.level} score={risk.score} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map(({ product, risk }) => (
              <Card key={product.id} className="p-3.5">
                <div className="flex gap-3">
                  <ProductThumb emoji={product.emoji} image={product.image} photo={product.photo} alt={product.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-ink">{product.name}</p>
                    <p className="truncate text-[12px] text-ink-soft">{byEstablishment(product.establishmentId)?.name}</p>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      {qtyLabel(product.quantity, product.unit)} · {kg(product.weightPerUnitKg * product.quantity)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[14px] font-extrabold text-brand-700">{cop(finalPrice(product))}</span>
                      <RiskBadge level={risk.level} score={risk.score} size="sm" showScore={false} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
