# Wireframes, prototipo y pruebas con usuarios

## Estado

| Artefacto | Enlace | Estado |
|---|---|---|
| Prototipo en Figma | `TODO:` pegar el enlace al archivo de Figma (o Adobe XD) | ⬜ no existe |
| Wireframes de baja fidelidad | `TODO:` enlace | ⬜ no existe |
| Flujos interactivos | `TODO:` enlace al prototipo navegable | ⬜ no existe |
| **Implementación de referencia** | `src/pages/` · `npm run dev` | ✅ **la aplicación funcionando es hoy el prototipo de mayor fidelidad** |

> **Nota honesta sobre el orden de trabajo.** En Reverde la interfaz se diseñó
> directamente en código: no hay un archivo de Figma del que derive la
> aplicación. Este documento sirve para dos cosas: (1) inventariar las pantallas
> que ya existen, para que quien levante el Figma lo haga a partir de la realidad
> y no al revés, y (2) dejar lista la plantilla de pruebas con usuarios, que
> **todavía no se han hecho**.

`TODO:` decidir si se construye el archivo de Figma. Recomendación: hacerlo solo
para las pantallas que aún van a cambiar; para las ya estables, documentar la
implementación (este archivo + [`ui-kit.md`](./ui-kit.md)) cuesta menos y no se
desactualiza.

---

## Inventario de pantallas

Las 14 pantallas principales, cada una con su ruta y el archivo que la
implementa. La columna «Adaptación» describe qué cambia entre escritorio y móvil.

### Públicas

| # | Pantalla | Ruta | Archivo | Adaptación |
|---|---|---|---|---|
| 1 | Landing | `/` | `pages/Landing.tsx` | Una columna en móvil |
| 2 | Login y accesos rápidos | `/login` | `pages/Login.tsx` | Igual; botones grandes |
| 3 | Centro legal | `/legal/:slug` | `pages/legal/Legal.tsx` | Índice colapsable en móvil |
| — | Gate de consentimiento | modal global | `components/legal/ConsentGate.tsx` | Hoja inferior en móvil |

### Establecimiento (`supermercado` · `restaurante`)

| # | Pantalla | Ruta | Archivo | Adaptación |
|---|---|---|---|---|
| 4 | Dashboard | `/app/inicio` | `pages/admin/Dashboard.tsx` | KPIs 4 col → 2 col |
| 5 | Inventario | `/app/inventario` | `pages/admin/Inventory.tsx` | **Tabla → tarjetas**; filtros en panel desplegable |
| 6 | Alta/edición de producto | modal | `components/ProductFormModal.tsx` | Modal → hoja inferior; vista previa de riesgo en vivo |
| 7 | Alertas IA | `/app/alertas` | `pages/admin/Alerts.tsx` | Lista en una columna |
| 8 | Detalle de recomendación | `/app/alertas/:productId` | `pages/admin/RecommendationDetail.tsx` | Explicabilidad plegable |
| 9 | Marketplace propio | `/app/marketplace` | `pages/admin/MarketplaceAdmin.tsx` | Rejilla 3 → 1 col |
| 10 | Ventas | `/app/ventas` | `pages/admin/Sales.tsx` | Oculta del nav móvil (`mobile: false`) |
| 11 | Impacto | `/app/impacto` | `pages/admin/Impact.tsx` | Gráficas apiladas |

### Cliente

| # | Pantalla | Ruta | Archivo | Adaptación |
|---|---|---|---|---|
| 12 | Inicio de la tienda | `/tienda` | `pages/client/Home.tsx` | **Diseñada para móvil primero** |
| 13 | Explorar | `/tienda/explorar` | `pages/client/Marketplace.tsx` | Filtros en hoja inferior |
| 14 | Detalle de producto | `/tienda/producto/:id` | `pages/client/ProductDetail.tsx` | CTA fija al pie |
| 15 | Mapa | `/tienda/mapa` | `pages/client/MapView.tsx` | Mapa simulado, sin servicios externos |
| 16 | Carrito | `/tienda/carrito` | `pages/client/Cart.tsx` | Resumen fijo al pie |
| 17 | Checkout | `/tienda/checkout` | `pages/client/Checkout.tsx` | Métodos en lista; casilla de autorización |
| 18 | Confirmación | `/tienda/confirmacion/:orderId` | `pages/client/Confirmation.tsx` | Código, ahorro e impacto |
| 19 | Perfil | `/tienda/perfil` | `pages/client/Profile.tsx` | Incluye `DataRightsCard` |

### Superadmin

| # | Pantalla | Ruta | Archivo |
|---|---|---|---|
| 20 | Resumen global | `/admin/inicio` | `pages/super/SuperDashboard.tsx` |
| 21 | Establecimientos | `/admin/establecimientos` | `pages/super/Establishments.tsx` |
| 22 | Detalle de establecimiento | `/admin/establecimientos/:id` | `pages/super/EstablishmentDetail.tsx` |
| 23 | Publicaciones / actividad | `/admin/publicaciones` · `/admin/actividad` | `pages/super/Publications.tsx` |

### Pantallas pendientes de diseñar

| Pantalla | Para qué | Prioridad |
|---|---|---|
| Solicitud de cuenta de establecimiento | Should-have S3 (la API ya existe) | Alta |
| Verificación de correo y recuperación de contraseña | Should-have S2 (la API ya existe) | Alta |
| Bandeja de notificaciones | Should-have S4 (la API ya existe) | Media |
| Aprobación de solicitudes (superadmin) | Should-have S3 | Media |
| Importación de inventario desde CSV | Could-have C1 | Baja |

---

## Esquemas de layout

Estructura, no estética. La estética está en [`ui-kit.md`](./ui-kit.md).

### Panel del establecimiento · escritorio (≥ 768 px)

```
┌───────────┬──────────────────────────────────────────────────┐
│           │  Encabezado · establecimiento · campana · perfil │
│  SIDEBAR  ├──────────────────────────────────────────────────┤
│  15rem    │  Título de sección + acción primaria             │
│           │  ┌────────┐┌────────┐┌────────┐┌────────┐        │
│  Inicio   │  │  KPI   ││  KPI   ││  KPI   ││  KPI   │        │
│  Invent.  │  └────────┘└────────┘└────────┘└────────┘        │
│  Alertas⁴ │  ┌──────────────────────┐┌──────────────────┐    │
│  Marketp. │  │  Gráfica principal   ││  Riesgo por      │    │
│  Ventas   │  │                      ││  categoría       │    │
│  Impacto  │  └──────────────────────┘└──────────────────┘    │
│           │  ┌──────────────────────────────────────────┐    │
│           │  │  Tabla / lista de la sección             │    │
└───────────┴──────────────────────────────────────────────────┘
```

### Panel del establecimiento · móvil (< 768 px)

```
┌──────────────────────────────┐
│  Reverde      🔔   avatar    │
├──────────────────────────────┤
│  Título de sección           │
│  [ Filtros ▾ ] [ Buscar  ]   │
│  ┌────────────────────────┐  │
│  │ Yogur natural          │  │
│  │ 🔴 Alto · score 88     │  │  ← tarjeta en vez de fila
│  │ vence en 2 días        │  │
│  │ [ Ver alerta ]         │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ …                      │  │
├──────────────────────────────┤
│ 🏠    📦    ✨    🛍️    🌿  │  ← nav inferior · 4.25rem
└──────────────────────────────┘
```

### Tienda del cliente · móvil

```
┌──────────────────────────────┐
│  ← Explorar          🔍      │
│  [Todas][Lácteos][Panadería] │  ← chips con scroll horizontal
├──────────────────────────────┤
│  ┌───────┐ Yogur griego      │
│  │ foto  │ $4.200  ̶$̶7̶.̶0̶0̶0̶   │
│  │  4:3  │ -40% · vence 2 d  │
│  └───────┘ 📍 1,2 km         │
│  ┌───────┐ Pan artesanal     │
│  …                           │
├──────────────────────────────┤
│  🛒 2 productos · $8.400  →  │  ← barra de carrito fija
├──────────────────────────────┤
│ 🏠    🔍    🗺️    🛒    👤   │
└──────────────────────────────┘
```

### Detalle de recomendación (la pantalla que vende el producto)

```
┌──────────────────────────────────────────────┐
│  ← Alertas                                   │
│  Yogur natural 1 L · Lácteos                 │
│  ╭────────────────────────────────────────╮  │
│  │  ⚠ ALTO RIESGO        Score  ( 88 )    │  │  ← ScoreRing
│  │  Vence en 2 días · 18 unidades         │  │
│  ╰────────────────────────────────────────╯  │
│  ▾ ¿Por qué recomendamos esto?               │  ← plegable
│    Vencimiento  ████████████████░░  52/58    │
│    Stock        ████████░░░░░░░░░░  21/30    │
│    Rotación     ████░░░░░░░░░░░░░░   9/10    │
│    Demanda      ██░░░░░░░░░░░░░░░░   6/8     │
│    Descuento aplicado                 −0     │
│    ─────────────────────────────────────────  │
│    Fórmula: venc. + stock + rotación +       │
│    demanda − alivio por descuento            │
│  ╭────────────────────────────────────────╮  │
│  │ 💡 En 3 promociones anteriores en      │  │
│  │ lácteos, un 30 % vendió el 82 % del    │  │
│  │ inventario en 2 días.                  │  │
│  ╰────────────────────────────────────────╯  │
│  [ Aplicar 30 % de descuento ]  ← primaria   │
│  [ Publicar en marketplace ]                 │
│  [ Registrar donación ]                      │
└──────────────────────────────────────────────┘
```

---

## Pruebas con usuarios

**Estado: no se han realizado.** Lo que sigue es el protocolo y la plantilla de
registro, listos para usar.

### Protocolo

| | |
|---|---|
| Participantes | 5 por perfil: 5 administradores de establecimiento + 5 compradores. `TODO:` reclutamiento |
| Duración | 20–30 min por sesión |
| Modalidad | Presencial con el teléfono o el computador del participante, o remota compartiendo pantalla |
| Método | **Pensar en voz alta.** Sin guiar: si la persona se bloquea, se anota el bloqueo; no se le indica dónde hacer clic |
| Métricas | Tarea completada (sí/no/con ayuda) · tiempo · nº de errores · nº de intentos · SEQ (1–7, «¿qué tan fácil fue?») |
| Consentimiento | Hace falta autorización de grabación por escrito (y aplica la Ley 1581 de 2012 también aquí) |
| Entorno | `npm run dev` con los datos de demostración, o el despliegue de preproducción |

### Tareas · perfil administrador

| # | Tarea | Éxito si… |
|---|---|---|
| A1 | «Entra como el supermercado y dime qué producto está en mayor riesgo» | Llega a Alertas o Inventario e identifica el de score más alto |
| A2 | «Explícame por qué el sistema dice que ese producto está en riesgo» | Abre el panel de explicabilidad y menciona ≥ 2 factores |
| A3 | «Haz lo que haría falta para no perder ese producto» | Aplica descuento **y** publica |
| A4 | «Registra un producto nuevo que llegó hoy» | Completa el modal con datos válidos |
| A5 | «Dime cuánto dinero recuperaste este mes» | Llega a Impacto o Ventas y lee la cifra correcta |
| A6 | «Filtra solo el producto de riesgo alto» | Usa el filtro (en móvil, el panel desplegable) |

### Tareas · perfil comprador

| # | Tarea | Éxito si… |
|---|---|---|
| C1 | «Busca algo de panadería barato cerca de ti» | Usa búsqueda o filtros y lee la distancia |
| C2 | «Dime hasta cuándo puedes consumir ese producto» | Encuentra la fecha de vencimiento |
| C3 | «Cómpralo con tarjeta» | Llega a la confirmación con código |
| C4 | «Resérvalo para pagar en el local» | Completa la reserva |
| C5 | «Mira qué datos tuyos guarda la plataforma y cómo los borrarías» | Llega a Perfil → `DataRightsCard` |

### Plantilla de registro

Una fila por participante y tarea. Copiar a una hoja de cálculo o mantener aquí.

| Sesión | Fecha | Participante (anónimo) | Perfil | Dispositivo | Tarea | Resultado | Tiempo | Errores | SEQ 1–7 | Hallazgos (cita textual) | Severidad | Acción |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | | P01 | Administrador | Escritorio | A1 | ⬜ logró / ⬜ con ayuda / ⬜ falló | | | | | 🔴🟠🟡 | |
| 01 | | P01 | Administrador | Escritorio | A2 | | | | | | | |
| 02 | | P02 | Comprador | Móvil | C1 | | | | | | | |

**Severidad:** 🔴 bloquea la tarea · 🟠 la completa pero con dificultad ·
🟡 cosmético o de preferencia.

### Resumen de hallazgos

Se llena al cerrar cada ronda. Los hallazgos 🔴 y 🟠 pasan a issues de GitHub con
la etiqueta `ux`.

| # | Hallazgo | Severidad | Participantes afectados | Pantalla | Issue | Estado |
|---|---|---|---|---|---|---|
| — | *(sin pruebas realizadas todavía)* | | | | | |

### Hipótesis que estas pruebas deben confirmar o tumbar

1. La explicabilidad del Risk Score **genera confianza** en vez de abrumar.
2. El administrador entiende que «publicar» significa ponerlo a la venta con descuento.
3. La compradora distingue **«por vencer»** de **«vencido»** sin que haya que explicárselo.
4. El gate de consentimiento no espanta a nadie antes de ver el producto.
5. En móvil, el administrador puede trabajar con tarjetas sin echar de menos la tabla.
