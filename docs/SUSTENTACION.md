# Guía de sustentación · Reverde

Documento personal de trabajo. Qué tiene la app, dónde está cada cosa y cómo
demostrar cada hito, paso a paso.

- **Proyecto:** Reverde — *Menos desperdicio, más valor*
- **Qué es:** plataforma B2B2C que reduce el desperdicio de alimentos con
  inventario inteligente, alertas con IA explicable y un marketplace de rescate
- **Estado verificado:** [`docs/STATUS.md`](./STATUS.md) — 15 hitos hechos, 8 parciales, 0 pendientes
- **Última verificación:** 9 de noviembre de 2026

---

# PARTE 0 · Lo que tienes que saber de memoria

## El pitch de 30 segundos

> «Los supermercados y restaurantes **descubren la merma cuando ya es merma**.
> No es falta de datos —el inventario y las fechas ya existen— es falta de
> priorización y de un canal de salida rápido.
>
> Reverde calcula un **Risk Score de 0 a 100** por producto, **explica por qué**,
> sugiere el descuento según lo que funcionó antes, y publica en un marketplace
> con un clic. La venta vuelve al inventario, a las métricas de impacto y al
> aprendizaje del motor. **El ciclo se cierra.**»

## Las tres cifras que debes recordar

| Cifra | Qué es |
|---|---|
| **0–100** | El Risk Score. `0–39` bajo · `40–69` medio · `70–100` alto |
| **4 factores** | Vencimiento (0–58) + stock (0–30) + rotación (0–10) + demanda (0–8) − alivio por descuento (hasta 16) |
| **4 roles** | `supermercado`, `restaurante`, `cliente`, `superadmin` |

## Las dos cuentas que vas a usar

Contraseña única: **`Demo1234`**

| Para | Cuenta |
|---|---|
| Administrador de supermercado | `supermercado1@reverde.com` |
| Cliente comprador | `cliente1@reverde.com` |
| Superadministrador | `admin1@reverde.com` |
| Restaurante | `restaurante1@reverde.com` |

En `/login` hay **accesos rápidos** (un botón por rol): úsalos, no escribas las
credenciales a mano delante de nadie.

## ⚠️ La cosa que SÍ te van a preguntar

**El repositorio tiene dos aplicaciones y todavía no están conectadas.**

| | Qué es | Persistencia |
|---|---|---|
| **SPA** (`src/`) | La app que vas a demostrar: 23 pantallas | `localStorage` |
| **API** (`server/`) | Backend completo: 86 endpoints, PostgreSQL | PostgreSQL 16 |

**No lo esconder: anticípalo.** Dilo tú antes de que lo pregunten, con esta frase:

> «Hay dos capas. La que voy a mostrar es la SPA, que persiste en el navegador y
> funciona sin internet: es la que demuestra el producto. Aparte construimos la
> API completa con PostgreSQL —86 endpoints, Argon2id, multi-tenant,
> idempotencia de pagos— con sus pruebas de integración. **Conectarlas es el
> Must-have M14 y está documentado como el riesgo número uno del MVP**, con el
> plan de cierre por capas escrito. Lo tengo identificado, no es una sorpresa.»

Eso convierte la debilidad en evidencia de criterio. Está escrito en
[`docs/estrategia/mvp-moscow.md`](./estrategia/mvp-moscow.md#cómo-se-cierra-m14).

---

# PARTE 1 · Qué tiene la app

## 1.1 · Las tres propuestas y dónde se ven

| Propuesta | Ruta en la app | Archivo |
|---|---|---|
| **1. Inventario inteligente** | `/app/inventario` | `src/pages/admin/Inventory.tsx` |
| **2. Alertas y priorización con IA** | `/app/alertas` y `/app/alertas/:id` | `src/pages/admin/Alerts.tsx` · `RecommendationDetail.tsx` |
| **3. Marketplace de rescate** | `/tienda/explorar` | `src/pages/client/Marketplace.tsx` |

Las tres están **conectadas**: el inventario alimenta la IA, la IA recomienda
publicar, el marketplace vende, y la venta vuelve al inventario y a las métricas.

## 1.2 · Las 23 pantallas

### Públicas
| # | Pantalla | Ruta | Archivo |
|---|---|---|---|
| 1 | Landing | `/` | `src/pages/Landing.tsx` |
| 2 | Login y accesos rápidos | `/login` | `src/pages/Login.tsx` |
| 3 | Centro legal | `/legal/:slug` | `src/pages/legal/Legal.tsx` |
| — | Diálogo de autorización de datos | modal global | `src/components/legal/ConsentGate.tsx` |

### Establecimiento (`/app/*`)
| # | Pantalla | Ruta | Archivo |
|---|---|---|---|
| 4 | Dashboard con KPIs | `/app/inicio` | `src/pages/admin/Dashboard.tsx` |
| 5 | Inventario (tabla en web, tarjetas en móvil) | `/app/inventario` | `src/pages/admin/Inventory.tsx` |
| 6 | Alta/edición de producto con riesgo en vivo | modal | `src/components/ProductFormModal.tsx` |
| 7 | Alertas IA priorizadas | `/app/alertas` | `src/pages/admin/Alerts.tsx` |
| 8 | **Detalle de recomendación + explicabilidad** | `/app/alertas/:productId` | `src/pages/admin/RecommendationDetail.tsx` |
| 9 | Marketplace propio | `/app/marketplace` | `src/pages/admin/MarketplaceAdmin.tsx` |
| 10 | Historial de ventas | `/app/ventas` | `src/pages/admin/Sales.tsx` |
| 11 | Impacto (CO₂, agua, COP) | `/app/impacto` | `src/pages/admin/Impact.tsx` |

### Cliente (`/tienda/*`)
| # | Pantalla | Ruta | Archivo |
|---|---|---|---|
| 12 | Inicio de la tienda | `/tienda` | `src/pages/client/Home.tsx` |
| 13 | Explorar con filtros | `/tienda/explorar` | `src/pages/client/Marketplace.tsx` |
| 14 | Detalle de producto | `/tienda/producto/:id` | `src/pages/client/ProductDetail.tsx` |
| 15 | Mapa simulado | `/tienda/mapa` | `src/pages/client/MapView.tsx` |
| 16 | Carrito con ahorro e impacto | `/tienda/carrito` | `src/pages/client/Cart.tsx` |
| 17 | Checkout (tarjeta/PSE/local) | `/tienda/checkout` | `src/pages/client/Checkout.tsx` |
| 18 | Confirmación con código `RV-XXXXX` | `/tienda/confirmacion/:id` | `src/pages/client/Confirmation.tsx` |
| 19 | Perfil + reporte + derechos de datos | `/tienda/perfil` | `src/pages/client/Profile.tsx` |

### Superadmin (`/admin/*`)
| # | Pantalla | Ruta | Archivo |
|---|---|---|---|
| 20 | Resumen global | `/admin/inicio` | `src/pages/super/SuperDashboard.tsx` |
| 21 | Establecimientos | `/admin/establecimientos` | `src/pages/super/Establishments.tsx` |
| 22 | Detalle de establecimiento | `/admin/establecimientos/:id` | `src/pages/super/EstablishmentDetail.tsx` |
| 23 | Publicaciones de la red | `/admin/publicaciones` | `src/pages/super/Publications.tsx` |

## 1.3 · Cómo funciona la "IA" (te lo van a preguntar)

**No hay modelo entrenado. Hay un sistema heurístico explicable**, y eso es una
decisión defendible, no una carencia:

```
Risk Score (0–100) =
    riesgo por vencimiento        (0–58, crece exponencialmente al acercarse
                                   la fecha, ponderado por perecibilidad)
  + riesgo por stock              (0–30, días para agotar stock vs. días restantes)
  + riesgo por baja rotación      (0–10, ventas diarias históricas)
  + patrón de demanda reciente    (0–8,  variación frente a la semana anterior)
  − alivio por descuento aplicado (hasta 16)
```

**Cómo defenderlo si preguntan «¿por qué no un modelo real?»:**

> «Un modelo entrenado necesita histórico real de merma, y no lo tenemos: sería
> entrenar con datos inventados. La heurística hace tres cosas que un modelo
> no haría mejor hoy: **es auditable** —cada recomendación muestra su fórmula y
> el peso de cada factor—, **se corrige ajustando pesos** en vez de
> reentrenando, y **ya aprende de la experiencia**: cada venta con descuento
> guarda un `PromoOutcome` y las recomendaciones cambian. El supuesto S4 de
> `problema-solucion.md` dice exactamente cómo validarla: comparar el score con
> la merma real durante un mes.»

**Aprendizaje simulado:** cada promoción vendida guarda categoría, descuento,
% de inventario vendido y días hasta agotarse. `learnFromHistory()` busca el
descuento con mejor relación sell-through/margen y lo mezcla con la
recomendación base. Produce mensajes como:

> *«Basándonos en 3 promociones anteriores en lácteos, un descuento del 30 %
> logró vender el 82 % del inventario en 2 días antes del vencimiento.»*

- Motor del frontend: `src/lib/ai.ts`
- Motor de la API: `server/src/domain/risk.ts`

## 1.4 · Cifras del proyecto

| Qué | Cuánto |
|---|---|
| Pantallas | 23 |
| Endpoints de la API | **86** (85 documentados, 2 excluidos a propósito) |
| Modelos de base de datos | **27** modelos + **22** enums |
| Migraciones | 3 |
| Líneas de la API | ~9.800 |
| Pruebas unitarias del frontend | **244** (98,66 % de líneas) |
| Pruebas de la API sin base de datos | **31** (94 % de líneas) |
| Archivos de pruebas de integración de la API | 10 |
| Casos de QA end-to-end | **474** en 6 navegadores/dispositivos |
| Presupuestos de carga | 12 |
| Documentos en `docs/` | 25 |

## 1.5 · Stack (por si lo preguntan de frente)

**Frontend:** React 19 · TypeScript estricto · Tailwind 3 · React Router 7 ·
Recharts · Vite 8
**API:** Node 24 · Express 5 · Prisma 6 · PostgreSQL 16 · Zod · Argon2id ·
Helmet · Pino
**Pruebas:** Vitest · Testing Library · supertest · Playwright · autocannon · k6

Justificación de cada elección **y de las 8 alternativas que descartamos**:
[`docs/arquitectura/stack.md`](./arquitectura/stack.md).

---

# PARTE 2 · Preparación (hazlo 15 minutos antes)

## 2.1 · Checklist

```bash
cd ~/Documents/reverde
git status                 # debe estar limpio
npm install                # por si acaso
npm test                   # 244 pruebas en ~3 s · si algo falla, NO improvises
npm run dev                # http://localhost:5173
```

- [ ] `npm test` en verde (**244 pasan**)
- [ ] `npm run dev` levantado y la portada carga
- [ ] **Abre una ventana privada** o borra los datos del sitio: así se ve el
      diálogo de autorización de datos desde cero (es un hito que hay que mostrar)
- [ ] Zoom del navegador al **100 %**
- [ ] Una segunda pestaña con el repo en GitHub o el editor abierto en `docs/`
- [ ] Teléfono a mano por si piden ver el móvil
- [ ] **Silencia notificaciones** del sistema

## 2.2 · Si vas a demostrar la API (opcional, decide antes)

**Docker está apagado en tu máquina.** Si quieres mostrar la API funcionando de
verdad, enciéndelo **antes** y ejecuta:

```bash
open -a Docker              # y espera a que arranque (~1 min)
npm run db:up               # PostgreSQL en el puerto 5433
npm run db:migrate
npm run db:seed
npm run dev:api             # http://localhost:4000
open http://localhost:4000/api/docs
```

**Plan B si Docker no arranca** (verificado: funciona):

```bash
npm run dev:api                          # arranca sin base de datos
open http://localhost:4000/api/docs      # ✅ Swagger UI responde: los 86 endpoints navegables
curl -s localhost:4000/api/health        # → 503 "La base de datos no responde."
```

Ese **503 no es un fallo que esconder: es la demostración de que el monitoreo
funciona.** Dilo así:

> «Mira: el endpoint de salud detecta que la base no responde y devuelve 503 con
> el motivo. Eso es exactamente lo que un monitor externo necesita para alertar.
> La documentación de la API sí se sirve, porque es el contrato y no depende de
> la base.»

## 2.3 · Lo que NO debes hacer en vivo

| No hagas | Por qué |
|---|---|
| `npm run test:qa:all` | Son 474 casos y **Firefox no arranca en tu máquina** (fallo del navegador de Playwright en este macOS, no de la app). Quedarías explicando un error que no es tuyo |
| `npm run test:api` | Necesita Docker. Si no lo encendiste, falla |
| Editar código delante del jurado | Nunca. Si algo falla, pasa a la siguiente sección |
| Prometer que la SPA usa la API | No la usa. Ya tienes la frase honesta en la Parte 0 |

---

# PARTE 3 · El guion de la demo en vivo

**Duración objetivo: 12–15 minutos.** Si tienes 5, haz solo los bloques ①②③.

## ① El problema (1 min) · ruta `/`

Portada. No te quedes aquí.

> «Reverde ataca un problema concreto: el establecimiento descubre la merma
> cuando ya no se puede vender. Voy a mostrar el ciclo completo: detectar,
> decidir, vender, y cómo la venta vuelve al sistema.»

## ② La capa legal (1 min) · aparece sola

Al entrar a `/login` aparece el **diálogo de autorización de tratamiento de
datos**. No lo saltes con prisa: es un hito completo.

**Qué hacer:**
1. Señala que la portada y `/legal/*` **se leen sin autorizar nada** → el titular
   puede informarse antes de decidir.
2. Despliega «Leer el texto completo».
3. Intenta «Autorizo» **sin marcar las casillas** → no se cierra.
4. Marca las dos obligatorias → se desbloquea.

**Qué decir:**

> «Esto es Ley 1581 de 2012: autorización previa, expresa e informada. Se guarda
> la versión del texto, la fecha y una bitácora. La finalidad de comunicaciones
> comerciales es **opcional y separada**, para que no condicione el servicio.»

- Textos: `src/data/legal.ts` (570 líneas) · Diálogo: `src/components/legal/ConsentGate.tsx`

## ③ El flujo del administrador (4–5 min) · **el corazón de la demo**

Entra con el acceso rápido **«Entrar como supermercado»**.

| Paso | Dónde | Qué mostrar | Qué decir |
|---|---|---|---|
| 3.1 | `/app/inicio` | KPIs e impacto del establecimiento | «Lo primero que ve: cuánto hay en riesgo y cuánto ha recuperado» |
| 3.2 | `/app/inventario` | La tabla con el **Risk Score por producto** | «Cada producto tiene un score y un nivel. El **yogur natural** está en alto riesgo» |
| 3.3 | `/app/inventario` | Filtra por **«Alto»** | «Esto es lo que resuelve el problema: no es un informe, es *qué atender hoy*» |
| 3.4 | `/app/alertas` | Alertas priorizadas por nivel | «Las alertas están ordenadas por riesgo, no por fecha» |
| 3.5 | Abre la alerta del yogur | **«¿Por qué recomendamos esto?»** | **Aquí te detienes.** Ver abajo ⬇ |
| 3.6 | Misma pantalla | El mensaje de aprendizaje del histórico | «Y esto viene de las promociones anteriores en esa categoría» |
| 3.7 | Misma pantalla | **Aplicar el descuento** | «Un clic. El precio ya cambió en el inventario» |
| 3.8 | Misma pantalla | **Publicar en marketplace** | «Y un clic más: ya está a la venta» |

### El momento clave (3.5) — no lo pases rápido

Despliega el panel de explicabilidad y **señala los cuatro factores con su peso**
y la fórmula.

> «Este es el punto que diferencia el proyecto. Una recomendación automática sin
> explicación **no se obedece**: quien administra el punto no le va a hacer caso
> a una caja negra. Aquí se ve el peso de cada factor y la fórmula completa. La
> IA es **auditable**.»

Si tienes que elegir **una sola pantalla** para mostrar en toda la sustentación,
es esta: `/app/alertas/:productId`.

## ④ El flujo del cliente (3 min)

Acceso rápido **«Entrar como cliente»**.

| Paso | Dónde | Qué mostrar |
|---|---|---|
| 4.1 | `/tienda/explorar` | **El producto que acabas de publicar ya está aquí** |
| 4.2 | Filtra por categoría o «vence pronto» | Precio, ahorro, vencimiento y distancia en cada tarjeta |
| 4.3 | `/tienda/producto/:id` | Ficha con impacto ambiental y fecha explícita |
| 4.4 | Agregar al carrito → `/tienda/carrito` | Ahorro total e impacto en kg |
| 4.5 | `/tienda/checkout` | Tarjeta / PSE / **pago en el local** |
| 4.6 | Marca la casilla de autorización | «El pedido guarda su propia autorización, con versión y finalidad» |
| 4.7 | Confirmar | **Código `RV-XXXXX`**, ahorro e impacto |

> «Fíjense en que la fecha de vencimiento está siempre visible. No vendemos
> "sorpresa": la persona sabe exactamente qué compra y hasta cuándo.»

## ⑤ El ciclo que se cierra (2 min) · **el remate**

Vuelve al administrador (acceso rápido «supermercado»).

| Paso | Dónde | Qué señalar |
|---|---|---|
| 5.1 | `/app/ventas` | **La venta que acabas de hacer está aquí** |
| 5.2 | `/app/impacto` | Subió el desperdicio evitado y el dinero recuperado |
| 5.3 | `/app/inventario` | **El stock del producto bajó** |
| 5.4 | `/app/alertas` → la misma alerta | **La recomendación cambió**: aprendió de la venta |

> «Esto es lo que quería mostrar: no son tres funciones sueltas. El inventario
> alimenta la IA, la IA recomienda, el marketplace vende, y **la venta vuelve al
> inventario, a las métricas y al aprendizaje**. El ciclo está cerrado.»

## ⑥ Supervisión y móvil (1 min, si hay tiempo)

- Acceso rápido **«superadmin»** → `/admin/inicio`: impacto de **toda la red**,
  establecimientos, publicaciones.
- Encoge la ventana del navegador o abre en el teléfono: **el inventario pasa de
  tabla a tarjetas** y los filtros a un panel desplegable, sin perder funciones.

## ⑦ Cierre (30 s)

> «Los datos son simulados y el pago es simulado, pero la arquitectura no: hay
> una API completa con PostgreSQL, 244 pruebas unitarias, 474 de interfaz en seis
> navegadores, y **un documento de estado que dice exactamente qué está hecho,
> qué está parcial y qué falta.** Eso último es lo que me interesa defender.»

Abre [`docs/STATUS.md`](./STATUS.md).

---

# PARTE 4 · Cómo sustentar cada hito

Tabla de consulta rápida. **Si te preguntan por un hito, abre el archivo de la
columna «Dónde está».**

## Fase 1 · Estrategia

| # | Hito | Dónde está | Qué decir en una frase |
|---|---|---|---|
| 1 | Definición del problema | [`docs/estrategia/problema-solucion.md`](./estrategia/problema-solucion.md) | «8 pares problema–solución, cada uno con el archivo que lo implementa y cómo se mide» |
| 2 | Buyer persona | [`docs/estrategia/buyer-persona.md`](./estrategia/buyer-persona.md) | «3 personas con perfil técnico y demográfico, más una anti-persona. **Lo demográfico son hipótesis, no entrevistas**, y está marcado como tal» |
| 3 | UVP | [`docs/estrategia/uvp.md`](./estrategia/uvp.md) | «16 capacidades contra 5 categorías de competencia, **y las desventajas propias**» |
| 4 | Alcance MoSCoW | [`docs/estrategia/mvp-moscow.md`](./estrategia/mvp-moscow.md) | «14 Must, 8 Should, 7 Could, 8 Won't. Cada Must apunta a su archivo en el front, en la API y a su prueba» |

## Fase 2 · Diseño

| # | Hito | Dónde está | Qué decir |
|---|---|---|---|
| 5 | User flow | [`docs/diseno/user-flow.md`](./diseno/user-flow.md) | «6 diagramas Mermaid derivados de `src/App.tsx`: navegación, guardas de acceso, flujo del admin, máquina de estados del pago» |
| 6 | Wireframes | [`docs/diseno/wireframes.md`](./diseno/wireframes.md) | «Inventario de las 23 pantallas + protocolo de pruebas con usuarios. **No hay Figma y no se han hecho las pruebas**: la plantilla está lista» |
| 7 | UI Kit | [`design.tokens.mjs`](../design.tokens.mjs) + [`docs/diseno/ui-kit.md`](./diseno/ui-kit.md) | «Los tokens están **en código**, en un solo archivo del que salen Tailwind y las variables CSS. 30 componentes documentados» |

**Demostración fuerte del hito 7:** abre `design.tokens.mjs` y di:

> «El color verde principal existe **una sola vez** en todo el proyecto. De aquí
> sale `tailwind.config.js` y de aquí salen las variables CSS. Si lo cambio aquí,
> cambia en las 23 pantallas.»

## Fase 3 · Arquitectura

| # | Hito | Dónde está | Qué decir |
|---|---|---|---|
| 8 | Stack | [`docs/arquitectura/stack.md`](./arquitectura/stack.md) | «Cada tecnología con su por qué **y 8 alternativas descartadas con el motivo**» |
| 9 | Modelo de datos | [`docs/arquitectura/modelo-datos.md`](./arquitectura/modelo-datos.md) | «6 diagramas `erDiagram` que cubren los 27 modelos y 22 enums. Motor: PostgreSQL 16» |
| 10 | API y webhooks | [`docs/arquitectura/api.md`](./arquitectura/api.md) + [`openapi.yaml`](./arquitectura/openapi.yaml) | «86 endpoints. La especificación **se genera desde el código** y hay un verificador que falla si se desvía» |
| 11 | Seguridad | [`docs/arquitectura/seguridad.md`](./arquitectura/seguridad.md) | Ver abajo ⬇ |

### El hito 10 tiene una demostración que impresiona

```bash
npm run docs:openapi:check
```

> «La documentación de una API se desactualiza siempre. Este comando compara las
> rutas registradas en el código con la especificación y **falla si falta
> alguna**. Corre en la integración continua, así que un endpoint nuevo sin
> documentar rompe el build. Hoy: cero deriva.»

Cuando escribimos esto encontró **3 endpoints sin documentar**, que ya están cerrados.

### El hito 11, resumido para decirlo de memoria

> «Contraseñas con **Argon2id**. Datos personales recuperables —teléfono,
> documento— cifrados con **AES-256-GCM** y formato versionado. Sesiones opacas
> en cookie `HttpOnly`: en la base solo vive el **SHA-256** del token, así que se
> pueden **revocar**. Roles y permisos en **tablas de la base**, no en el código.
> **Multi-tenant**: pedir datos de otro establecimiento da 403, no 404, porque un
> 404 confirmaría que existe. CSRF por doble envío, CORS en lista blanca, Helmet
> con HSTS, **Zod en toda entrada**, rate limit en tres niveles, idempotencia
> triple contra el doble cobro, y bitácora de auditoría.»

Y el remate honesto:

> «Y una barrera que me gusta: `assertProductionSafety()`. Si alguien despliega
> a producción con las cuentas de demo activas, sin HTTPS o con la pasarela en
> modo simulado, **el proceso no arranca**. Prefiero que se caiga al inicio que
> operar mal configurado.»

Archivo: `server/src/config/env.ts`

## Fase 4 · Desarrollo

| # | Hito | Dónde está | Qué decir |
|---|---|---|---|
| 12 | Entorno de dev | [`README.md`](../README.md) · [`docker-compose.yml`](../docker-compose.yml) · [plantilla de PR](../.github/PULL_REQUEST_TEMPLATE.md) | «Ramas `main` y `develop`, plantilla de PR con checklist, 3 archivos `.env.*.example`, Docker Compose con base de desarrollo y base de pruebas en memoria» |
| 13 | Implementación core | [`docs/estrategia/mvp-moscow.md`](./estrategia/mvp-moscow.md) | «13 de 14 Must implementados y probados. **El que falta es M14** y es el riesgo documentado» |
| 14 | Integración de terceros | [`docs/integraciones.md`](./integraciones.md) | Ver abajo ⬇ |

### El hito 14, con la frase que lo defiende

> «Los pagos están detrás de una interfaz, `PaymentProviderAdapter`. Hay dos
> implementaciones: **Wompi** —elegido porque cubre tarjeta, PSE, Nequi y
> Bancolombia, que es lo que se usa en Colombia; Stripe no cubre PSE— y un
> **simulador que reproduce el contrato completo**: misma forma de evento, misma
> firma. Eso permite probar de verdad el webhook duplicado y la firma inválida,
> sin cuenta externa.
>
> Y una decisión que me importa: **el `createCheckout` no se reintenta**. Crear
> un cobro no es idempotente; ahí la protección es la clave de idempotencia, no
> el reintento. Solo se reintenta la **consulta** de estado, que es de lectura.»

Archivos: `server/src/modules/payments/provider.ts` · `server/src/lib/retry.ts`

## Fase 5 · Calidad

| # | Hito | Dónde está | Comando para demostrarlo |
|---|---|---|---|
| 15 | Pruebas unitarias | `tests/unit/` · `server/src/tests/` | `npm test` → **244 en 3 s** · `npm run test:coverage` → **98,66 %** |
| 16 | QA de interfaz | [`playwright.config.ts`](../playwright.config.ts) · [`docs/qa/interfaz.md`](./qa/interfaz.md) | `npm run test:qa` (**no** el `:all`) |
| 17 | Pruebas de carga | [`docs/qa/carga.md`](./qa/carga.md) · `tests/load/` | `npm run test:load` → **12/12 en 2 s** |

### Lo que debes decir del hito 15

> «244 pruebas unitarias en 3 segundos, con **98,66 % de líneas** en la capa
> lógica, y el umbral está configurado para **bloquear** por debajo de 80 %.
> Además hay 31 pruebas de la API que corren **sin base de datos**, así que la
> red de seguridad no depende de tener Docker encendido.»

### Lo que debes decir del hito 16

> «474 casos en seis combinaciones: los **tres motores de navegador** —Chromium,
> Gecko y WebKit— más tres perfiles móviles, incluido uno de 360 píxeles de
> ancho. El criterio es el motor, no la marca: Safari es WebKit y es el que rompe
> primero. Verifiqué 387 en cinco de los seis; **Firefox no arranca en mi
> máquina** por un problema del navegador de Playwright en este macOS, y está
> anotado como pendiente para la integración continua.»

**Si te preguntan por bugs encontrados**, tienes una historia excelente:

> «Encontramos un defecto alto: un `null` guardado en el almacenamiento del
> navegador dejaba la app **en blanco**, sin forma de recuperarse. Lo
> interesante es que el arreglo que el propio plan de QA sugería **habría roto
> otra prueba**: un `null` guardado a propósito es la forma de cerrar sesión. La
> regla final distingue listas de no-listas, y hay 7 pruebas de regresión. Está
> documentado como hallazgo H-1 en `docs/QA-PLAN.md`.»

## Fase 6 · Lanzamiento

| # | Hito | Dónde está | Qué decir |
|---|---|---|---|
| 18 | Pipeline CI/CD | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | «4 trabajos: calidad, API contra PostgreSQL real, QA en 3 motores, y seguridad. **Marcado como parcial: nunca ha corrido**, y eso no lo puedo dar por bueno» |
| 19 | Dominio y HTTPS | [`docs/runbooks/despliegue.md`](./runbooks/despliegue.md) · [`vercel.json`](../vercel.json) | Ver abajo ⬇ |
| 20 | Analytics y monitoreo | [`docs/analytics.md`](./analytics.md) · `src/lib/analytics.ts` | «Catálogo de 30 eventos **tipado en el código** y 9 indicadores con su fórmula. **Todavía no se emite ninguno**: falta instrumentar las pantallas» |
| 21 | Backup y recovery | [`docs/runbooks/backup-recovery.md`](./runbooks/backup-recovery.md) · `scripts/db-backup.sh` | «RPO 24 h, RTO 1 h. **Parcial porque la restauración nunca se probó de punta a punta**, y un respaldo sin restaurar no es un respaldo» |

### El hito 19 tiene la mejor demostración en vivo de todas

```bash
npm run build
npm run preview:headers
# en otra terminal:
curl -sI http://localhost:4173/ | head -5
```

> «La SPA se servía **sin ninguna cabecera de seguridad**. Ahora tiene CSP, HSTS
> con preload, X-Frame-Options y cinco más. Pero una CSP mal puesta **no rompe el
> build: rompe el navegador de quien entra, en producción**. Así que este script
> sirve el build real con las cabeceras reales, y le pasé la suite de QA encima:
> **75 pruebas en verde sin una sola violación en consola.**»

Comando que lo prueba: `QA_BASE_URL=http://localhost:4173 npm run test:qa`

### El hito 20, con una decisión que vale la pena contar

> «La medición está **atada al consentimiento**: `track()` descarta los eventos
> mientras no haya autorización vigente, y **no los encola** —medir es una
> finalidad secundaria y no justifica guardar datos de quien no ha autorizado—.
> Y ningún evento del catálogo acepta datos personales: **hay una prueba que lo
> vigila**. Si alguien añade un evento con un correo, la prueba falla.»

## Fase 7 · Legal

| # | Hito | Dónde está | Qué decir |
|---|---|---|---|
| 22 | Protección de datos | [`docs/legal/`](./legal/) | Ver abajo ⬇ |
| 23 | Feedback loop | `src/components/FeedbackCard.tsx` · [plantillas](../.github/ISSUE_TEMPLATE/) | «Canal de reporte en *Perfil* que abre un issue prellenado con el contexto técnico **y sin ningún dato personal**, con una prueba que lo vigila» |

### El hito 22 tiene el detalle más fino del proyecto

> «Los documentos legales **se generan** desde `src/data/legal.ts`, que es el
> texto que realmente se le muestra a la persona. No se escriben a mano, y hay un
> verificador en la integración continua. La razón: si el texto del repositorio y
> el de la app pueden divergir, **van a divergir**, y un documento que no coincide
> con lo que se le mostró al titular **no sirve como prueba del
> consentimiento**.»

Demostración:
```bash
npm run docs:legal:check
```

Y el resto del hito:

> «El registro de la API **exige** la autorización: sin `accepted: true` y la
> versión del texto, no se crea la cuenta. La fecha la pone el servidor, porque
> la que mande el cliente no prueba nada. Y están los tres derechos:
> **consultar** con `GET /api/users/me/export`, que devuelve todo descifrado y
> queda en la auditoría; **actualizar** con `PATCH /api/auth/me`; y **suprimir**
> con `DELETE /api/users/me`, que es una baja lógica **con anonimización**, para
> que el histórico de ventas del establecimiento siga cuadrando.»

Y lo que falta, dicho por ti primero:

> «Lo que falta es claro y está escrito: los datos del responsable del
> tratamiento son **marcadores**, así que los canales del artículo 17 **no son
> efectivos**. Es el incumplimiento más claro que tiene el proyecto, es barato de
> arreglar, y los tres documentos están marcados como **borradores pendientes de
> abogado**.»

---

# PARTE 5 · Comandos para ejecutar en vivo

Ordenados por efecto. Todos verificados y rápidos.

| # | Comando | Dura | Qué demuestra |
|---|---|---|---|
| 1 | `npm test` | **3 s** | 244 pruebas en verde |
| 2 | `npm run test:coverage` | ~10 s | 98,66 % de líneas, con umbral que bloquea |
| 3 | `npm run docs:openapi:check` | 2 s | La documentación de la API no se puede desviar del código |
| 4 | `npm run docs:legal:check` | 2 s | Los documentos legales coinciden con lo que ve la persona |
| 5 | `npm run test:load` | **2 s** | 12 presupuestos de rendimiento con 10.000 productos |
| 6 | `npm run test:api:unit` | **0,3 s** | 31 pruebas de la API sin necesitar base de datos |
| 7 | `npm run test:qa` | ~55 s | 158 pruebas en navegador real (úsalo solo si hay tiempo) |
| 8 | `npm run build` | 0,7 s | Build de producción |

**Si solo puedes ejecutar uno: el 1.** 244 pruebas en 3 segundos es contundente
y no falla.

**Si quieres el que mejor cuenta la historia: el 3.** Es el que explica cómo se
evita que la documentación mienta.

---

# PARTE 6 · Preguntas difíciles y respuestas honestas

| Pregunta | Respuesta |
|---|---|
| **«¿Esto funciona de verdad o es una maqueta?»** | «La SPA funciona de punta a punta con persistencia en el navegador, y la API funciona con PostgreSQL y tiene pruebas de integración. Lo que no está hecho es **conectarlas**, y es el Must-have M14 documentado como riesgo principal.» |
| **«¿Por qué no están conectadas?»** | «Decisión de alcance consciente. Conectar las 23 pantallas, el store global y reescribir las 474 pruebas de QA es un proyecto en sí. Preferí dejar las dos capas sólidas y el plan de migración escrito por capas, antes que una integración a medias.» |
| **«¿Dónde está la IA?»** | «Es un sistema heurístico explicable, y es deliberado: no hay histórico real de merma para entrenar nada. La ventaja es que es auditable, se corrige ajustando pesos, y ya aprende de las promociones pasadas. En `problema-solucion.md` está el supuesto S4 con cómo validarla.» |
| **«¿Es seguro?»** | «El backend sí: Argon2id, AES-256-GCM, sesiones revocables, RBAC en base de datos, CSRF, rate limiting, auditoría. **Pero mientras la SPA use `localStorage`, esas defensas no protegen la demo**: la autoridad está en el navegador. Está escrito como pendiente S12.» |
| **«¿Está desplegado?»** | «La SPA está enlazada a Vercel y se despliega con cada push. **La API nunca se ha desplegado** porque falta decidir el proveedor; el Dockerfile está listo y la lista de verificación de despliegue también.» |
| **«¿Y si se cae la base de datos?»** | «Hay runbook con RPO de 24 horas y RTO de 1 hora, scripts de respaldo que **verifican el volcado después de crearlo** y de restauración con confirmación escrita. Pero lo marqué **parcial**: la restauración nunca se probó de punta a punta, y un respaldo sin restaurar no es un respaldo.» |
| **«¿Cumple la ley de datos?»** | «En lo técnico sí: autorización previa con versión y fecha, consentimiento obligatorio en el registro, y los tres derechos implementados. **En lo formal no**: los datos del responsable son marcadores, así que los canales del artículo 17 no son efectivos, y los documentos son borradores sin revisión de abogado.» |
| **«¿Cuánto cuesta / cómo gana dinero?»** | «**No hay modelo de negocio definido.** No hay ni una línea de monetización en el código, y está anotado como decisión pendiente en `problema-solucion.md`. Preferí no inventarlo.» |
| **«¿Hicieron pruebas con usuarios?»** | «No. El protocolo, las tareas y la plantilla de registro están listos en `wireframes.md`, y la tabla está vacía a propósito. Decir que las hicimos sería falso.» |
| **«¿Qué harían diferente?»** | «Conectar la SPA a la API desde el primer día. Tener el motor de riesgo implementado dos veces es la deuda más cara del proyecto, y pasó por construir el frontend primero.» |
| **«¿Trabajaron en equipo?»** | «Ramas `main` y `develop`, Conventional Commits, plantilla de PR con checklist de secretos y migraciones, y plantillas de issues para bugs y sugerencias.» |

## La regla de oro

**Si no sabes algo, dilo y di dónde está escrito.** Tienes 25 documentos y un
`STATUS.md` que no esconde nada: eso es más defendible que improvisar. Un
«está marcado como parcial y aquí está por qué» vale más que un «sí, eso está
hecho» que no se sostiene.

---

# PARTE 7 · Mapa rápido · «si preguntan por X, abre Y»

| Si preguntan por… | Abre |
|---|---|
| El estado de todo | [`docs/STATUS.md`](./STATUS.md) |
| El problema y la solución | [`docs/estrategia/problema-solucion.md`](./estrategia/problema-solucion.md) |
| A quién va dirigido | [`docs/estrategia/buyer-persona.md`](./estrategia/buyer-persona.md) |
| La competencia | [`docs/estrategia/uvp.md`](./estrategia/uvp.md) |
| Qué entra y qué no en el MVP | [`docs/estrategia/mvp-moscow.md`](./estrategia/mvp-moscow.md) |
| La navegación | [`docs/diseno/user-flow.md`](./diseno/user-flow.md) |
| Las pantallas y el prototipo | [`docs/diseno/wireframes.md`](./diseno/wireframes.md) |
| Colores, tipografía, componentes | [`docs/diseno/ui-kit.md`](./diseno/ui-kit.md) · [`design.tokens.mjs`](../design.tokens.mjs) |
| Por qué este stack | [`docs/arquitectura/stack.md`](./arquitectura/stack.md) |
| La base de datos | [`docs/arquitectura/modelo-datos.md`](./arquitectura/modelo-datos.md) · `server/prisma/schema.prisma` |
| Los endpoints | [`docs/arquitectura/api.md`](./arquitectura/api.md) · `/api/docs` en el navegador |
| Seguridad | [`docs/arquitectura/seguridad.md`](./arquitectura/seguridad.md) |
| Pagos, correo, SMS | [`docs/integraciones.md`](./integraciones.md) |
| Las pruebas | [`docs/TESTING.md`](./TESTING.md) |
| QA y bugs encontrados | [`docs/QA-PLAN.md`](./QA-PLAN.md) · [`docs/qa/interfaz.md`](./qa/interfaz.md) |
| Rendimiento y carga | [`docs/qa/carga.md`](./qa/carga.md) |
| Despliegue, dominio, HTTPS | [`docs/runbooks/despliegue.md`](./runbooks/despliegue.md) |
| Respaldos | [`docs/runbooks/backup-recovery.md`](./runbooks/backup-recovery.md) |
| Métricas y monitoreo | [`docs/analytics.md`](./analytics.md) |
| Lo legal | [`docs/legal/README.md`](./legal/README.md) |
| El motor de riesgo | `src/lib/ai.ts` · `server/src/domain/risk.ts` |
| Cómo arrancar el proyecto | [`README.md`](../README.md) |

---

# PARTE 8 · Si algo se rompe en vivo

| Síntoma | Qué hacer |
|---|---|
| La app se ve en blanco | Ya hay red de seguridad: aparece la pantalla del `ErrorBoundary` con «Reiniciar los datos». Úsala y sigue. **Y aprovéchalo**: «esto es precisamente el límite de error del que hablaba» |
| Los datos de la demo se ven raros | *Perfil → Reiniciar datos de la demo* |
| El inventario aparece vencido | Pasó la medianoche: reinicia la demo. El reanclaje de fechas está en `src/lib/demoState.ts` |
| Una prueba falla delante del jurado | No la depures en vivo. «Lo reviso después» y sigue con la siguiente sección |
| El puerto 5173 está ocupado | `npx vite --port 5175` |
| Docker no arranca | Usa el plan B de la Parte 2.2: Swagger UI funciona sin base de datos |
| Se te olvida una cifra | Está todo en la Parte 1.4 y en `STATUS.md` |

---

## Último recordatorio

Lo más valioso que tienes no es la app: es que **sabes exactamente qué está
hecho, qué está a medias y por qué**. Los 8 hitos parciales están parciales a
propósito y con la razón escrita. Esa honestidad, en una sustentación, pesa más
que una demo perfecta.

Mucha suerte. 🌿
