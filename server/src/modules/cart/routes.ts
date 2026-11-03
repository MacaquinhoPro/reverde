import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, param, validate } from '../../lib/http.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { availableOf, establishmentDTO, productDTO } from '../../domain/serialize.ts';
import { finalPrice } from '../../domain/risk.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/rbac.ts';

export const cartRouter = Router();

cartRouter.use(requireAuth, requirePermission('cart:write'));

/** Carrito activo de la persona, creándolo si hace falta. */
async function activeCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      items: {
        include: { product: { include: { inventory: true, establishment: true } } },
        orderBy: { addedAt: 'asc' },
      },
    },
  });
}

type ActiveCart = Awaited<ReturnType<typeof activeCart>>;

/**
 * Vista del carrito. Los precios SIEMPRE se recalculan aquí: lo que el
 * navegador tenga guardado es solo una pista visual, nunca la fuente del
 * cobro. También se avisa si el stock cambió desde que se agregó el producto.
 */
function cartView(cart: ActiveCart) {
  const lines = cart.items.map((item) => {
    const available = availableOf(item.product);
    const unitPrice = finalPrice(item.product.originalPrice, item.product.discountPercent);
    const sellable = Math.min(item.quantity, available);
    const unpublished = item.product.status !== 'publicado' || item.product.deletedAt !== null;
    return {
      productId: item.productId,
      qty: item.quantity,
      /** Cantidad realmente comprable ahora mismo. */
      sellableQty: unpublished ? 0 : sellable,
      unitPrice,
      unitOriginalPrice: item.product.originalPrice,
      lineTotal: unitPrice * sellable,
      weightKg: +(item.product.weightPerUnitKg * sellable).toFixed(2),
      available,
      issue: unpublished
        ? 'no_disponible'
        : sellable === 0
          ? 'agotado'
          : sellable < item.quantity
            ? 'stock_insuficiente'
            : null,
      product: productDTO(item.product),
      establishment: establishmentDTO(item.product.establishment),
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const original = lines.reduce((s, l) => s + l.unitOriginalPrice * l.sellableQty, 0);

  return {
    id: cart.id,
    items: lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotal,
    originalTotal: original,
    savings: original - subtotal,
    wasteAvoidedKg: +lines.reduce((s, l) => s + l.weightKg, 0).toFixed(2),
    establishmentIds: [...new Set(lines.map((l) => l.product.establishmentId))],
    issues: lines.filter((l) => l.issue).map((l) => ({ productId: l.productId, issue: l.issue, available: l.available })),
  };
}

cartRouter.get(
  '/',
  asyncHandler(async (req, res) => ok(res, cartView(await activeCart(req.auth!.user.id)))),
);

const addSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(999).default(1),
});

cartRouter.post(
  '/items',
  validate({ body: addSchema }),
  asyncHandler(async (req, res) => {
    const { productId, qty } = req.body as z.infer<typeof addSchema>;
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null, status: 'publicado', listing: { status: 'activa' } },
      include: { inventory: true },
    });
    if (!product) throw notFound('Ese producto no está disponible en el marketplace.');

    const available = availableOf(product);
    if (available <= 0) throw badRequest('El producto está agotado.');

    const cart = await prisma.cart.upsert({
      where: { userId: req.auth!.user.id },
      create: { userId: req.auth!.user.id },
      update: {},
    });
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    // El carrito no reserva stock: solo se limita a lo que hay disponible.
    const nextQty = Math.min((existing?.quantity ?? 0) + qty, available);

    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity: nextQty },
      update: { quantity: nextQty },
    });

    return ok(res, cartView(await activeCart(req.auth!.user.id)));
  }),
);

cartRouter.patch(
  '/items/:productId',
  validate({ body: z.object({ qty: z.coerce.number().int().min(0).max(999) }) }),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id;
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw notFound('No tienes un carrito activo.');

    if (req.body.qty === 0) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: param(req, 'productId') } });
      return ok(res, cartView(await activeCart(userId)));
    }

    const product = await prisma.product.findFirst({
      where: { id: param(req, 'productId'), deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw notFound('El producto no existe.');

    const capped = Math.min(req.body.qty, availableOf(product));
    if (capped <= 0) throw badRequest('El producto ya no tiene stock disponible.');

    await prisma.cartItem.update({
      where: { cartId_productId: { cartId: cart.id, productId: param(req, 'productId') } },
      data: { quantity: capped },
    });
    return ok(res, cartView(await activeCart(userId)));
  }),
);

cartRouter.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const cart = await prisma.cart.findUnique({ where: { userId: req.auth!.user.id } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: param(req, 'productId') } });
    }
    return ok(res, cartView(await activeCart(req.auth!.user.id)));
  }),
);

cartRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await prisma.cart.findUnique({ where: { userId: req.auth!.user.id } });
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return ok(res, cartView(await activeCart(req.auth!.user.id)));
  }),
);
