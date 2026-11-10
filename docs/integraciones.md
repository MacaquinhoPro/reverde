# Integración de servicios de terceros

Reverde habla con servicios externos **solo a través de una interfaz propia**.
Ningún módulo de dominio importa el SDK de un proveedor: importa el contrato.
Así cambiar de proveedor es escribir un adaptador, y las pruebas pueden correr
sin red ni cuentas externas.

| Integración | Contrato | Implementaciones | Estado |
|---|---|---|---|
| **Pagos** | `PaymentProviderAdapter` · `server/src/modules/payments/provider.ts` | `wompi` · `mock` | ✅ |
| **Correo** | `sendMail(mail)` · `server/src/lib/mailer.ts` | `smtp` · `log` | ✅ |
| **Reintentos** | `withRetry(fn, opts)` · `server/src/lib/retry.ts` | transversal | ✅ |
| **SMS** | ⬜ no existe | — | `TODO:` decidir si hace falta |
| **Captura de errores** | ⬜ no existe | — | `TODO:` ver [`analytics.md`](./analytics.md) |
| **Almacenamiento de imágenes** | ⬜ no existe | archivos locales en `public/img/` | `TODO:` solo si los establecimientos suben fotos |

---

## 1 · Pagos

### El contrato

```ts
interface PaymentProviderAdapter {
  readonly name: PaymentProvider;
  createCheckout(intent: CheckoutIntent): Promise<CheckoutSession>;
  parseEvent(rawBody: Buffer, headers: …): ProviderEvent;
  fetchTransaction?(transactionId: string): Promise<{ status; amountInCents; reference } | null>;
}
```

Tres métodos, y cada uno existe por una razón:

| Método | Para qué | Por qué está en el contrato |
|---|---|---|
| `createCheckout` | Crear la intención y devolver la URL del checkout **alojado** | **Reverde nunca toca datos de tarjeta.** La persona paga en el dominio del proveedor; esto reduce drásticamente el alcance de cumplimiento PCI |
| `parseEvent` | Validar la firma del webhook y normalizar el evento | Cada proveedor firma distinto; el dominio solo entiende `ProviderEvent` |
| `fetchTransaction` | Consultar el estado real en el proveedor | **El webhook dice qué pasó, pero antes de dar un pago por bueno se confirma contra el proveedor**: así un webhook falsificado tampoco sirve |

La selección es una línea (`modules/payments/index.ts`):

```ts
export const gateway = (): PaymentProviderAdapter =>
  env.PAYMENTS_PROVIDER === 'wompi' ? wompiAdapter : mockAdapter;
```

### Proveedor elegido: Wompi

**Decisión ya tomada en el código** (`PAYMENTS_PROVIDER`, enum `PaymentProvider`,
variables `WOMPI_*`). La razón es el mercado: cubre **tarjeta, PSE, Nequi y
Bancolombia**, que son los medios de pago reales en Colombia. Stripe no cubre PSE
ni Nequi, por lo que quedó descartado (ver [`arquitectura/stack.md`](./arquitectura/stack.md)).

`mercadopago` está declarado en el enum `PaymentProvider` pero **no tiene
adaptador**: es un hueco previsto, no una integración.

### El simulador `mock`

No es un *stub* de pruebas: **reproduce el contrato completo de Wompi** —misma
forma de evento, misma fórmula de checksum— y sirve la página de checkout desde
la propia API. Eso permite ejercitar de verdad el flujo entero sin cuenta
externa y sin red: redirección → pago → webhook firmado → confirmación →
descuento de inventario, además de los casos difíciles (**webhook duplicado**,
**firma inválida**, **pago rechazado**, **expiración**).

`assertProductionSafety()` impide que `mock` llegue a producción.

### Credenciales por ambiente

| Variable | Desarrollo | Producción |
|---|---|---|
| `PAYMENTS_PROVIDER` | `mock` | `wompi` (obligatorio) |
| `WOMPI_PUBLIC_KEY` | — | `pub_test_…` (sandbox) o `pub_prod_…` |
| `WOMPI_PRIVATE_KEY` | — | obligatoria |
| `WOMPI_INTEGRITY_SECRET` | — | obligatoria · firma de la referencia |
| `WOMPI_EVENTS_SECRET` | — | obligatoria · firma del webhook |
| `WOMPI_API_URL` | `https://sandbox.wompi.co/v1` | la de producción |
| `WOMPI_CHECKOUT_URL` | `https://checkout.wompi.co/p/` | igual |
| `PAYMENTS_LIVE_ENABLED` | `false` | `true` **solo con autorización explícita** |
| `PAYMENT_EXPIRY_MINUTES` | 30 | 30 |

### El doble interruptor para cobrar de verdad

Tener llaves de producción **no alcanza**. `assertProductionSafety()` exige que
`PAYMENTS_LIVE_ENABLED=true` acompañe a una llave `pub_prod_`, y falla también en
el caso inverso (interruptor activo con llaves de sandbox). Dos razones:
que nadie empiece a cobrar por copiar un `.env` equivocado, y que activar cobros
reales sea una decisión registrada, no un efecto secundario.

### Manejo de errores y reintentos

| Situación | Qué hace Reverde |
|---|---|
| La pasarela no responde al crear el checkout | Falla la petición con `502`/`503`. **No se reintenta**: crear un cobro no es idempotente; la protección es la clave de idempotencia, no el reintento |
| Timeout o 5xx al **consultar** una transacción | `withRetry`: 3 intentos, retroceso exponencial desde 400 ms con jitter. Es una lectura, se puede repetir sin riesgo |
| 4xx al consultar | **No se reintenta**: la petición está mal y repetirla no la arregla |
| No se puede verificar contra el proveedor | `fetchTransaction` devuelve `null` y **el pago no se confirma**. Ante la duda, no se cobra |
| Webhook con firma inválida | Se **persiste** con `signatureValid: false` y no se procesa: queda la evidencia del intento |
| Webhook duplicado | `PaymentEvent.eventId` es único: se responde `200` sin repetir nada |
| Webhook de un evento desconocido | Se guarda y se responde `200`. Un error haría que la pasarela reintente en bucle |
| El pago nunca llega | `Order.expiresAt` + `expireStaleOrders` cada 60 s liberan el stock |
| La persona cierra el navegador tras pagar | Da igual: **solo el webhook confirma**. La redirección no confirma nada |

### Cómo probar pagos en local

```bash
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev:api        # PAYMENTS_PROVIDER=mock por defecto

# Flujo completo contra el simulador
npm run test:api -- payments

# A mano: crea un pedido, haz checkout y abre la URL que devuelve.
# /api/dev/pay fuerza la confirmación sin pasar por la página.
```

Para probar contra el **sandbox real de Wompi**: pon `PAYMENTS_PROVIDER=wompi`
con las llaves `pub_test_` en `.env.development.local` y expón el webhook con un
túnel (`ngrok http 4000`), apuntando la URL de eventos de Wompi a
`https://…/api/payments/webhook/wompi`.
`TODO:` conseguir la cuenta de sandbox — **nadie del equipo la tiene todavía**.

---

## 2 · Correo

Una función, `sendMail()`, y dos transportes:

| Transporte | Cuándo | Comportamiento |
|---|---|---|
| `log` | desarrollo y pruebas | No envía nada. Imprime el correo en consola y lo guarda en `sentMails`, que es lo que leen las pruebas y `/api/dev` |
| `smtp` | producción (**obligatorio**) | nodemailer, con reintentos |

Los enlaces de verificación y de restablecimiento llevan el token **en claro**
porque su único destino legítimo es el correo del titular. En producción ese
token **nunca** se escribe en los logs.

**Reintentos:** 3 intentos con retroceso desde 500 ms. Un envío repetido puede
duplicar el correo, y es un mal menor: sin el enlace de verificación la persona
queda bloqueada fuera de su cuenta.

| Variable | Desarrollo | Producción |
|---|---|---|
| `MAIL_TRANSPORT` | `log` | `smtp` (lo exige `assertProductionSafety`) |
| `MAIL_FROM` | `Reverde <no-reply@reverde.app>` | `TODO:` dominio real |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASSWORD` | — | obligatorias |

`TODO:` **proveedor de correo sin decidir.** Hace falta uno con buena
entregabilidad y dominio verificado (SPF/DKIM/DMARC); si no, los correos de
verificación caen en spam y el registro se rompe en silencio. El código no
necesita cambios: cualquier proveedor con SMTP funciona.

---

## 3 · SMS · no implementado

**No existe ninguna integración de SMS**, y el modelo de datos no la necesita
hoy: el teléfono se guarda cifrado (`phoneEncrypted`) pero solo como dato de
contacto, no como canal.

`TODO:` decidir si hace falta. Si la respuesta es sí, el lugar correcto es un
contrato gemelo al del correo, y los dos casos de uso probables serían avisar de
una reserva lista para recoger y verificar el teléfono en el registro. Un SMS
cuesta dinero por mensaje, así que conviene no añadirlo antes de tener un caso
de uso medido.

Esqueleto propuesto, para no improvisarlo luego:

```ts
// server/src/lib/sms.ts  ← TODO: implementar si se decide
export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<{ id: string }>;
}
// Implementaciones: 'log' (desarrollo, imprime) y el proveedor real que se elija.
```

---

## 4 · Cómo añadir una integración nueva

El patrón que siguen pagos y correo, en orden:

1. **Define la interfaz primero**, en `server/src/lib/` o en el módulo del
   dominio. Lo que el dominio necesita, no lo que el SDK ofrece.
2. **Escribe primero la implementación falsa** (`log`, `mock`). Si el contrato no
   se puede simular, está mal planteado.
3. **Declara las variables** en `server/src/config/env.ts` (con Zod) y en
   `.env.example`. Sin esto, un despliegue mal configurado arranca igual.
4. **Añade la barrera de producción** en `assertProductionSafety()`: qué no puede
   quedar en modo simulado ni con credenciales de prueba.
5. **Decide la política de reintento** y úsala con `withRetry`: ¿la operación es
   idempotente? Si no lo es, no se reintenta.
6. **Registra el resultado** en una tabla de eventos si el proveedor puede
   reenviar notificaciones (como `PaymentEvent`), con una restricción única
   sobre el id del evento.
7. **Prueba el camino infeliz**: timeout, 5xx, firma inválida, evento duplicado.
8. **Documenta aquí** el contrato, las credenciales por ambiente y el manejo de
   errores.

## Pendientes

| # | Pendiente | Impacto |
|---|---|---|
| I1 | `TODO:` cuenta de sandbox de Wompi | Sin ella el adaptador real nunca se ha ejercitado contra el proveedor |
| I2 | `TODO:` proveedor de correo y dominio verificado | Sin SPF/DKIM los correos de verificación caen en spam |
| I3 | `TODO:` decidir si SMS entra en el alcance | Hoy no está y nada lo necesita |
| I4 | `TODO:` captura de errores (p. ej. Sentry) | Ver [`analytics.md`](./analytics.md) |
| I5 | El adaptador de `mercadopago` está declarado en el enum pero no existe | Hueco previsto; quitarlo del enum o implementarlo |
| I6 | Sin circuit breaker | Con el proveedor caído, cada petición espera el timeout. Aceptable al volumen actual |
