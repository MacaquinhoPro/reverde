import { useEffect, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import type { Category, Product, Unit } from '../types';
import { CATEGORIES, CATEGORY_STYLE, EMOJI_OPTIONS, UNITS } from '../data/catalog';
import { useApp } from '../store/AppContext';
import { computeRisk, finalPrice } from '../lib/ai';
import { addDays, cop, cx } from '../lib/format';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Input, Select, Textarea, Toggle } from './ui/Field';
import { RiskBadge } from './ui/Badge';
import { ProductThumb } from './ui/Primitives';

const toInputDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

interface Draft {
  name: string;
  description: string;
  category: Category;
  emoji: string;
  quantity: number;
  unit: Unit;
  weightPerUnitKg: number;
  entryDate: string;
  expiryDate: string;
  originalPrice: number;
  discountPercent: number;
  dailySales: number;
  publish: boolean;
}

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  category: 'Lácteos',
  emoji: CATEGORY_STYLE['Lácteos'].emoji,
  quantity: 10,
  unit: 'unidad',
  weightPerUnitKg: 0.25,
  entryDate: toInputDate(addDays(0)),
  expiryDate: toInputDate(addDays(3)),
  originalPrice: 5000,
  discountPercent: 0,
  dailySales: 3,
  publish: false,
});

const fromProduct = (p: Product): Draft => ({
  name: p.name,
  description: p.description,
  category: p.category,
  emoji: p.emoji,
  quantity: p.quantity,
  unit: p.unit,
  weightPerUnitKg: p.weightPerUnitKg,
  entryDate: toInputDate(p.entryDate),
  expiryDate: toInputDate(p.expiryDate),
  originalPrice: p.originalPrice,
  discountPercent: p.discountPercent,
  dailySales: p.dailySales,
  publish: p.status === 'publicado',
});

export function ProductFormModal({
  open,
  onClose,
  product,
  establishmentId,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  establishmentId: string;
}) {
  const { addProduct, updateProduct, deleteProduct, toast } = useApp();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(product ? fromProduct(product) : emptyDraft());
      setConfirmDelete(false);
    }
  }, [open, product]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Vista previa de riesgo en vivo mientras se edita el formulario.
  const preview: Product = {
    id: product?.id ?? 'preview',
    name: draft.name || 'Nuevo producto',
    description: draft.description,
    category: draft.category,
    emoji: draft.emoji,
    image: CATEGORY_STYLE[draft.category].image,
    quantity: draft.quantity,
    unit: draft.unit,
    weightPerUnitKg: draft.weightPerUnitKg,
    entryDate: new Date(draft.entryDate).toISOString(),
    expiryDate: new Date(draft.expiryDate).toISOString(),
    originalPrice: draft.originalPrice,
    discountPercent: draft.discountPercent,
    establishmentId,
    status: draft.publish ? 'publicado' : 'en_inventario',
    dailySales: draft.dailySales,
    demandTrend: product?.demandTrend ?? 0,
    createdBy: 'user',
  };
  const risk = computeRisk(preview);
  const valid = draft.name.trim().length >= 3 && draft.quantity > 0 && draft.originalPrice > 0;

  const submit = () => {
    if (!valid) return;
    if (product) {
      updateProduct(product.id, { ...preview, id: product.id });
      toast({ title: 'Producto actualizado', description: `${preview.name} se guardó correctamente.` });
    } else {
      const { id: _ignored, ...rest } = preview;
      void _ignored;
      addProduct(rest);
      toast({
        title: 'Producto creado',
        description: `${preview.name} ya aparece en tu inventario${draft.publish ? ' y en el marketplace' : ''}.`,
      });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Editar producto' : 'Registrar producto'}
      subtitle="Reverde calcula el riesgo automáticamente con estos datos."
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          {product && (
            <Button
              variant={confirmDelete ? 'danger' : 'ghost'}
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                deleteProduct(product.id);
                toast({ title: 'Producto eliminado', description: product.name, tone: 'warn' });
                onClose();
              }}
            >
              {confirmDelete ? 'Confirmar eliminación' : 'Eliminar'}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={!valid}>
            {product ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 pb-2 sm:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <Field label="Nombre del producto">
            <Input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Yogur natural" />
          </Field>

          <Field label="Descripción">
            <Textarea
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Breve descripción que verá el cliente en el marketplace."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <Select
                value={draft.category}
                onChange={(e) => {
                  const c = e.target.value as Category;
                  setDraft((d) => ({ ...d, category: c, emoji: CATEGORY_STYLE[c].emoji }));
                }}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Unidad">
              <Select value={draft.unit} onChange={(e) => set('unit', e.target.value as Unit)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad / stock">
              <Input type="number" min={0} value={draft.quantity} onChange={(e) => set('quantity', +e.target.value)} />
            </Field>
            <Field label="Peso por unidad (kg)" hint="Se usa para calcular el desperdicio evitado.">
              <Input type="number" min={0} step={0.05} value={draft.weightPerUnitKg} onChange={(e) => set('weightPerUnitKg', +e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha de ingreso">
              <Input type="date" value={draft.entryDate} onChange={(e) => set('entryDate', e.target.value)} />
            </Field>
            <Field label="Fecha de vencimiento">
              <Input type="date" value={draft.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio original (COP)">
              <Input type="number" min={0} step={100} value={draft.originalPrice} onChange={(e) => set('originalPrice', +e.target.value)} />
            </Field>
            <Field label="Ventas promedio por día" hint="Alimenta el cálculo de rotación.">
              <Input type="number" min={0} step={0.5} value={draft.dailySales} onChange={(e) => set('dailySales', +e.target.value)} />
            </Field>
          </div>

          <Field label={`Descuento Reverde · ${draft.discountPercent} %`}>
            <input
              type="range"
              min={0}
              max={70}
              step={5}
              value={draft.discountPercent}
              onChange={(e) => set('discountPercent', +e.target.value)}
              className="w-full accent-brand-700"
            />
            <div className="mt-1.5 flex items-center justify-between text-[12.5px]">
              <span className="text-ink-faint">Precio Reverde</span>
              <span className="font-bold text-brand-700">
                {cop(finalPrice(preview))}
                {draft.discountPercent > 0 && (
                  <span className="ml-2 font-medium text-ink-faint line-through">{cop(draft.originalPrice)}</span>
                )}
              </span>
            </div>
          </Field>

          <Field label="Emoji del producto">
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => set('emoji', e)}
                  className={cx(
                    'flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-all',
                    draft.emoji === e ? 'bg-brand-700 ring-4 ring-brand-100' : 'bg-black/[0.035] hover:bg-brand-50',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <div className="rounded-2xl border border-black/5 p-4">
            <Toggle checked={draft.publish} onChange={(v) => set('publish', v)} label="Publicar en el marketplace" />
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              Si lo activas, los clientes verán este producto en Reverde con el precio con descuento.
            </p>
          </div>
        </div>

        {/* Vista previa */}
        <aside className="space-y-3 sm:sticky sm:top-2 sm:self-start">
          <div className="card overflow-hidden">
            <ProductThumb emoji={draft.emoji} image={CATEGORY_STYLE[draft.category].image} size="full" className="h-32 rounded-none text-5xl" />
            <div className="p-3.5">
              <p className="text-[14px] font-bold text-ink">{draft.name || 'Nuevo producto'}</p>
              <p className="mt-0.5 text-[12px] text-ink-soft">{draft.category}</p>
              <p className="mt-2 text-[17px] font-extrabold text-brand-700">{cop(finalPrice(preview))}</p>
            </div>
          </div>

          <div className="card p-4">
            <p className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
              <Sparkles className="h-3.5 w-3.5" /> Riesgo estimado
            </p>
            <div className="mt-2.5">
              <RiskBadge level={risk.level} score={risk.score} />
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
              {risk.factors[0]?.detail}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
              Probabilidad de desperdicio: <strong className="text-ink">{risk.wasteProbability} %</strong>
            </p>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
