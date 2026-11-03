import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { env } from '../../config/env.ts';
import { asyncHandler, ok, param, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { badRequest, forbidden, notFound } from '../../lib/errors.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { rateLimit } from '../../middleware/rateLimit.ts';
import { gateway } from './index.ts';
import { buildMockEvent } from './mock.ts';
import { processProviderEvent } from './service.ts';

/**
 * El webhook va en su propio router porque se monta ANTES de la sesión y del
 * CSRF: no lo origina un navegador y su autenticidad es la firma del evento.
 * Todo lo demás (configuración, estado, simulador) sí pasa por la sesión.
 */
export const paymentsWebhookRouter = Router();

export const paymentsRouter = Router();

/** Configuración pública de la pasarela (nunca llaves privadas). */
paymentsRouter.get('/config', (_req, res) =>
  ok(res, {
    provider: env.PAYMENTS_PROVIDER,
    currency: env.PAYMENTS_CURRENCY,
    publicKey: env.PAYMENTS_PROVIDER === 'wompi' ? (env.WOMPI_PUBLIC_KEY ?? null) : null,
    sandbox: !env.PAYMENTS_LIVE_ENABLED,
    expiryMinutes: env.PAYMENT_EXPIRY_MINUTES,
    methods:
      env.PAYMENTS_PROVIDER === 'wompi'
        ? ['tarjeta', 'pse', 'nequi', 'bancolombia', 'establecimiento']
        : ['tarjeta', 'pse', 'establecimiento'],
  }),
);

/**
 * Estado del pago de un pedido. El frontend lo consulta mientras espera el
 * webhook: la redirección del navegador NO confirma nada por sí sola.
 */
paymentsRouter.get(
  '/status/:orderId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: param(req, 'orderId') },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw notFound('El pedido no existe.');
    if (order.userId !== req.auth!.user.id && req.auth!.user.role !== 'superadmin') {
      throw notFound('El pedido no existe.');
    }
    const payment = order.payments[0];
    return ok(res, {
      orderId: order.id,
      orderCode: order.code,
      orderStatus: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: payment?.status ?? null,
      provider: payment?.provider ?? null,
      reference: payment?.reference ?? null,
      checkoutUrl: payment?.checkoutUrl ?? null,
      amountInCents: payment?.amountInCents ?? null,
      paidAt: order.paidAt?.toISOString() ?? null,
      expiresAt: order.expiresAt?.toISOString() ?? null,
    });
  }),
);

/**
 * Webhook del proveedor.
 *
 * - Sin CSRF y sin sesión: no lo origina un navegador. Su autenticidad viene
 *   de la firma del evento, que se valida antes de hacer cualquier cosa.
 * - Responde 200 incluso cuando descarta el evento: un 5xx hace que la
 *   pasarela reintente en bucle. El resultado real queda en PaymentEvent.
 * - Requiere el cuerpo crudo (express.raw) para poder calcular el checksum.
 */
paymentsWebhookRouter.post(
  '/webhook/:provider',
  rateLimit({ max: 600, windowSeconds: 60, keyPrefix: 'webhook' }),
  asyncHandler(async (req: Request, res) => {
    const expected = gateway().name;
    if (param(req, 'provider') !== expected) {
      // No se revela qué proveedor está activo.
      return res.status(202).json({ received: true });
    }

    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    let outcome: string;
    try {
      const event = gateway().parseEvent(raw, req.headers);
      outcome = await processProviderEvent(event);
    } catch {
      // Cuerpo ilegible: se acepta para que no haya reintentos infinitos.
      return res.status(202).json({ received: true, outcome: 'unparseable' });
    }
    return res.status(200).json({ received: true, outcome });
  }),
);

/* ───────────────── Simulador de checkout (no producción) ───────────────── */

/**
 * Página del checkout simulado. Permite recorrer el flujo real —aprobar o
 * rechazar— desde el navegador sin una cuenta de pasarela. Solo existe
 * cuando PAYMENTS_PROVIDER=mock, que la validación de arranque prohíbe en
 * producción.
 */
paymentsRouter.get(
  '/mock/checkout',
  asyncHandler(async (req, res) => {
    if (env.PAYMENTS_PROVIDER !== 'mock') throw notFound();
    const reference = String(req.query.reference ?? '');
    const payment = await prisma.payment.findUnique({ where: { reference }, include: { order: true } });
    if (!payment) throw notFound('Referencia de pago desconocida.');

    const amount = (payment.amountInCents / 100).toLocaleString('es-CO');
    const redirect = String(req.query['redirect-url'] ?? `${env.APP_URL}/tienda/confirmacion/${payment.orderId}`);
    const page = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout simulado · Reverde</title>
<style>
  :root{color-scheme:light}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F7F4;font:15px/1.5 system-ui,-apple-system,sans-serif;color:#1C2B23;padding:16px}
  .card{background:#fff;border-radius:20px;padding:28px;max-width:420px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.08)}
  h1{font-size:19px;margin:0 0 6px}
  p{margin:0 0 4px;color:#55665D;font-size:13.5px}
  .total{font-size:30px;font-weight:800;margin:18px 0;letter-spacing:-.02em}
  button{width:100%;border:0;border-radius:12px;padding:13px;font:inherit;font-weight:700;cursor:pointer;margin-top:9px}
  .pay{background:#2F7A52;color:#fff}.fail{background:#fff;color:#B4453D;border:1.5px solid #E7C5C2}
  .tag{display:inline-block;background:#FDF3E1;color:#A9761A;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700;margin-bottom:12px}
  code{font-size:11.5px;color:#8A9A91;word-break:break-all}
</style></head><body>
<div class="card">
  <span class="tag">SIMULADOR · no se cobra dinero real</span>
  <h1>Pago del pedido ${payment.order.code}</h1>
  <p>Este checkout reemplaza al de la pasarela en desarrollo. Reproduce el mismo webhook firmado.</p>
  <div class="total">$ ${amount} ${payment.currency}</div>
  <button class="pay" data-status="APPROVED">Aprobar pago</button>
  <button class="fail" data-status="DECLINED">Rechazar pago</button>
  <p style="margin-top:14px"><code>ref ${payment.reference}</code></p>
</div>
<script>
  const reference = ${JSON.stringify(payment.reference)};
  const redirect = ${JSON.stringify(redirect)};
  document.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
    document.querySelectorAll('button').forEach((x) => (x.disabled = true));
    await fetch('/api/payments/mock/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference, status: b.dataset.status }),
    });
    window.location.href = redirect;
  }));
</script>
</body></html>`;
    res.type('html').send(page);
  }),
);

/**
 * Dispara el webhook del simulador. Es el equivalente a que la persona pague
 * en la pasarela: construye un evento firmado y lo procesa por el mismo
 * camino que uno real.
 */
paymentsRouter.post(
  '/mock/simulate',
  rateLimit({ max: 120, windowSeconds: 60, keyPrefix: 'mock-pay' }),
  validate({
    body: z.object({
      reference: z.string().min(4).max(120),
      status: z.enum(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'PENDING']).default('APPROVED'),
      method: z.string().max(40).optional(),
      /** Permite reenviar el mismo evento para probar la idempotencia. */
      timestamp: z.coerce.number().int().optional(),
      transactionId: z.string().max(80).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (env.PAYMENTS_PROVIDER !== 'mock') throw forbidden('El simulador de pagos no está habilitado.');
    const payment = await prisma.payment.findUnique({ where: { reference: req.body.reference } });
    if (!payment) throw badRequest('Referencia de pago desconocida.');

    const event = buildMockEvent({
      transactionId: req.body.transactionId ?? `mocktx-${payment.id.slice(0, 8)}-${req.body.status}`,
      reference: payment.reference,
      status: req.body.status,
      amountInCents: payment.amountInCents,
      method: req.body.method,
      timestamp: req.body.timestamp,
    });

    const parsed = gateway().parseEvent(Buffer.from(JSON.stringify(event)), {});
    const outcome = await processProviderEvent(parsed);
    await audit(req, {
      action: 'payment.mock_simulated',
      entity: 'Payment',
      entityId: payment.id,
      metadata: { status: req.body.status, outcome },
    });
    return ok(res, { outcome, event: { eventId: parsed.eventId, status: parsed.status } });
  }),
);

/** Historial de eventos de un pago: diagnóstico para la administración. */
paymentsRouter.get(
  '/:paymentId/events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: param(req, 'paymentId') },
      include: { order: { select: { userId: true } }, events: { orderBy: { receivedAt: 'desc' } } },
    });
    if (!payment) throw notFound('El pago no existe.');
    if (payment.order.userId !== req.auth!.user.id && req.auth!.user.role !== 'superadmin') {
      throw notFound('El pago no existe.');
    }
    return ok(
      res,
      payment.events.map((e) => ({
        id: e.id,
        eventId: e.eventId,
        eventType: e.eventType,
        reportedStatus: e.reportedStatus,
        signatureValid: e.signatureValid,
        result: e.result,
        receivedAt: e.receivedAt.toISOString(),
        processedAt: e.processedAt?.toISOString() ?? null,
      })),
    );
  }),
);
