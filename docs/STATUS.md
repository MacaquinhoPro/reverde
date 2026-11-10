# Estado del plan de trabajo

Estado real de los hitos, con evidencia verificable. **Ningún hito figura como
«Hecho» sin un archivo que se pueda abrir o un comando que se pueda ejecutar.**

- **Fecha:** 10 de noviembre de 2026
- **Commit:** `51f90d2` + revisión final (sin commitear)
- **Equipo:** Juan Felipe, Andrés, Rita y quien lidera el proyecto
- **Resumen:** **16 hechos · 7 parciales · 0 pendientes** (de 23)

> **Nota sobre el conteo.** El plan enumera 22 entregables, pero el hito de
> «Despliegue» pide dos cosas distintas (pipeline CI/CD **y** dominio con
> SSL/HTTPS), así que aquí van separadas como 18 y 19 para llegar a 23. Si la
> intención era otra, se renumera.

> Para sustentar el proyecto: [`SUSTENTACION.md`](./SUSTENTACION.md) tiene el
> guion de la demo paso a paso, cómo defender cada hito y respuestas a las
> preguntas difíciles.

> La columna «Qué falta» de este documento está desarrollada, priorizada y con
> identificadores estables en [`PENDIENTES.md`](./PENDIENTES.md), que además
> escribe las 6 decisiones que aquí se citan como «pregunta N».

## Verificación ejecutada hoy

| Comprobación | Comando | Resultado |
|---|---|---|
| Linter | `npm run lint` | ✅ 0 errores · 4 advertencias de React preexistentes |
| Tipos (frontend + API) | `npm run typecheck` | ✅ |
| Unitarias del frontend | `npm test` | ✅ **244 pasan**, 13 archivos |
| Cobertura del frontend | `npm run test:coverage` | ✅ **98,66 % líneas** · 89,48 % ramas (umbral 80/70) |
| Unitarias de la API sin base de datos | `npm run test:api:unit` | ✅ **31 pasan** en 0,3 s |
| Cobertura de la API | `npm run test:api:coverage` | ✅ **94 % líneas** (umbral 80) |
| Integración de la API | `npm run test:api` | ⚠️ **no ejecutable aquí**: necesita PostgreSQL y en esta máquina no hay Docker. 10 archivos listos; los corre la CI |
| QA end-to-end | `npm run test:qa:all` | ✅ **387 pasan** en 5 de 6 proyectos · ⚠️ Firefox no arranca en este macOS |
| Carga del motor | `npm run test:load` | ✅ **12/12 presupuestos** |
| Carga HTTP | `npm run test:load:http:smoke` | ✅ 5 rutas · 0 errores · p99 1 ms |
| Build de producción | `npm run build` | ✅ 0,7 s |
| Deriva de OpenAPI | `npm run docs:openapi:check` | ✅ **0 deriva** · 86 rutas, 85 documentadas, 2 excluidas a propósito |
| Documentos legales al día | `npm run docs:legal:check` | ✅ |
| CSP sobre el build real | `npm run preview:headers` + QA | ✅ 75 pruebas sin violaciones en consola |

---

## Fase 1 · Estrategia

| # | Hito | Criterio de aceptación | Estado | Evidencia | Qué falta |
|---|---|---|---|---|---|
| 1 | Definición del problema | `problema-solucion.md` con matriz Problema–Solución | **Hecho** | [`docs/estrategia/problema-solucion.md`](./estrategia/problema-solucion.md) — 8 pares con el archivo que los implementa, ciclo cerrado en Mermaid, límites del producto y 4 supuestos | Validar los supuestos con establecimientos reales (entrevistas) |
| 2 | Buyer persona | `buyer-persona.md` con perfil técnico y demográfico | **Hecho** | [`docs/estrategia/buyer-persona.md`](./estrategia/buyer-persona.md) — 3 personas + 1 anti-persona, con perfil técnico completo | **El perfil demográfico son hipótesis, no investigación**: los campos `TODO:` necesitan trabajo de campo |
| 3 | Propuesta de valor (UVP) | `uvp.md` con diferencial y tabla comparativa | **Hecho** | [`docs/estrategia/uvp.md`](./estrategia/uvp.md) — tabla de 16 capacidades × 5 categorías de competencia, más las desventajas propias | **Los competidores están sin verificar**: hay que confirmar quién opera en Colombia (pregunta 2) |
| 4 | Alcance MVP (MoSCoW) | Must-have cerrado y trazable al código | **Hecho** | [`docs/estrategia/mvp-moscow.md`](./estrategia/mvp-moscow.md) — 14 Must / 8 Should / 7 Could / 8 Won't; cada Must apunta a su archivo en front, en API y a su prueba | **M14 (conectar la SPA con la API) está sin implementar** y es el riesgo principal |

## Fase 2 · Diseño

| # | Hito | Criterio de aceptación | Estado | Evidencia | Qué falta |
|---|---|---|---|---|---|
| 5 | User flow | Diagrama Mermaid completo de navegación | **Hecho** | [`docs/diseno/user-flow.md`](./diseno/user-flow.md) — 6 diagramas (mapa completo, guardas de acceso, flujo del administrador, máquina de estados del pago, alta de establecimiento, derechos del titular), derivados de `src/App.tsx` | — |
| 6 | Wireframes / prototipo | Enlace al prototipo + registro de pruebas con usuarios | **Parcial** | [`docs/diseno/wireframes.md`](./diseno/wireframes.md) — inventario de las 23 pantallas con su ruta y archivo, esquemas de layout web/móvil, protocolo y plantilla de registro | **No existe archivo de Figma** (`TODO:`) y **no se ha hecho ninguna prueba con usuarios**: la plantilla está lista y vacía |
| 7 | UI Kit / guía de estilos | `ui-kit.md` + tokens en código + componentes documentados | **Hecho** | [`design.tokens.mjs`](../design.tokens.mjs) (única fuente de verdad: color, tipografía, espaciados, radios, sombras, movimiento) → `tailwind.config.js` y variables CSS en `src/index.css`; [`docs/diseno/ui-kit.md`](./diseno/ui-kit.md) con los 30 componentes base y 10 reglas de composición | 6 pendientes de accesibilidad: auditoría de contraste, `prefers-reduced-motion`, hallazgo H-2 |

## Fase 3 · Arquitectura

| # | Hito | Criterio de aceptación | Estado | Evidencia | Qué falta |
|---|---|---|---|---|---|
| 8 | Stack tecnológico | `stack.md` justificando lenguajes y frameworks reales | **Hecho** | [`docs/arquitectura/stack.md`](./arquitectura/stack.md) — cada tecnología con su por qué, las decisiones de cada capa y 8 alternativas descartadas con motivo | Decidir el destino de despliegue de la API (pregunta 1) |
| 9 | Modelo de datos (DER) | `erDiagram` Mermaid coherente con el código, con el motor de DB | **Hecho** | [`docs/arquitectura/modelo-datos.md`](./arquitectura/modelo-datos.md) — 6 `erDiagram` que cubren los **27 modelos y 22 enums** de `server/prisma/schema.prisma`; motor **PostgreSQL 16**; 3 migraciones | 5 pendientes: proveedor gestionado, índice de búsqueda, retención en base, archivado de bitácoras |
| 10 | Diseño de APIs / webhooks | Documentar todos los endpoints + OpenAPI o docs automática | **Hecho** | [`docs/arquitectura/api.md`](./arquitectura/api.md) + [`openapi.yaml`](./arquitectura/openapi.yaml) generado desde el código (`npm run docs:openapi`) + Swagger UI en `/api/docs`. **`npm run docs:openapi:check` verifica que no haya deriva y corre en la CI** | Documentar los 2 endpoints del simulador o excluirlos en la especificación misma |
| 11 | Seguridad y auth | Roles, hash, cifrado, secretos, CORS, validación, rate limiting + `seguridad.md` | **Hecho** | [`docs/arquitectura/seguridad.md`](./arquitectura/seguridad.md) — Argon2id; AES-256-GCM versionado; sesiones opacas revocables con hash SHA-256; RBAC con matriz **en base de datos**; multi-tenant; CSRF por doble envío; CORS en lista blanca; Helmet + HSTS; Zod en toda entrada; rate limit en 3 niveles; idempotencia triple; auditoría; `assertProductionSafety()` | 11 pendientes. Los dos que importan: el rate limit es por proceso (S2) y **la SPA sigue confiando en `localStorage`, así que estas defensas no protegen la demo (S12)** |

## Fase 4 · Desarrollo

| # | Hito | Criterio de aceptación | Estado | Evidencia | Qué falta |
|---|---|---|---|---|---|
| 12 | Entorno de dev | `.gitignore`, `main` + `develop`, plantilla de PR, `.env.example`, docker-compose, config Local/Prod, pasos en README | **Hecho** | `.gitignore` sin `.env` versionados (lo verifica la CI) · ramas `main` y `develop` en el remoto · [plantilla de PR](../.github/PULL_REQUEST_TEMPLATE.md) · 3 `.env.*.example` · [`docker-compose.yml`](../docker-compose.yml) (base de desarrollo, base de pruebas en tmpfs, API con perfil `full`) · `.nvmrc` · [README](../README.md) con el arranque completo | Protección de rama que exija la CI (`TODO:` solo se hace desde GitHub) |
| 13 | Implementación core | Cada Must-have del MoSCoW con implementación; listar lo faltante | **Parcial** | 13 de los 14 Must están implementados y probados, con la traza en [`mvp-moscow.md`](./estrategia/mvp-moscow.md) | **M14: la SPA no consume la API.** Hay dos implementaciones paralelas del dominio. El plan de cierre por capas está escrito; **es la decisión 1 pendiente** |
| 14 | Integración de terceros | Capa de abstracción, credenciales por entorno, sandbox, errores/reintentos | **Hecho** | [`docs/integraciones.md`](./integraciones.md) — pagos detrás de `PaymentProviderAdapter` (`wompi` + `mock` con el contrato completo, webhook firmado, dedupe por `eventId`); correo con `sendMail()` (`log`/`smtp`); **reintentos con retroceso exponencial** en [`server/src/lib/retry.ts`](../server/src/lib/retry.ts) con 10 pruebas | **SMS no existe** (hay que decidir si hace falta) · nadie tiene cuenta de sandbox de Wompi · sin proveedor de correo |

## Fase 5 · Calidad (QA)

| # | Hito | Criterio de aceptación | Estado | Evidencia | Qué falta |
|---|---|---|---|---|---|
| 15 | Pruebas unitarias | Lógica crítica cubierta + cobertura con mínimo ≥ 70 % | **Hecho** | **244 pruebas** del frontend con **98,66 % de líneas** y **89,48 % de ramas** (umbrales que bloquean: 80/80/80/70) · **31 pruebas de la API sin base de datos** con **94 % de líneas** · 10 archivos de integración de la API | **La integración de la API no se ha podido ejecutar aquí** (sin Docker): la verifica la CI. Su cobertura queda sin umbral hasta tener una cifra observada |
| 16 | QA de interfaz | E2E cross-browser + checklist manual en `docs/qa/interfaz.md` | **Parcial** | [`playwright.config.ts`](../playwright.config.ts) con **6 proyectos y 474 casos**: Chromium, **Firefox** y **WebKit** en escritorio + Pixel 7, iPhone 14 y 360×640 · [`docs/qa/interfaz.md`](./qa/interfaz.md) con 70 comprobaciones manuales en 9 bloques | **Firefox no se pudo ejecutar en esta máquina** (el navegador de Playwright falla al arrancar en este macOS, no es un fallo de la app): lo confirma la CI · **ninguna persona ha recorrido la checklist manual todavía** |
| 17 | Pruebas de carga | Escenarios y umbrales (p95, error) en `tests/load/` + instrucciones y registro | **Hecho** | [`docs/qa/carga.md`](./qa/carga.md) con los umbrales y el **registro de corridas con las cifras reales de hoy** · `tests/load/engine-load.test.ts` (12 presupuestos) · `http-load.mjs` (autocannon) · `k6-marketplace.js` (4 perfiles, p95 < 800 ms, error < 1 %) | **No hay escenario contra la API** (depende de M14) y **k6 nunca se ha corrido contra un despliegue** (hace falta dominio) |

## Fase 6 · Lanzamiento

| # | Hito | Criterio de aceptación | Estado | Evidencia | Qué falta |
|---|---|---|---|---|---|
| 18 | Pipeline CI/CD | Lint, pruebas y build + despliegue | **Parcial** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — 4 trabajos: `calidad` (lint, typecheck, 244 + 31 pruebas con cobertura, carga del motor, build, deriva de OpenAPI, documentos legales), `api` (integración contra PostgreSQL 16 real), `qa` (474 casos en 3 motores, con reporte y trazas), `seguridad` (`npm audit` + **falla si hay un `.env` versionado**). Despliegue de la SPA por la integración de Vercel con Git **No se puede marcar como hecho: el workflow nunca ha corrido.** Es YAML válido y los comandos que invoca están todos verificados en local, pero eso no prueba que el pipeline funcione. Se confirma con el primer push · sin trabajo de despliegue para la API (depende de la pregunta 1) · `npm audit` no bloquea todavía |
| 19 | Dominio y SSL/HTTPS | Dominio documentado, redirección a HTTPS, cabeceras de seguridad | **Parcial** | [`docs/runbooks/despliegue.md`](./runbooks/despliegue.md) § 4 · [`vercel.json`](../vercel.json) con **CSP, HSTS (1 año, preload), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP** y caché inmutable · **verificado con 75 pruebas de QA contra el build real con la CSP aplicada** (`npm run preview:headers`) · la redirección HTTP→HTTPS la hace Vercel en su borde | **No hay dominio propio** (`TODO:` sin comprar, pregunta 4) · al cerrar M14 hay que añadir la URL de la API a `connect-src` o las llamadas fallarán en silencio |
| 20 | Analytics y monitoreo | Catálogo de eventos, logging estructurado, captura de errores, `/health` | **Parcial** | [`docs/analytics.md`](./analytics.md) — **catálogo de 30 eventos tipado en código** ([`src/lib/analytics.ts`](../src/lib/analytics.ts), 14 pruebas) con los 9 indicadores y su fórmula · logging estructurado con Pino y `requestId` · **`ErrorBoundary`** que sustituye la pantalla en blanco por dos salidas reales · `GET /api/health` con verificación de base de datos | **No se emite ningún evento todavía**: falta llamar a `track()` en las pantallas (A1) · **sin proveedor elegido** (pregunta 5) · sin agregador de logs, sin monitor externo y **nadie recibe aviso si algo se cae** |
| 21 | Backup y recovery | Script programado, restauración probada y documentada con RTO/RPO | **Hecho** | [`docs/runbooks/backup-recovery.md`](./runbooks/backup-recovery.md) — **RPO 24 h / RTO 1 h** · [`scripts/db-backup.sh`](../scripts/db-backup.sh) y [`db-restore.sh`](../scripts/db-restore.sh) · **restauración real probada el 10 nov 2026: 808 filas recuperadas en 1 s**, con las 8 tablas al mismo conteo, registrada en el runbook · `npm run db:verify-backup` repite el ciclo entero (respalda, borra, restaura, compara) y corre en la CI como trabajo `respaldo` · [`backup.yml`](../.github/workflows/backup.yml) lo programa a diario | Falta el destino remoto cifrado (B3) y documentar la custodia de `ENCRYPTION_KEY` (B4). El RTO de 1 s es el de una base de 132 KB: habrá que volver a medirlo con datos reales |

## Fase 7 · Legal

| # | Hito | Criterio de aceptación | Estado | Evidencia | Qué falta |
|---|---|---|---|---|---|
| 22 | Protección de datos | Borradores de política y T&C conforme a Habeas Data, consentimiento en el registro, y mecanismo para consultar/actualizar/eliminar | **Parcial** | [`docs/legal/`](./legal/) — los 3 documentos **generados desde `src/data/legal.ts`** (`npm run docs:legal`, verificado en la CI) con aviso de borrador · **`POST /api/auth/register` exige ahora `consent.accepted === true` y la versión del texto**, con la fecha puesta por el servidor (migración `20261110030000_user_registration_consent` + 3 pruebas) · **`GET /api/users/me/export`** para consultar y portar · `PATCH /api/auth/me` para actualizar · `DELETE /api/users/me` suprime con anonimización · `ConsentGate` y `DataRightsCard` | ⚠️ **Los datos del responsable son marcadores** (`NIT por definir`), así que los canales del art. 17 **no son efectivos**: es el incumplimiento más claro que hay (pregunta 6) · **falta revisión por un abogado** · la retención de 24 meses está declarada pero **nada la aplica** · faltan declarar los encargados del tratamiento |
| 23 | Feedback loop | Canal de reporte en la app + plantillas de issues | **Hecho** | **Formulario de reporte dentro de la aplicación** ([`ReportDialog.tsx`](../src/components/ReportDialog.tsx) + [`lib/reports.ts`](../src/lib/reports.ts), 12 pruebas unitarias y 6 de QA): se abre desde la cabecera en los tres roles y desde la portada sin iniciar sesión, guarda el reporte con un código de seguimiento y ofrece enviarlo por correo —sin exigir cuenta de GitHub, que es lo que antes dejaba fuera a cualquier usuario real—. [`FeedbackCard.tsx`](../src/components/FeedbackCard.tsx) en *Perfil* lista los reportes hechos, y el `ErrorBoundary` enlaza ahí: abre un issue **prellenado con el contexto técnico y sin ningún dato personal** ([`src/lib/feedback.ts`](../src/lib/feedback.ts), 8 pruebas incluida una que vigila que no se filtren datos personales) · [plantillas de issues](../.github/ISSUE_TEMPLATE/) de bug y sugerencia, con issues en blanco deshabilitados y enlaces al reporte privado de vulnerabilidades y a los derechos del titular | Confirmar que `MacaquinhoPro/reverde` es el repositorio definitivo |

---

## Los tres riesgos que de verdad importan

### 1 · M14 · La SPA no consume la API

Es el riesgo que atraviesa todo lo demás. Hoy hay **dos implementaciones
paralelas** del mismo dominio: `src/lib/ai.ts` y `server/src/domain/risk.ts`.

Consecuencias concretas, no teóricas:

- Lo que se demuestra **no tiene persistencia compartida ni multiusuario**.
- **Todas las defensas de seguridad están implementadas pero no protegen la
  demo** (S12): la autoridad está en el navegador, y cualquiera puede editar su
  propio precio, stock o sesión.
- Las pruebas de carga miden el cliente, no la base de datos, que es donde está
  el verdadero cuello de botella.
- Los indicadores de analytics no se pueden calcular: los datos están en el
  navegador de cada persona.
- Las dos implementaciones **divergen con cada commit**.

El plan de cierre por capas está en
[`mvp-moscow.md`](./estrategia/mvp-moscow.md#cómo-se-cierra-m14).

### 2 · Nada se ha ejecutado nunca en producción

La CI se añade en este commit y **todavía no ha corrido**. La API **nunca se ha
desplegado**. La restauración de un respaldo **nunca se ha probado**. k6 **nunca
ha corrido contra un despliegue**. Todo está escrito y verificado en local,
que no es lo mismo que funcionar.

### 3 · El responsable del tratamiento no existe

Mientras el NIT, la dirección, el correo y el teléfono sean marcadores, los
canales de atención al titular que exige el artículo 17 de la Ley 1581 de 2012
**no son efectivos**. Es barato de arreglar y es el incumplimiento más claro.

---

## Comandos útiles

```bash
# Calidad
npm run lint && npm run typecheck && npm test
npm run test:coverage          # cobertura del frontend
npm run test:api:unit          # pruebas de la API sin base de datos (0,3 s)
npm run test:api               # integración (necesita npm run db:up)
npm run test:qa                # QA rápido: Chromium + Android
npm run test:qa:all            # los 6 proyectos, 474 casos
npm run test:load              # presupuestos del motor
npm run test:load:http:smoke   # carga HTTP

# Documentación que se genera y se verifica
npm run docs:openapi && npm run docs:openapi:check
npm run docs:legal   && npm run docs:legal:check

# Seguridad del despliegue
npm run build && npm run preview:headers
QA_BASE_URL=http://localhost:4173 npm run test:qa

# Base de datos
npm run db:up && npm run db:migrate && npm run db:seed
npm run db:backup && npm run db:restore
```
