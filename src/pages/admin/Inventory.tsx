import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpDown,
  Boxes,
  Filter,
  Pencil,
  Percent,
  Plus,
  Sparkles,
  Store,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Product } from '../../types';
import { useEstablishmentData } from '../../hooks/useEstablishmentData';
import { useApp } from '../../store/AppContext';
import { CATEGORIES } from '../../data/catalog';
import { finalPrice } from '../../lib/ai';
import { cop, cx, expiryLabel, formatDateShort } from '../../lib/format';
import { Card, EmptyState, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, RiskBadge } from '../../components/ui/Badge';
import { Field, SearchInput, Segmented, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { ProductFormModal } from '../../components/ProductFormModal';

type SortKey = 'riesgo' | 'vencimiento' | 'stock' | 'precio' | 'nombre';
type RiskFilter = 'todos' | 'alto' | 'medio' | 'bajo';
type StatusFilter = 'todos' | 'publicado' | 'en_inventario' | 'agotado';

const STATUS_LABEL: Record<string, string> = {
  en_inventario: 'En inventario',
  publicado: 'Publicado',
  agotado: 'Agotado',
  vencido: 'Vencido',
  donado: 'Donado',
};

export default function Inventory() {
  const { establishmentId, scored } = useEstablishmentData();
  const { setPublished, applyDiscount, deleteProduct, toast } = useApp();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('todas');
  const [risk, setRisk] = useState<RiskFilter>('todos');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [sort, setSort] = useState<SortKey>('riesgo');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [discountFor, setDiscountFor] = useState<Product | null>(null);
  const [discountValue, setDiscountValue] = useState(30);
  const [deleteFor, setDeleteFor] = useState<Product | null>(null);

  const rows = useMemo(() => {
    let list = scored;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.product.name.toLowerCase().includes(q) || s.product.category.toLowerCase().includes(q));
    }
    if (category !== 'todas') list = list.filter((s) => s.product.category === category);
    if (risk !== 'todos') list = list.filter((s) => s.risk.level === risk);
    if (status !== 'todos') list = list.filter((s) => s.product.status === status);

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'vencimiento': return a.risk.daysLeft - b.risk.daysLeft;
        case 'stock': return b.product.quantity - a.product.quantity;
        case 'precio': return finalPrice(b.product) - finalPrice(a.product);
        case 'nombre': return a.product.name.localeCompare(b.product.name);
        default: return b.risk.score - a.risk.score;
      }
    });
    return sorted;
  }, [scored, query, category, risk, status, sort]);

  const activeFilters = [category !== 'todas', risk !== 'todos', status !== 'todos'].filter(Boolean).length;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setFormOpen(true); };
  const openDiscount = (p: Product) => { setDiscountFor(p); setDiscountValue(Math.max(p.discountPercent, 25)); };

  const togglePublish = (p: Product) => {
    const next = p.status !== 'publicado';
    setPublished(p.id, next);
    toast({
      title: next ? 'Publicado en el marketplace' : 'Retirado del marketplace',
      description: p.name,
      tone: next ? 'success' : 'info',
    });
  };

  const filterControls = (
    <>
      <Field label="Categoría">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Nivel de riesgo">
        <Select value={risk} onChange={(e) => setRisk(e.target.value as RiskFilter)}>
          <option value="todos">Todos los niveles</option>
          <option value="alto">Alto riesgo</option>
          <option value="medio">Riesgo medio</option>
          <option value="bajo">Bajo riesgo</option>
        </Select>
      </Field>
      <Field label="Estado">
        <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="todos">Todos los estados</option>
          <option value="en_inventario">En inventario</option>
          <option value="publicado">Publicado</option>
          <option value="agotado">Agotado</option>
        </Select>
      </Field>
      <Field label="Ordenar por">
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="riesgo">Mayor riesgo</option>
          <option value="vencimiento">Vence primero</option>
          <option value="stock">Mayor stock</option>
          <option value="precio">Mayor precio</option>
          <option value="nombre">Nombre (A–Z)</option>
        </Select>
      </Field>
    </>
  );

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Inventario"
        subtitle={`${scored.length} productos registrados · el riesgo se recalcula automáticamente`}
        action={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            <span className="hidden sm:inline">Registrar producto</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        }
      />

      {/* Barra de búsqueda y filtros */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            className="flex-1"
            placeholder="Buscar producto o categoría…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="hidden items-center gap-2 lg:flex">
            <Segmented
              size="sm"
              value={risk}
              onChange={setRisk}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'alto', label: 'Alto' },
                { value: 'medio', label: 'Medio' },
                { value: 'bajo', label: 'Bajo' },
              ]}
            />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-48 py-2 text-[13px]">
              <option value="todas">Todas las categorías</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-44 py-2 text-[13px]">
              <option value="riesgo">Mayor riesgo</option>
              <option value="vencimiento">Vence primero</option>
              <option value="stock">Mayor stock</option>
              <option value="precio">Mayor precio</option>
              <option value="nombre">Nombre (A–Z)</option>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            icon={<Filter className="h-4 w-4" />}
            onClick={() => setFiltersOpen(true)}
          >
            Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
        </div>

        {activeFilters > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {category !== 'todas' && (
              <button onClick={() => setCategory('todas')} className="chip bg-brand-50 text-brand-700">
                {category} <X className="h-3 w-3" />
              </button>
            )}
            {risk !== 'todos' && (
              <button onClick={() => setRisk('todos')} className="chip bg-brand-50 text-brand-700">
                Riesgo {risk} <X className="h-3 w-3" />
              </button>
            )}
            {status !== 'todos' && (
              <button onClick={() => setStatus('todos')} className="chip bg-brand-50 text-brand-700">
                {STATUS_LABEL[status]} <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title="No encontramos productos"
          description="Ajusta los filtros o registra un producto nuevo para empezar."
          action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Registrar producto</Button>}
        />
      ) : (
        <>
          {/* ── Tabla (escritorio) ─────────────────────────────────── */}
          <Card className="hidden overflow-hidden p-0 lg:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/5 bg-canvas/60 text-[11.5px] uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-3 py-3 font-semibold">Stock</th>
                  <th className="px-3 py-3 font-semibold">Ingreso</th>
                  <th className="px-3 py-3 font-semibold">Vence</th>
                  <th className="px-3 py-3 font-semibold">Precio</th>
                  <th className="px-3 py-3 font-semibold">
                    <button onClick={() => setSort('riesgo')} className="inline-flex items-center gap-1 hover:text-ink">
                      Riesgo <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map(({ product, risk: r, recommendation }) => (
                  <tr key={product.id} className="group transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductThumb emoji={product.emoji} image={product.image} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-ink">{product.name}</p>
                          <p className="truncate text-[11.5px] text-ink-faint">{product.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[13px] text-ink">
                      {product.quantity} <span className="text-ink-faint">{product.unit}s</span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-soft">{formatDateShort(product.entryDate)}</td>
                    <td className="px-3 py-3">
                      <p className="text-[12.5px] font-medium text-ink">{formatDateShort(product.expiryDate)}</p>
                      <p className={cx('text-[11.5px]', r.daysLeft <= 1 ? 'text-[#B4453D]' : 'text-ink-faint')}>
                        {expiryLabel(product.expiryDate)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[13px] font-bold text-brand-700">{cop(finalPrice(product))}</p>
                      {product.discountPercent > 0 && (
                        <p className="text-[11.5px] text-ink-faint line-through">{cop(product.originalPrice)}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <RiskBadge level={r.level} score={r.score} size="sm" />
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={product.status === 'publicado' ? 'brand' : 'neutral'}>
                        {STATUS_LABEL[product.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        <Link to={`/app/alertas/${product.id}`}>
                          <IconButton label="Ver recomendación IA" className="h-9 w-9">
                            <Sparkles className="h-4 w-4" />
                          </IconButton>
                        </Link>
                        <IconButton label="Aplicar descuento" className="h-9 w-9" onClick={() => openDiscount(product)}>
                          <Percent className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={product.status === 'publicado' ? 'Retirar del marketplace' : 'Publicar en marketplace'}
                          className={cx('h-9 w-9', product.status === 'publicado' && 'text-brand-700')}
                          onClick={() => togglePublish(product)}
                        >
                          {product.status === 'publicado' ? <Store className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                        </IconButton>
                        <IconButton label="Editar" className="h-9 w-9" onClick={() => openEdit(product)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Eliminar" className="h-9 w-9 hover:bg-[#FCEDEC] hover:text-[#B4453D]" onClick={() => setDeleteFor(product)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                      <p className="mt-0.5 text-right text-[11px] text-ink-faint">
                        IA: {recommendation.suggestedDiscount} % sugerido
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* ── Tarjetas (móvil) ───────────────────────────────────── */}
          <div className="space-y-2.5 lg:hidden">
            {rows.map(({ product, risk: r }) => (
              <Card key={product.id} className="p-3.5">
                <div className="flex gap-3">
                  <ProductThumb emoji={product.emoji} image={product.image} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[14px] font-bold text-ink">{product.name}</p>
                      <RiskBadge level={r.level} score={r.score} size="sm" showScore={false} />
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-soft">
                      {product.quantity} {product.unit}s · {expiryLabel(product.expiryDate)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[14px] font-extrabold text-brand-700">{cop(finalPrice(product))}</span>
                      {product.discountPercent > 0 && (
                        <span className="text-[12px] text-ink-faint line-through">{cop(product.originalPrice)}</span>
                      )}
                      <Badge tone={product.status === 'publicado' ? 'brand' : 'neutral'} className="ml-auto">
                        {STATUS_LABEL[product.status]}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  <Button to={`/app/alertas/${product.id}`} variant="secondary" size="sm" className="px-0">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="px-0" onClick={() => openDiscount(product)}>
                    <Percent className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="px-0" onClick={() => togglePublish(product)}>
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="px-0" onClick={() => openEdit(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── Modales ──────────────────────────────────────────────── */}
      {establishmentId && (
        <ProductFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          product={editing}
          establishmentId={establishmentId}
        />
      )}

      <Modal
        open={!!discountFor}
        onClose={() => setDiscountFor(null)}
        title="Aplicar descuento"
        subtitle={discountFor?.name}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" block onClick={() => setDiscountFor(null)}>Cancelar</Button>
            <Button
              size="sm"
              block
              onClick={() => {
                if (!discountFor) return;
                applyDiscount(discountFor.id, discountValue);
                toast({ title: `Descuento del ${discountValue} % aplicado`, description: discountFor.name });
                setDiscountFor(null);
              }}
            >
              Aplicar {discountValue} %
            </Button>
          </div>
        }
      >
        {discountFor && (
          <div className="py-2">
            <input
              type="range"
              min={0}
              max={70}
              step={5}
              value={discountValue}
              onChange={(e) => setDiscountValue(+e.target.value)}
              className="w-full accent-brand-700"
            />
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-50 p-4">
              <div>
                <p className="text-[12px] text-ink-soft">Precio Reverde</p>
                <p className="text-[24px] font-extrabold tracking-tight text-brand-700">
                  {cop(Math.round((discountFor.originalPrice * (1 - discountValue / 100)) / 50) * 50)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-ink-soft">Antes</p>
                <p className="text-[16px] font-semibold text-ink-faint line-through">{cop(discountFor.originalPrice)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title="Eliminar producto"
        subtitle={`¿Seguro que quieres eliminar ${deleteFor?.name}? Esta acción no se puede deshacer.`}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" block onClick={() => setDeleteFor(null)}>Cancelar</Button>
            <Button
              variant="danger"
              size="sm"
              block
              onClick={() => {
                if (!deleteFor) return;
                deleteProduct(deleteFor.id);
                toast({ title: 'Producto eliminado', description: deleteFor.name, tone: 'warn' });
                setDeleteFor(null);
              }}
            >
              Eliminar
            </Button>
          </div>
        }
      >
        <div />
      </Modal>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros" size="sm"
        footer={<Button block size="sm" onClick={() => setFiltersOpen(false)}>Ver {rows.length} productos</Button>}
      >
        <div className="space-y-4 py-1">{filterControls}</div>
      </Modal>
    </div>
  );
}
