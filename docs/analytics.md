# Analytics, logging y monitoreo

Qué se mide, cómo se mide y qué falta por decidir.

| Capa | Estado | Dónde |
|---|---|---|
| **Catálogo de eventos** | ✅ definido y **tipado en código** | `src/lib/analytics.ts` |
| **Proveedor de analytics** | ⬜ `TODO:` sin elegir — hay contrato y sumideros `noop`/`console` | |
| **Instrumentación de las pantallas** | 🟡 la capa existe; falta llamar a `track()` en cada flujo | |
| **Logging estructurado (API)** | ✅ Pino en JSON con `requestId` | `server/src/lib/logger.ts` |
| **Captura de errores (frontend)** | ✅ `ErrorBoundary` + `captureError()` | `src/components/ErrorBoundary.tsx` |
| **Captura de errores (proveedor)** | ⬜ `TODO:` Sentry u otro, sin elegir | |
| **Endpoint de salud** | ✅ `GET /api/health` con verificación de base de datos | `server/src/app.ts` |
| **Alertas y guardia** | ⬜ `TODO:` nadie recibe aviso si algo se cae | |

---

## 1 · Dos reglas de privacidad, antes que nada

Medir es un tratamiento de datos, así que aplica la Ley 1581 de 2012.

### Regla 1 · Nada se envía antes de la autorización

`track()` **descarta** los eventos mientras no haya consentimiento vigente, y
`ConsentContext` lo enciende y lo apaga automáticamente:

```ts
useEffect(() => { setAnalyticsConsent(hasConsent); }, [hasConsent]);
```

Los eventos descartados **no se encolan**: medir es una finalidad secundaria y
no justifica guardar datos de quien no ha autorizado. Al revocar la
autorización se olvida también el contexto (rol y establecimiento).

### Regla 2 · Ningún evento lleva datos personales

Ni correo, ni nombre, ni teléfono, ni documento, ni identificador de persona.
Solo **el rol** (categórico) y **magnitudes agregadas**. Hay una prueba que lo vigila (`tests/unit/analytics.test.ts` § privacidad del catálogo): si un
evento nuevo necesita un dato personal, **el evento está mal diseñado**.

La captura de **errores** es la única excepción y por una razón distinta: un
error es información técnica necesaria para mantener el servicio (interés
legítimo del responsable), no un dato del titular, así que `captureError()` no
depende del consentimiento. Tampoco envía datos personales.

---

## 2 · Catálogo de eventos

**El catálogo es el tipo `EventCatalog`** de `src/lib/analytics.ts`: `track()`
no compila con un nombre que no exista ni con propiedades que no correspondan.
Esta tabla y ese tipo no pueden desincronizarse sin que TypeScript lo note.

Convención: `snake_case`, en pasado o como hecho ocurrido, nunca como intención.

### Sesión

| Evento | Propiedades | Para qué sirve |
|---|---|---|
| `session_started` | `role`, `via` (`formulario` \| `acceso_rapido`) | Uso por rol; cuánto se usan los accesos rápidos en la demo |
| `session_ended` | `role` | Duración de sesión |
| `login_failed` | `reason` (`credenciales` \| `cuenta_inexistente` \| `bloqueada`) | Fricción de acceso y posible abuso |

### Autorización de datos

| Evento | Propiedades | Para qué sirve |
|---|---|---|
| `consent_prompted` | — | Cuántas personas ven el diálogo |
| `consent_granted` | `version`, `optionalAccepted` | **Tasa de autorización** y cuántos aceptan la finalidad opcional |
| `consent_declined` | — | Si el gate espanta gente antes de ver el producto (hipótesis F4 del user flow) |

### Inventario

| Evento | Propiedades | Para qué sirve |
|---|---|---|
| `product_created` | `category`, `riskLevel` | **Adopción real**: ¿cargan su inventario? Es el riesgo R2 del MoSCoW |
| `product_updated` · `product_deleted` | `category` | Mantenimiento del inventario |
| `inventory_filtered` | `riskLevel` | Si se usa la priorización por riesgo |
| `inventory_searched` | `hasResults` | Búsquedas sin resultado = catálogo incompleto o búsqueda mala |

### Inteligencia · los eventos que más importan

Miden si la propuesta de valor **se cumple**: el ciclo alerta → explicación →
acción.

| Evento | Propiedades | Para qué sirve |
|---|---|---|
| `alert_opened` | `riskLevel`, `riskScore` | ¿Se atienden las alertas de riesgo alto? |
| `explanation_opened` | `riskScore` | **¿Se usa la explicabilidad?** Hipótesis 1 de las pruebas con usuarios |
| `recommendation_applied` | `action` (`descuento`\|`publicar`\|`donar`), `suggestedDiscount`, `riskScore` | **La métrica estrella: ¿la recomendación se obedece?** |
| `recommendation_ignored` | `riskLevel` | Alertas que se abren y no llevan a nada |

### Marketplace y compra

| Evento | Propiedades | Para qué sirve |
|---|---|---|
| `listing_published` | `category`, `discountPercent`, `daysToExpiry` | **Tiempo entre alerta y publicación** (métrica de P5) |
| `listing_unpublished` | `category` | |
| `catalog_viewed` | `source` (`inicio`\|`explorar`\|`mapa`) | Por dónde se entra al catálogo |
| `catalog_filtered` · `catalog_searched` | `facet` · `hasResults` | Qué filtros sirven |
| `product_viewed` | `category`, `discountPercent` | Interés por categoría y sensibilidad al descuento |
| `cart_item_added` · `cart_item_removed` | `category`, `quantity` | Embudo |
| `cart_limited_by_stock` | `requested`, `available` | **Demanda insatisfecha**: cuánto se pediría si hubiera stock |
| `checkout_started` | `itemCount`, `totalCop` | Embudo |
| `order_completed` | `mode`, `paymentMethod`, `itemCount`, `totalCop`, `savingsCop`, `wasteAvoidedKg` | **Conversión, ticket promedio, medios de pago e impacto** |
| `order_failed` | `reason` | Dónde se cae la compra |

### Operación

| Evento | Propiedades | Para qué sirve |
|---|---|---|
| `impact_viewed` | `role` | Si la pantalla de impacto se mira o es decorativa |
| `demo_reset` | — | Uso en sustentaciones |
| `app_error` | `boundary`, `message` | Errores de renderizado (lo emite el `ErrorBoundary`) |

## 3 · Los indicadores que se construyen con esto

| Indicador | Fórmula | Hito que valida |
|---|---|---|
| **Tasa de obediencia de la IA** | `recommendation_applied` / `alert_opened` | El producto funciona (P2) |
| **Uso de la explicabilidad** | `explanation_opened` / `alert_opened` | La IA genera confianza (P3) |
| **Velocidad de rescate** | tiempo entre `alert_opened` y `listing_published` | El canal es rápido (P5) |
| **Conversión del marketplace** | `order_completed` / `catalog_viewed` | Hay demanda (P6) |
| **Valor recuperado** | suma de `savingsCop` y `totalCop` | Impacto económico (P7) |
| **Desperdicio evitado** | suma de `wasteAvoidedKg` | Impacto ambiental (P7) |
| **Demanda insatisfecha** | suma de `cart_limited_by_stock.requested − available` | Falta oferta (riesgo R3) |
| **Adopción del inventario** | `product_created` por establecimiento y semana | **Riesgo R2, el mayor de adopción** |
| **Tasa de autorización** | `consent_granted` / `consent_prompted` | El gate legal no espanta |

`TODO:` definir las metas numéricas. Un indicador sin meta es una curva bonita:
hay que decir qué valor sería bueno para poder saber si el MVP funcionó.

## 4 · Cómo instrumentar una pantalla

```ts
import { track } from '../lib/analytics';

// En el manejador de la acción, nunca en el render:
track('recommendation_applied', {
  action: 'descuento',
  suggestedDiscount: rec.suggestedDiscount,
  riskScore: rec.riskScore,
});
```

Tres reglas:

1. **Se registra el hecho, no la intención.** `order_completed` cuando la orden
   está confirmada, no al hacer clic en «Pagar».
2. **En el manejador del evento, no en un `useEffect` de render**, o se cuenta
   dos veces en cada re-render (y tres en modo estricto).
3. **Si hace falta un dato personal, el evento está mal.** Usa el rol, una
   categoría o una magnitud.

## 5 · Conectar un proveedor

No hay proveedor elegido. Lo que existe es el contrato:

```ts
export interface AnalyticsSink {
  readonly name: string;
  track<K extends EventName>(name: K, props: EventCatalog[K]): void;
  setContext?(context: { role?: Role; establishmentId?: string }): void;
  captureError?(error: unknown, context?: Record<string, unknown>): void;
}
```

Conectarlo es escribir un sumidero y llamar a `configureAnalytics()` una vez en
`src/main.tsx`.

| Candidato | A favor | En contra |
|---|---|---|
| **Vercel Analytics** | Ya se despliega ahí, sin cookies, cumple bien con privacidad | Métricas de página, no de producto: no sirve para los indicadores de arriba |
| **PostHog** (autoalojado o nube) | Eventos de producto, embudos, grabaciones; plan gratuito generoso | Hay que configurar retención y región para el cumplimiento |
| **Plausible / Umami** | Muy liviano, sin datos personales | Solo páginas, no eventos de producto |
| **Tabla propia en PostgreSQL** | Control total, ningún tercero, cero problema legal | Hay que construir los tableros |

Recomendación: **una tabla propia** mientras el MVP se valida. Los nueve
indicadores de arriba se calculan con SQL sobre los datos que la API ya guarda
(`Sale`, `Recommendation.appliedAt`, `MarketplaceListing.publishedAt`,
`AuditLog`), **sin enviar nada a un tercero** y sin un nuevo encargado del
tratamiento que declarar en la política de privacidad. Solo cuando haga falta
análisis exploratorio conviene un PostHog.

> Ojo: ese cálculo por SQL requiere que la SPA use la API (**M14**). Hoy los
> datos viven en el navegador de cada persona y no hay nada que consultar.

## 6 · Logging estructurado · API

Pino en JSON, ya implementado:

| Decisión | Detalle |
|---|---|
| Formato | JSON (`pino-pretty` solo en desarrollo, con `LOG_PRETTY=true`) |
| Correlación | `requestId` por petición, aceptado del cliente o generado, devuelto en `x-request-id` y presente en cada línea |
| Nivel por resultado | `error` ≥ 500 · `warn` ≥ 400 · `info` el resto |
| Ruido | `/api/health` excluido del log automático |
| Secretos | Los enlaces con token se imprimen **solo** fuera de producción |
| Nivel configurable | `LOG_LEVEL` (`fatal`…`silent`), `silent` en pruebas |

```bash
# Buscar una petición completa por su identificador
grep '"requestId":"abc-123"' logs.json | jq
```

`TODO:` **destino de los logs.** Hoy van a la salida estándar del proceso: si el
contenedor se reinicia, se pierden. Hace falta decidir el agregador (el del
proveedor de hosting, Grafana Loki, Better Stack…) y la retención.

## 7 · Captura de errores

### Frontend · implementado

`ErrorBoundary` envuelve la aplicación en dos niveles (`app` y `rutas`). Antes,
una excepción de renderizado dejaba **la pantalla en blanco** sin salida; ya
pasó con el hallazgo H-1. Ahora muestra dos salidas reales:

1. **Volver a intentar**, para un fallo transitorio, sin perder el estado.
2. **Reiniciar los datos**, para un estado persistido corrupto — la causa más
   probable en una aplicación que guarda todo en el navegador.

Cada error llama a `captureError()` y emite `app_error`.

**Límite conocido:** un `ErrorBoundary` solo atrapa errores de **renderizado**.
Los de manejadores de eventos y promesas no pasan por él.
`TODO:` añadir escuchas de `window.onerror` y `unhandledrejection`.

### Proveedor · pendiente

`TODO:` sin elegir. Si se usa **Sentry**, el sumidero es:

```ts
// src/lib/sentry.ts  ← TODO: implementar cuando se decida
configureAnalytics({
  name: 'sentry',
  track: (name, props) => Sentry.addBreadcrumb({ category: 'producto', message: name, data: props }),
  captureError: (error, context) => Sentry.captureException(error, { extra: context }),
});
```

Dos condiciones **antes** de activarlo:

- `sendDefaultPii: false` y filtrar el cuerpo de las peticiones: un reporte de
  error se lleva por delante datos personales con mucha facilidad.
- **Declararlo como encargado del tratamiento** en la política de privacidad
  (`src/data/legal.ts`). Añadir un tercero sin actualizar la política es un
  incumplimiento.

## 8 · Monitoreo del servicio

### `GET /api/health` · implementado

```jsonc
{ "data": { "status": "ok", "env": "production", "database": "ok", "payments": "wompi" } }
```

Devuelve **503** si la base no responde (`SELECT 1`). Está montado **antes** de
la sesión y del CSRF, así que el monitoreo no necesita credenciales, y queda
excluido del log automático.

```bash
curl -s https://api.…/api/health | jq
```

`TODO:` apuntar un monitor externo (UptimeRobot, Better Stack, el del
proveedor) a ese endpoint, cada minuto, con aviso a un canal real.

### Lo que hay que vigilar cuando la API esté desplegada

| Señal | Dónde se ve hoy | Umbral de alerta sugerido |
|---|---|---|
| Salud del servicio | `/api/health` | 2 fallos seguidos |
| Tasa de error 5xx | logs de Pino | > 1 % en 5 min |
| Latencia p95 | `TODO:` sin instrumentar | > 800 ms (el mismo umbral que k6) |
| **Webhooks con firma inválida** | `GET /api/admin/payment-events` | **cualquiera**: o es un ataque o es una llave mal configurada |
| **Pagos `PENDING` que no avanzan** | `Payment.status` + `expiresAt` | > 5 en 15 min: la pasarela o el webhook están rotos |
| Órdenes expiradas sin liberar | órdenes `PENDING_PAYMENT` vencidas | > 0 tras 2 min: el scheduler está caído |
| Intentos de login fallidos | tabla `LoginAttempt` | pico anómalo por IP |
| Espacio y conexiones de la base | panel del proveedor | 80 % |

`TODO:` nada de esto tiene alerta configurada, y **nadie recibe aviso si algo se
cae**. Mientras no haya usuarios reales es aceptable; antes de tenerlos, no.

## Pendientes

| # | Pendiente | Impacto |
|---|---|---|
| A1 | Instrumentar las pantallas con `track()` | La capa existe pero **no se emite ningún evento todavía** |
| A2 | `TODO:` elegir proveedor (o la tabla propia) | Sin destino, los eventos se descartan |
| A3 | `TODO:` metas numéricas de los 9 indicadores | Un indicador sin meta no decide nada |
| A4 | `TODO:` captura de errores con proveedor + actualizar la política de privacidad | Hoy los errores solo se ven en la consola de quien los sufre |
| A5 | `window.onerror` y `unhandledrejection` | El `ErrorBoundary` no cubre promesas ni manejadores |
| A6 | `TODO:` agregador de logs y retención | Los logs se pierden al reiniciar |
| A7 | `TODO:` monitor externo sobre `/api/health` y canal de alertas | Nadie se enteraría de una caída |
| A8 | Latencia p95 de la API sin instrumentar | No se puede cumplir el umbral que k6 ya declara |
