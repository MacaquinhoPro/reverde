# Lo que falta

Inventario único de pendientes. [`STATUS.md`](./STATUS.md) dice **qué está
hecho y con qué evidencia**; este documento dice **qué queda, quién lo
desbloquea y en qué orden conviene hacerlo**.

- **Fecha:** 10 de noviembre de 2026
- **Commit:** `51f90d2`
- **Regla de este documento:** cada renglón tiene un identificador estable, una
  severidad y el archivo donde está descrito en detalle. Nada se añade aquí sin
  decir dónde vive.

| Severidad | Significado |
|---|---|
| 🔴 | Bloquea tener un producto real o incumple algo que ya se prometió |
| 🟠 | Importante: sin esto el hito queda «parcial» |
| 🟡 | Deseable, no bloquea nada |
| ⚪ | **Decisión**, no trabajo: alguien tiene que elegir antes de que se pueda construir |

## Resumen

| Área | Renglones | 🔴 | 🟠 | 🟡 | ⚪ |
|---|---|---|---|---|---|
| Estrategia (validación de campo y negocio) | 10 | 1 | 4 | 0 | 5 |
| Diseño y accesibilidad | 9 | 0 | 4 | 3 | 2 |
| Arquitectura (datos · API · seguridad) | 19 | 3 | 7 | 5 | 4 |
| Desarrollo e integraciones | 7 | 1 | 3 | 1 | 2 |
| Calidad (QA e interfaz · carga) | 11 | 2 | 5 | 3 | 1 |
| Lanzamiento (CI/CD · analytics · respaldos) | 18 | 2 | 9 | 4 | 3 |
| Legal | 7 | 2 | 3 | 0 | 2 |
| **Total** | **81** | **11** | **35** | **16** | **19** |

> **Sobre el total.** Son 81 renglones, no 84 trabajos distintos: varios son el
> mismo problema visto desde dos documentos (por ejemplo la retención de 24
> meses aparece como `D3`, `S6`, `B5` y `L-3` legal). Donde pasa, el renglón lo
> dice con «**=**». Trabajos verdaderamente distintos: unos 70.

---

## 1 · Las decisiones que hay que tomar primero

Diecinueve renglones del backlog no son trabajo: son decisiones. Seis de ellas
bloquean a todas las demás, y son las que `STATUS.md` cita como «pregunta N».

| # | Decisión | Qué desbloquea | Quién debería decidir |
|---|---|---|---|
| **P-1** | **¿Dónde se despliega la API y la base de datos?** (Railway, Render, Fly.io, Neon + un contenedor, una VM…) | Hitos 18, 19, 20, 21 completos · `S7` · `D1` · `B2` · `L2` | Equipo técnico |
| **P-2** | **¿Contra quién se compite realmente en Colombia?** | La tabla comparativa de la UVP deja de ser hipótesis | Quien lidera el proyecto |
| **P-3** | **¿Cuál es el modelo de negocio?** (comisión por venta rescatada, suscripción, gratis) | El precio, la UVP para el establecimiento, el segmento objetivo y el criterio para priorizar `C1`–`C7` | Quien lidera el proyecto |
| **P-4** | **¿Se compra un dominio propio?** | HSTS preload, correo con dominio verificado (`I2`), k6 contra un despliegue (`L2`) | Equipo |
| **P-5** | **¿Qué proveedor de analytics y de captura de errores?** | `A2`, `A4`, `A6`, `A7` · hito 20 completo | Equipo técnico |
| **P-6** | **¿Quién es el responsable del tratamiento de datos?** (nombre legal, NIT, dirección, correo y teléfono reales) | Los canales del art. 17 de la Ley 1581 pasan a ser efectivos | Quien lidera el proyecto |

> `STATUS.md` cita las preguntas 1, 2, 4, 5 y 6 con ese número y nunca cita la 3.
> **P-3 es la que faltaba por escribir**: aparece como `TODO:` sin resolver en
> `uvp.md`, `buyer-persona.md` y `mvp-moscow.md`, y es la que más renglones
> arrastra detrás.

**P-1 y P-6 son las dos urgentes.** P-1 porque sin ella nada se ha ejecutado
nunca de verdad; P-6 porque es gratis y es el único incumplimiento legal claro.

---

## 2 · Los tres bloqueantes

### B-A · 🔴 M14 · La SPA no consume la API

Lo verificado hoy: **no hay una sola llamada `fetch` en `src/`**. El frontend
vive entero en `localStorage` y hay **dos implementaciones paralelas del mismo
dominio** (`src/lib/ai.ts` y `server/src/domain/risk.ts`).

Lo que esto arrastra: `A5` (API sin cliente), `S12` (todas las defensas de
seguridad no protegen la demo), `L1` (la carga mide el navegador, no la base),
`A1`–`A3` de analytics (los datos están en cada navegador, los indicadores no se
pueden calcular) y `P4` de despliegue (al cerrarlo hay que añadir la URL de la
API a `connect-src` o las llamadas fallan en silencio).

Plan de cierre por capas: [`mvp-moscow.md`](./estrategia/mvp-moscow.md#cómo-se-cierra-m14).

### B-B · 🔴 Nada se ha ejecutado nunca fuera de esta máquina

- La CI es YAML válido con todos sus comandos verificados en local, pero **el
  workflow nunca ha corrido**. Se confirma con el primer push.
- La API **nunca se ha desplegado** (depende de P-1).
- La **restauración de un respaldo nunca se ha probado** (`B1`).
- **k6 nunca ha corrido contra un despliegue** (`L2`).
- La integración de la API (10 archivos) **no se puede ejecutar aquí**: no hay
  Docker en esta máquina. La corre la CI.
- **Firefox** no arranca en este macOS: 1 de los 6 proyectos de Playwright sin
  verificar (`Q1`).

### B-C · 🔴 El responsable del tratamiento son marcadores

Mientras el NIT, la dirección, el correo y el teléfono digan «por definir», los
canales de atención al titular **no existen en la práctica**, por mucho que los
endpoints funcionen. Es el renglón más barato de toda esta lista.

---

## 3 · Backlog completo

### 3.1 · Estrategia · validación de campo y negocio

Hitos 1–4. El problema transversal: **todo está razonado, nada está validado
con establecimientos reales.**

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| E1 | Entrevistas con 5 establecimientos: ¿están dispuestos a registrar inventario con fechas de vencimiento? (supuesto `S1`) | 🟠 | — | [`problema-solucion.md`](./estrategia/problema-solucion.md) |
| E2 | Medir el sell-through real de un descuento del 20–40 % (supuesto `S2`) | 🟠 | E3 | ídem |
| E3 | Piloto con un establecimiento real: ¿hay demanda al precio ofrecido? (supuesto `S3`) | 🔴 | — | ídem |
| E4 | Comparar el Risk Score contra la merma real durante un mes (supuesto `S4`) | 🟠 | E3 | ídem · `R5` |
| E5 | Trabajo de campo para el perfil demográfico de las 3 personas (edad, educación, ingreso: hoy son hipótesis marcadas `TODO:`) | 🟠 | E1 | [`buyer-persona.md`](./estrategia/buyer-persona.md) |
| E6 | Verificar qué competidores operan efectivamente en Colombia y nombrarlos | ⚪ | **P-2** | [`uvp.md`](./estrategia/uvp.md) |
| E7 | Definir el modelo de negocio y el costo para el establecimiento | ⚪ | **P-3** | ídem |
| E8 | Confirmar el eslogan oficial y el gancho principal del comprador (ahorro vs. sostenibilidad) | ⚪ | **P-3** | ídem · `F4` |
| E9 | Definir el segmento inicial exacto: 1 punto, 2–5 puntos o cadena | ⚪ | **P-3** | [`buyer-persona.md`](./estrategia/buyer-persona.md) |
| E10 | Resolver quién carga el inventario el primer día (mayor fricción de adopción; hoy no hay importación masiva ni POS) | ⚪ | E3 | `R2` · `C1` |

### 3.2 · Diseño y accesibilidad

Hitos 6 y 7.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| X1 | Decidir si se construye el prototipo en Figma (hoy no existe archivo; las 23 pantallas están inventariadas con su ruta) | ⚪ | — | [`wireframes.md`](./diseno/wireframes.md) |
| X2 | **Hacer la primera ronda de pruebas con usuarios** (5 administradores + 5 compradores; las 11 tareas A1–A6 y C1–C5 están escritas y la plantilla de registro está vacía) | 🟠 | X3 | ídem |
| X3 | Reclutar participantes para esas pruebas | 🟠 | — | ídem |
| U1 | Auditoría de contraste con axe-core o Lighthouse: **la conformidad AA está afirmada, no medida** | 🟠 | — | [`ui-kit.md`](./diseno/ui-kit.md) **=** `Q2` |
| ~~U2~~ | ~~Soportar `prefers-reduced-motion`~~ | ✅ | — | **Cerrado**: `@media (prefers-reduced-motion: reduce)` en [`src/index.css`](../src/index.css) **=** `Q4` |
| U3 | Cerrar **H-2**: `Field` renderiza `<label>` sin `htmlFor`, así que los lectores de pantalla anuncian los campos sin nombre | 🟠 | — | [`QA-PLAN.md`](./QA-PLAN.md) **=** `Q3` |
| U4 | Decidir si vale la pena un Storybook | ⚪ | — | [`ui-kit.md`](./diseno/ui-kit.md) |
| U7 | **El zoom por pellizco está desactivado a propósito**, lo que incumple WCAG 1.4.4 (ampliar al 200 %). Se pidió expresamente porque en el mapa el gesto alejaba la app entera. Revisar si conviene reactivarlo cuando el mapa maneje su propio zoom | 🟡 | — | [`src/lib/viewport.ts`](../src/lib/viewport.ts) |
| U5 | Migrar las pantallas existentes a los tokens tipográficos (`text-body`…) | 🟡 | — | ídem |
| U6 | Decidir si habrá tema oscuro (hoy la paleta es solo clara) | 🟡 | — | ídem |

### 3.3 · Arquitectura · modelo de datos

Hito 9.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| D1 | Proveedor de base de datos gestionada para producción | 🔴 | **P-1** | [`modelo-datos.md`](./arquitectura/modelo-datos.md) **=** `S7` |
| D2 | Índice de búsqueda de texto en `Product.name` (`pg_trgm` o `tsvector`); hoy filtra con `contains` | 🟡 | — | ídem |
| D3 | **Aplicar la retención de 24 meses en base de datos**: está declarada en `src/data/legal.ts` y nada borra lo vencido | 🟠 | — | ídem **=** `S6` **=** `B5` **=** `L-3` |
| D4 | Particionar o archivar `AuditLog` y `PaymentEvent`, que crecen indefinidamente | 🟡 | — | ídem |
| D5 | `latitude`/`longitude` están sin usar (el mapa es simulado con `mapX`/`mapY`) | 🟡 | `C4` | ídem |

### 3.4 · Arquitectura · API

Hito 10.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| A-API1 | Documentar los 2 endpoints del simulador o excluirlos **en la especificación misma** (hoy la exclusión vive en el script) | 🟡 | — | [`api.md`](./arquitectura/api.md) |
| A-API2 | Versionar la API (`/api/v1`) antes de tener clientes externos | ⚪ | — | ídem |
| A-API3 | El límite de peticiones es en memoria por proceso: con réplicas hay que moverlo a Redis | 🟠 | **P-1** | ídem **=** `S2` |
| A-API4 | Definir el contrato de errores de validación anidados (hoy `details` lleva el error de Zod en crudo) | 🟡 | — | ídem |
| A-API5 | La SPA todavía no consume nada de esto | 🔴 | **B-A** | ídem **=** `S12` |

### 3.5 · Arquitectura · seguridad

Hito 11. `S1` y `S11` (CSP y cabeceras del frontend) **ya están cerrados** por
`vercel.json`; la tabla de [`seguridad.md`](./arquitectura/seguridad.md) todavía
los lista como abiertos y hay que corregirla.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| S2 | El límite de peticiones es por proceso → Redis | 🟠 | **P-1** | **=** `A-API3` |
| S3 | Datos del responsable del tratamiento sin completar | 🔴 | **P-6** | **=** `B-C` |
| S5 | Procedimiento y script de rotación de `ENCRYPTION_KEY` (el formato ya está versionado) | 🟠 | — | [`seguridad.md`](./arquitectura/seguridad.md) |
| S6 | Política de retención aplicada en base de datos | 🟠 | — | **=** `D3` |
| S7 | Destino de despliegue de la API y gestión de secretos | 🔴 | **P-1** | **=** `D1` |
| S8 | `npm audit` no bloquea la CI: decidir el umbral de severidad que rompe el build | 🟠 | — | ídem |
| S9 | Revisión de seguridad externa o pentest | ⚪ | datos reales | ídem |
| S10 | Sin 2FA (aceptado para el MVP, anotado a propósito) | 🟡 | — | ídem |
| S12 | La SPA guarda todo en `localStorage`: cualquiera puede editar su precio, su stock o su sesión | 🔴 | **B-A** | ídem |
| S13 | Corregir la tabla de pendientes de `seguridad.md`: tachar `S1` y `S11`, ya cerrados por `vercel.json` | 🟡 | — | este documento |

### 3.6 · Desarrollo e integraciones

Hitos 13 y 14.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| M14 | **Conectar la SPA con la API** y congelar `src/lib/ai.ts` dejando `server/src/domain/risk.ts` como única fuente de verdad | 🔴 | — | [`mvp-moscow.md`](./estrategia/mvp-moscow.md#cómo-se-cierra-m14) |
| I1 | Conseguir la cuenta de **sandbox de Wompi**: nadie del equipo la tiene, así que el adaptador real nunca se ha ejercitado contra el proveedor | 🟠 | — | [`integraciones.md`](./integraciones.md) |
| I2 | Proveedor de correo y dominio verificado (sin SPF/DKIM los correos de verificación caen en spam) | 🟠 | **P-4** | ídem |
| I3 | Decidir si **SMS** entra en el alcance (hoy no existe y nada lo necesita) | ⚪ | — | ídem |
| I4 | Captura de errores con proveedor | ⚪ | **P-5** | **=** `A4` |
| I5 | El adaptador `mercadopago` está declarado en el enum pero no existe: quitarlo o implementarlo | 🟡 | — | [`integraciones.md`](./integraciones.md) |
| I6 | Sin circuit breaker: con el proveedor caído, cada petición espera el timeout (aceptable al volumen actual) | 🟠 | — | ídem |

### 3.7 · Calidad · QA de interfaz

Hitos 15 y 16.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| Q0 | **Ejecutar la integración de la API** (10 archivos, nunca corridos aquí: falta Docker) y fijarle un umbral de cobertura con una cifra observada | 🟠 | CI o Docker | [`TESTING.md`](./TESTING.md) |
| Q1 | Confirmar `escritorio-firefox` en la CI: es el único de los 6 motores sin verificar | 🟠 | CI | [`qa/interfaz.md`](./qa/interfaz.md) |
| Q2 | Auditoría con axe-core o Lighthouse (puntos 7.8 y 8.4 de la checklist) | 🟠 | — | **=** `U1` |
| Q3 | Cerrar el hallazgo **H-2** (campos sin etiqueta) | 🟠 | — | **=** `U3` |
| ~~Q4~~ | ~~Implementar `prefers-reduced-motion`~~ | ✅ | — | **=** `U2` |
| Q5 | **Recorrer la checklist manual completa** (70 comprobaciones en 9 bloques) y registrar la ronda: ninguna persona lo ha hecho todavía | 🟠 | — | [`qa/interfaz.md`](./qa/interfaz.md) |
| Q6 | Probar en un teléfono físico, no solo en el emulador (teclado y rendimiento real) | 🟡 | — | ídem |
| H-3 | Ordenar el marketplace recalcula el riesgo dentro del comparador (rendimiento, bajo) | 🟡 | — | [`QA-PLAN.md`](./QA-PLAN.md) |
| H-4 | Las ventas semilla de hoy pueden quedar con hora futura (cosmético) | 🟡 | — | ídem |

### 3.8 · Calidad · carga

Hito 17.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| L1 | **No hay prueba de carga contra la API**: los tres escenarios miden el cliente, y el cuello de botella real es la base de datos | 🔴 | **B-A** | [`qa/carga.md`](./qa/carga.md) |
| L2 | k6 nunca se ha ejecutado contra un despliegue: las cifras locales no predicen producción | 🔴 | **P-1** · **P-4** | ídem |
| L3 | Decidir el dominio y el entorno de preproducción contra el que medir | ⚪ | **P-4** | ídem **=** `P6` |
| L4 | Correr la carga en la CI de forma periódica (no en cada PR: es lento y ruidoso) | 🟠 | CI | ídem |
| L5 | Escenario de **concurrencia de compra** (dos personas, un último producto) bajo carga; la lógica ya está probada en `concurrency.test.ts`, pero no concurrentemente de verdad | 🟠 | **B-A** | ídem |

### 3.9 · Lanzamiento · despliegue

Hitos 18 y 19.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| P1 | Destino de despliegue de la API y base gestionada | 🔴 | **P-1** | [`runbooks/despliegue.md`](./runbooks/despliegue.md) |
| P2 | **Protección de rama que exija la CI en verde**: hoy se puede mezclar con la CI en rojo (solo se configura desde GitHub) | 🟠 | — | ídem |
| P3 | Dominio propio | 🟠 | **P-4** | ídem |
| P4 | Añadir la URL de la API a `connect-src` de la CSP al cerrar M14, **o las llamadas fallarán en silencio en producción** | 🔴 | **B-A** | ídem · [`vercel.json`](../vercel.json) |
| P5 | Trabajo de despliegue de la API en la CI | 🟠 | **P-1** | ídem |
| P6 | Entorno de preproducción (hoy las vistas previas de Vercel hacen ese papel solo para la SPA) | ⚪ | **P-1** | ídem **=** `L3` |
| P7 | **Hacer el primer push y comprobar que la CI corre**: los 4 trabajos nunca se han ejecutado | 🟠 | — | [`ci.yml`](../.github/workflows/ci.yml) |

### 3.10 · Lanzamiento · analytics y monitoreo

Hito 20.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| A1 | **Instrumentar las pantallas con `track()`**: el catálogo de 30 eventos está tipado y probado, pero verificado hoy **solo `ErrorBoundary` lo llama**, así que no se emite ningún evento de producto | 🟠 | — | [`analytics.md`](./analytics.md) |
| A2 | Elegir proveedor de analytics (o la tabla propia): sin destino, los eventos se descartan | ⚪ | **P-5** | ídem |
| A3 | Metas numéricas de los 9 indicadores (un indicador sin meta es una curva bonita) | 🟠 | **P-3** | ídem |
| A4 | Captura de errores con proveedor **y** actualizar la política de privacidad en consecuencia | 🟠 | **P-5** | ídem **=** `I4` |
| A5 | Escuchas de `window.onerror` y `unhandledrejection`: el `ErrorBoundary` no cubre promesas ni manejadores | 🟠 | — | ídem |
| A6 | Agregador de logs y retención: hoy Pino escribe a la salida estándar y **los logs se pierden al reiniciar** | 🟠 | **P-1** | ídem |
| A7 | Monitor externo sobre `/api/health` y canal de alertas: **nadie recibe aviso si algo se cae** | 🔴 | **P-1** | ídem |
| A8 | Latencia p95 de la API sin instrumentar: no se puede cumplir el umbral que k6 ya declara | 🟠 | **B-A** | ídem |

### 3.11 · Lanzamiento · respaldo y recuperación

Hito 21.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| ~~B1~~ | ~~Probar una restauración de punta a punta~~ | ✅ | — | **Cerrado** el 10 nov 2026: 808 filas recuperadas en 1 s, registrado en [`backup-recovery.md`](./runbooks/backup-recovery.md) y automatizado (`npm run db:verify-backup`, trabajo `respaldo` de la CI) |
| ~~B2~~ | ~~Programar el respaldo~~ | ✅ | — | **Cerrado**: [`backup.yml`](../.github/workflows/backup.yml) corre a diario a las 07:00 UTC; queda inerte y en verde hasta que exista el secreto `DATABASE_URL` |
| B3 | Destino remoto **cifrado** para los volcados: un respaldo junto a la base no protege de perder el servidor | 🟠 | **P-1** | ídem |
| B4 | Documentar dónde se custodia `ENCRYPTION_KEY`: perderla hace inútil el respaldo | 🟠 | — | ídem · `S5` |
| B5 | Retención de 24 meses declarada y no implementada | 🟠 | — | **=** `D3` |
| B6 | Revisión legal de la postura sobre supresión vs. respaldos | ⚪ | abogado | ídem |

### 3.12 · Legal

Hitos 22 y 23.

| # | Pendiente | Sev. | Bloqueado por | Detalle |
|---|---|---|---|---|
| L-1 | **Datos reales del responsable** (nombre legal, NIT, dirección, correo y teléfono) | 🔴 | **P-6** | [`legal/README.md`](./legal/README.md) |
| L-2 | **Revisión por un abogado** de los tres documentos (hoy llevan aviso de borrador) | 🔴 | abogado | ídem |
| L-3 | Aplicar la retención de 24 meses | 🟠 | — | **=** `D3` |
| L-4 | Declarar los **encargados del tratamiento** (pasarela de pagos, proveedor de correo, analytics) en la política | 🟠 | **P-5** · `I2` | ídem |
| L-5 | Evaluar si el registro ante el **RNBD** de la SIC es exigible | ⚪ | abogado | ídem |
| L-6 | Consentimiento escrito para grabar las pruebas con usuarios | 🟠 | X2 | ídem |
| L-7 | Confirmar que `MacaquinhoPro/reverde` es el repositorio definitivo (los enlaces a GitHub del canal apuntan ahí) | ⚪ | — | [`feedback.ts`](../src/lib/feedback.ts) · ~~la segunda mitad (llevar el canal al panel del establecimiento) quedó **cerrada**: el canal está ahora en la cabecera de los tres roles~~ |

---

## 4 · La ruta más corta

Orden sugerido. No es un cronograma: es una secuencia de dependencias.

**Paso 0 · una tarde, sin escribir código**
Tomar P-1, P-4, P-5 y P-6, y escribir las respuestas en los documentos que ya
las piden. P-6 solo necesita los datos de la persona o la empresa responsable y
cierra `B-C`, `S3`, `L-1`. Hacer el primer push (`P7`) y mirar la CI.

**Paso 1 · M14**
Cerrar `M14` por capas. Cae en cadena: `S12`, `A-API5`, `A8`, y las pruebas de
carga (`L1`, `L5`) y los indicadores (`A1`–`A3`) empiezan a tener sentido.
Recordar `P4` (la CSP) **el mismo día**, o la demo en producción se rompe sin
mensaje de error.

**Paso 2 · existir de verdad**
Desplegar la API y la base según P-1 (`P1`, `P5`, `D1`, `S7`), programar el
respaldo y **probar una restauración** (`B1`, `B2`, `B3`), apuntar un monitor
externo a `/api/health` con alerta a alguien (`A7`), y mover el rate limit a
Redis si hay réplicas (`S2`).

**Paso 3 · lo que exige un humano, no un commit**
Recorrer la checklist manual (`Q5`), hacer las pruebas con usuarios (`X2`, `X3`,
`L-6`), la auditoría de accesibilidad (`U1`, `U2`, `U3`) y las entrevistas con
establecimientos (`E1`, `E3`).

**Paso 4 · deuda**
`D2`, `D4`, `D5`, `I5`, `I6`, `U5`, `U6`, `H-3`, `H-4`, `A-API1`–`A-API4`, `S13`.

---

## 5 · Lo que NO está pendiente

Para que nadie lo reabra por error:

| Se creía pendiente | Estado real |
|---|---|
| `S1` · CSP del frontend | ✅ **Cerrado** en [`vercel.json`](../vercel.json), verificado con 75 pruebas de QA sobre el build real (`npm run preview:headers`) |
| `S11` · Cabeceras de seguridad del frontend | ✅ **Cerrado**: `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS con preload, `nosniff`, COOP |
| `S4` · Exportación de datos personales | ✅ **Cerrado**: `GET /api/users/me/export` |
| `U2` / `Q4` · `prefers-reduced-motion` | ✅ **Cerrado**: bloque dedicado en `src/index.css` |
| Desbordamiento horizontal en móvil | ✅ **Cerrado**: `/app/inicio` (17 px) y `/admin/establecimientos` (9 px) ya no desbordan; lo vigila una prueba de QA en los tres perfiles móviles |
| Zoom de iOS al enfocar un campo | ✅ **Cerrado**: los campos miden 16 px en móvil, con prueba que lo verifica |
| Zoom por pellizco que encogía la app en el mapa | ✅ **Cerrado**: `src/lib/viewport.ts` + etiqueta `viewport` + `touch-action`, con 5 pruebas |
| `B1` / `B2` · Respaldo probado y programado | ✅ **Cerrado**: restauración real registrada, verificación automática en la CI y workflow diario |
| Canal de reporte para quien usa la app | ✅ **Cerrado**: formulario dentro de la aplicación, accesible desde la cabecera de los tres roles y desde la portada |
| **H-1** · `null` en una lista de `localStorage` dejaba la app en blanco | ✅ **Corregido** el 9 de noviembre de 2026 |
| Consentimiento en el registro | ✅ **Cerrado**: `POST /api/auth/register` exige `consent.accepted === true` y la versión del texto |
| Redirección HTTP → HTTPS | ✅ La hace Vercel en su borde |

## 6 · Lo que está fuera de alcance a propósito

No son pendientes: son decisiones de alcance ya tomadas y argumentadas en
[`mvp-moscow.md`](./estrategia/mvp-moscow.md).

- **Could-have** (7): importación CSV, modelo de ML entrenado, notificaciones
  push, geolocalización real, donaciones a bancos de alimentos, reseñas, app
  nativa.
- **Won't-have** (8): domicilios, integración con POS/ERP, facturación DIAN,
  multi-ciudad, multi-idioma, chat, suscripciones, app de repartidores.

Si alguien pregunta «¿y por qué no tiene X?», la respuesta está ahí con su
motivo, no es un olvido.

## 7 · Cómo se mantiene este documento

- Al cerrar un renglón: tacharlo aquí **y** en su documento de origen, con la
  evidencia (archivo o comando). Igual que en `STATUS.md`, nada se marca cerrado
  sin algo que se pueda abrir o ejecutar.
- Los identificadores no se reciclan: `S4` sigue siendo `S4` tachado.
- Al tomar una decisión `⚪`, escribir la respuesta en el documento que la pide y
  convertir el renglón en trabajo con severidad.
