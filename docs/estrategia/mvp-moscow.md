# Alcance del MVP · MoSCoW

Priorización del alcance de Reverde. La lista de **Must have** está **cerrada**:
nada entra sin sacar algo, y cada punto es trazable a código existente.

- **Fecha de cierre del alcance:** 9 de noviembre de 2026
- **Equipo:** 4 personas — Juan Felipe, Andrés, Rita y quien lidera el proyecto (`TODO:` completar el nombre)
- **Criterio de «hecho»:** existe implementación **y** evidencia de prueba
- `TODO:` fecha límite de entrega del MVP

## Leyenda de estado

| Símbolo | Significado |
|---|---|
| ✅ | Implementado y con prueba que lo cubre |
| 🟡 | Implementado en una de las dos capas (ver nota) o sin prueba |
| ⬜ | No implementado |

> **Contexto obligatorio para leer esta tabla.** Reverde tiene hoy **dos
> implementaciones paralelas**: la SPA (`src/`, persistencia en `localStorage`)
> y la API (`server/`, PostgreSQL). **No están conectadas**: no hay ninguna
> llamada HTTP desde `src/` hacia la API. Por eso muchos Must aparecen
> implementados dos veces, y la integración figura como **M14**, el riesgo
> principal del MVP.

---

## Must have · imprescindible (14)

Sin cualquiera de estos, el MVP no demuestra la propuesta de valor.

| # | Must have | Front (`src/`) | API (`server/`) | Prueba | Estado |
|---|---|---|---|---|---|
| **M1** | Autenticación con roles (establecimiento, cliente, superadmin) | `store/AppContext.tsx` · `pages/Login.tsx` | `POST /api/auth/login` · `register` · `logout` · `session` | `tests/qa/auth.spec.ts` (15 casos) · `server/src/tests/auth.test.ts` | ✅ |
| **M2** | Contraseñas con hash y sesión segura | sesión simulada | Argon2id (`lib/password.ts`), sesión con token SHA-256 en cookie `httpOnly`, CSRF | `server/src/tests/password.test.ts` | ✅ |
| **M3** | Aislamiento de datos por establecimiento (multi-tenant) | por `establishmentId` en el store | `middleware/tenancy.ts` + `establishmentId` en toda entidad | `server/src/tests/tenancy.test.ts` | ✅ |
| **M4** | CRUD de inventario con fecha de vencimiento | `pages/admin/Inventory.tsx` · `ProductFormModal.tsx` | `GET/POST/PATCH/DELETE /api/products` · `/api/inventory/*` | `tests/qa/admin-flow.spec.ts` 3.3–3.13 · `server/src/tests/inventory.test.ts` | ✅ |
| **M5** | Risk Score 0–100 por producto con nivel bajo/medio/alto | `lib/ai.ts` | `domain/risk.ts` | `tests/unit/ai.test.ts` (39 casos) · `server/src/tests/risk.test.ts` | ✅ |
| **M6** | Alertas priorizadas por nivel de riesgo | `pages/admin/Alerts.tsx` | `GET /api/alerts` · `/counts` · `snooze` · `resolve` | `tests/qa/admin-flow.spec.ts` 3.6 | ✅ |
| **M7** | Explicabilidad: los 4 factores del score y la fórmula | `components/AiRecommendation.tsx` | `rationale` + `actions` en `Recommendation` | `tests/qa/admin-flow.spec.ts` 3.7 | ✅ |
| **M8** | Recomendación de descuento aplicable en un clic | `pages/admin/RecommendationDetail.tsx` | `POST /api/recommendations/:productId/apply` · `POST /api/products/:id/discount` | `tests/qa/admin-flow.spec.ts` 3.8 | ✅ |
| **M9** | Publicación en el marketplace desde la alerta | `MarketplaceAdmin.tsx` | `POST /api/marketplace/listings/:productId/publish` | `tests/qa/admin-flow.spec.ts` 3.9 | ✅ |
| **M10** | Catálogo público con filtros, detalle y mapa | `pages/client/Marketplace.tsx` · `ProductDetail.tsx` · `MapView.tsx` | `GET /api/marketplace` · `/products/:id` · `/facets` | `tests/qa/client-purchase.spec.ts` 4.1–4.6 | ✅ |
| **M11** | Carrito, pedido y checkout (compra y reserva) | `Cart.tsx` · `Checkout.tsx` · `Confirmation.tsx` | `/api/cart/*` · `POST /api/orders` · `/:id/checkout` | `tests/qa/client-purchase.spec.ts` 4.7–4.11 · `server/src/tests/orders.test.ts` | ✅ |
| **M12** | La venta descuenta stock y alimenta métricas e impacto | `lib/metrics.ts` · `pages/admin/Impact.tsx` | `Sale` + `InventoryMovement` en transacción · `/api/dashboard/*` | `tests/unit/metrics.test.ts` · `server/src/tests/concurrency.test.ts` | ✅ |
| **M13** | Autorización de tratamiento de datos (Ley 1581 de 2012) | `ConsentGate.tsx` · `data/legal.ts` · `/legal/*` | `consentVersion/AcceptedAt/Purpose` en `Order` + migración `20261103213844_order_consent` | `tests/qa/consent.spec.ts` (9 casos) · `tests/unit/consent.test.ts` | ✅ |
| **M14** | **La SPA consume la API real en vez de `localStorage`** | ⬜ no existe cliente HTTP | ✅ API completa y documentada | — | ⬜ |

### Cómo se cierra M14

Es el único Must sin implementación. Plan por capas, en este orden —cada paso es
desplegable y verificable por separado:

1. `src/lib/api.ts`: cliente HTTP con `credentials: 'include'`, lectura de
   `VITE_API_URL` (ya declarada en `.env.example`) y manejo del token CSRF.
2. Autenticación: reemplazar la sesión simulada de `AppContext` por
   `/api/auth/*`. Es el corte más limpio y valida cookies, CORS y CSRF de una vez.
3. Catálogo y marketplace (solo lectura): el menor riesgo.
4. Inventario, alertas y recomendaciones: sustituir `lib/ai.ts` por los valores
   que ya calcula `domain/risk.ts` y **borrar la implementación duplicada**.
5. Carrito, pedidos y pagos: el flujo con dinero va al final, con las pruebas de
   concurrencia e idempotencia del backend ya en verde.
6. Reescribir las pruebas de QA contra la API (hoy siembran `localStorage` en
   `tests/qa/fixtures.ts`).

`TODO:` decidir si esto entra en el MVP o se declara explícitamente como la
siguiente iteración. **Mientras no se cierre, la demo funciona pero el producto
no tiene persistencia real ni multiusuario.**

---

## Should have · importante, no bloqueante (8)

Mejora sustancial, pero el MVP se puede presentar sin ellos.

| # | Should have | Estado | Evidencia / qué falta |
|---|---|---|---|
| S1 | Pago real con pasarela (Wompi: tarjeta, PSE, Nequi, Bancolombia) | 🟡 | Adaptador completo con webhook firmado e idempotencia (`modules/payments/`); por defecto corre el proveedor `mock`. Faltan credenciales de sandbox |
| S2 | Verificación de correo y recuperación de contraseña | 🟡 | `POST /api/auth/verify-email` · `password/forgot` · `reset` + `lib/mailer.ts`. Falta SMTP configurado y pantallas en la SPA |
| S3 | Aprobación de establecimientos por el superadmin | ✅ API | `EstablishmentRequest` + `/api/admin/requests/:id/{approve,reject}`. Sin pantalla en la SPA |
| S4 | Notificaciones en la app | ✅ API | `/api/notifications` + cabecera `x-unread-count`. Sin UI |
| S5 | Expiración automática de reservas no pagadas | ✅ | `scheduler.ts` → `expireStaleOrders` cada 60 s |
| S6 | Bitácora de auditoría consultable | ✅ API | `AuditLog` + `GET /api/admin/audit`. Sin pantalla |
| S7 | Documentación interactiva de la API | ✅ | Swagger UI en `/api/docs` · `/api/openapi.json` |
| S8 | Pruebas E2E cross-browser (Firefox y WebKit) | 🟡 | Ver `playwright.config.ts`; el estado real queda registrado en [`docs/qa/interfaz.md`](../qa/interfaz.md) |

---

## Could have · deseable si sobra tiempo (7)

| # | Could have | Por qué no es ahora |
|---|---|---|
| C1 | Importación masiva de inventario (CSV / Excel) | Es la mayor fricción de adopción, pero requiere definir el formato con un establecimiento real |
| C2 | Modelo de ML entrenado en lugar de la heurística | Hace falta histórico real de merma; la heurística explicable es suficiente para validar |
| C3 | Notificaciones push / correo al cliente cuando se publica cerca | Requiere proveedor de envío y permisos; sin masa de usuarios no aporta |
| C4 | Geolocalización real con mapa de proveedor | El mapa simulado (`SimulatedMap.tsx`) alcanza para el MVP y no depende de servicios externos |
| C5 | Programa de gestión de donaciones a bancos de alimentos | `MovementType.donacion` ya registra el movimiento; coordinar al receptor es otro producto |
| C6 | Calificaciones y reseñas de establecimientos | `rating` existe en el modelo pero es un valor fijo |
| C7 | App móvil nativa | La SPA responsive cubre el caso (cliente en móvil, administrador en escritorio) |

---

## Won't have · fuera del MVP, decidido (8)

Declararlos evita que vuelvan a discusión.

| # | Won't have | Razón |
|---|---|---|
| W1 | Domicilios y logística de entrega | El modelo es recogida en el establecimiento (`pickupWindow`). Añadir logística cambia el negocio |
| W2 | Integración con POS / ERP del establecimiento | Cada negocio usa uno distinto; sin cliente concreto es especulación |
| W3 | Facturación electrónica DIAN | Sin modelo de negocio definido no hay qué facturar |
| W4 | Múltiples ciudades o países | El código asume COP, `es-CO` y `America/Bogota` |
| W5 | Multi-idioma | El público objetivo es Colombia |
| W6 | Chat entre comprador y establecimiento | Aumenta la superficie de moderación y de datos personales |
| W7 | Suscripciones o pagos recurrentes | Depende de W3 y del modelo de negocio |
| W8 | App para repartidores | Consecuencia de W1 |

---

## Riesgos del alcance

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | **M14 sin cerrar:** dos implementaciones divergen | Alto | Congelar `src/lib/ai.ts` y tratar `server/src/domain/risk.ts` como la única fuente de verdad |
| R2 | El inventario inicial hay que digitarlo a mano | Alto en adopción | C1 (importación CSV) sube a Should si aparece un piloto real |
| R3 | Catálogo vacío por falta de oferta (arranque en frío) | Alto | Datos semilla para la demo; para producción hace falta captar establecimientos antes que compradores |
| R4 | Sin modelo de negocio no hay criterio para priorizar | Medio | Decisión pendiente del equipo (ver `problema-solucion.md`) |
| R5 | El Risk Score no está calibrado con datos reales | Medio | Es explicable y auditable: se corrige ajustando pesos, no reentrenando |
