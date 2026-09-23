# Reverde 🌿

**Menos desperdicio, más valor.**

Prototipo funcional (MVP) de una plataforma **B2B2C** que reduce el desperdicio de alimentos mediante
**inventario inteligente**, **alertas y priorización con IA** y un **marketplace** de rescate.

> Reverde detecta qué alimentos tienen riesgo de convertirse en desperdicio, ayuda al establecimiento a
> decidir qué hacer con ellos y los conecta con compradores para recuperar valor antes de perderlos.

Este es un **prototipo académico**: usa datos simulados, lógica heurística en lugar de un modelo de ML real,
`localStorage` como persistencia y una pasarela de pago simulada. No hay servicios externos: funciona sin internet.

---

## Cómo ejecutarlo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de producción
```

## Cuentas de demostración

Contraseña única para todas: **`Demo1234`**

| Rol | Cuentas |
|---|---|
| Administrador de supermercado | `supermercado1@reverde.com` · `supermercado2@reverde.com` · `supermercado3@reverde.com` |
| Administrador de restaurante | `restaurante1@reverde.com` · `restaurante2@reverde.com` · `restaurante3@reverde.com` |
| Cliente / comprador | `cliente1@reverde.com` · `cliente2@reverde.com` · `cliente3@reverde.com` |
| Superadministrador | `admin1@reverde.com` · `admin2@reverde.com` · `admin3@reverde.com` |

La pantalla de login incluye **accesos rápidos** (Entrar como supermercado / restaurante / cliente / superadmin)
para la presentación. Desde *Perfil → Reiniciar datos de la demo* se restauran los datos originales.

---

## Guion sugerido para la sustentación

**1 · Flujo del administrador** (`supermercado1@reverde.com`)
`Inicio` → ver KPIs e impacto → `Inventario` → el yogur natural aparece en **alto riesgo** →
`Alertas IA` → abrir la alerta → **¿Por qué recomendamos esto?** (explicabilidad) →
**Aplicar descuento** → **Publicar en marketplace**.

**2 · Flujo del cliente** (`cliente1@reverde.com`)
`Explorar` → filtrar por categoría / vence pronto → abrir el producto recién publicado →
`Agregar al carrito` → `Carrito` (ahorro e impacto) → `Checkout` (tarjeta / PSE / pago en el local) →
**Compra confirmada** con código, ahorro e impacto ambiental.

**3 · Vuelta al administrador**
`Ventas` muestra la venta recién hecha; `Impacto` actualiza desperdicio evitado y dinero recuperado;
el stock del producto bajó en el inventario.

**4 · Flujo del superadmin** (`admin1@reverde.com`)
`Resumen global` → `Establecimientos` → abrir un establecimiento → `Publicaciones` de toda la red.

---

## Las tres propuestas del proyecto

| | Dónde se ve |
|---|---|
| **1. Inventario inteligente** | `/app/inventario` — tabla en web y tarjetas en móvil, con Risk Score, filtros, búsqueda, orden, alta/edición/baja de productos y publicación directa. |
| **2. Alertas y priorización con IA** | `/app/alertas` y `/app/alertas/:producto` — alertas por nivel de riesgo, explicabilidad de cada recomendación, acciones sugeridas con CTA y aprendizaje sobre promociones anteriores. |
| **3. Marketplace** | `/tienda` — catálogo, filtros, detalle, mapa, carrito, reserva, compra y pago simulados. |

Las tres están conectadas: el inventario alimenta a la IA, la IA recomienda publicar, el marketplace vende, y
la venta vuelve al inventario y a las métricas de impacto.

---

## Cómo funciona la "IA"

No hay un modelo entrenado: hay un **sistema heurístico explicable** (`src/lib/ai.ts`) que imita el
comportamiento de un modelo predictivo y puede justificar cada decisión.

```
Risk Score (0–100) =
    riesgo por vencimiento        (0–58, crece exponencialmente al acercarse la fecha,
                                   ponderado por la perecibilidad de la categoría)
  + riesgo por stock              (0–30, días necesarios para agotar el stock frente a los días restantes)
  + riesgo por baja rotación      (0–10, ventas diarias históricas)
  + patrón de demanda reciente    (0–8,  variación frente a la semana anterior)
  − alivio por descuento aplicado (hasta 16)
```

`0–39` bajo riesgo · `40–69` riesgo medio · `70–100` alto riesgo.

**Aprendizaje simulado:** cada promoción vendida se guarda como un `PromoOutcome`
(categoría, descuento, % de inventario vendido, días hasta agotarse). `learnFromHistory()` busca el
descuento con mejor relación sell-through/margen para esa categoría y mezcla ese valor con la
recomendación base, produciendo mensajes como:

> *"Basándonos en 3 promociones anteriores en lácteos, un descuento del 30 % logró vender el 82 % del
> inventario en 2 días antes del vencimiento."*

Cada compra en el marketplace añade un nuevo resultado, así que **las recomendaciones cambian durante la demo**.

---

## Arquitectura

```
src/
├── types.ts                  Modelo de dominio
├── data/                     Datos mock (establecimientos, usuarios, catálogo, inventario, histórico)
├── lib/
│   ├── ai.ts                 Risk Score, recomendaciones, explicabilidad, aprendizaje
│   ├── metrics.ts            KPIs de impacto, series semanales, comparativas mes a mes
│   ├── format.ts             COP, fechas, utilidades
│   └── storage.ts            Persistencia en localStorage
├── store/AppContext.tsx      Estado global: sesión, inventario, carrito, pedidos, ventas, toasts
├── hooks/                    useEstablishmentData · useMarketplace
├── components/
│   ├── Logo.tsx              Isotipo (hoja + ciclo) y logotipo
│   ├── ui/                   Design system: Button, Badge, Field, Modal, Primitives, Toaster
│   ├── charts/               Gráficas (Recharts) con paleta validada para daltonismo
│   ├── layout/               AppShell (sidebar web + nav inferior móvil) · ClientShell
│   ├── AiRecommendation.tsx  Panel de IA y explicabilidad
│   ├── ProductCard.tsx       Tarjeta del marketplace
│   ├── ProductFormModal.tsx  Alta/edición con vista previa de riesgo en vivo
│   └── SimulatedMap.tsx      Mapa simulado sin servicios externos
└── pages/                    landing, login, admin/, client/, super/
```

**Stack:** React 19 · TypeScript (strict) · Tailwind CSS · React Router · Recharts · lucide-react · Vite.

### Las 14 pantallas principales

1. Landing (`/`) · 2. Login y selección de rol (`/login`) · 3. Dashboard del establecimiento (`/app/inicio`)
4. Inventario (`/app/inventario`) · 5. Crear/editar producto (modal) · 6. Alertas y priorización IA (`/app/alertas`)
7. Detalle de recomendación y publicación (`/app/alertas/:id`) · 8. Impacto (`/app/impacto`) e Historial de ventas (`/app/ventas`)
9. Marketplace (`/tienda/explorar`) · 10. Detalle del producto (`/tienda/producto/:id`) · 11. Carrito (`/tienda/carrito`)
12. Checkout simulado (`/tienda/checkout`) y confirmación · 13. Mapa (`/tienda/mapa`) · 14. Dashboard superadmin (`/admin/inicio`)

Extras: inicio del cliente (`/tienda`), perfil del cliente, establecimientos y publicaciones del superadmin.

---

## Identidad visual

**Logo:** una hoja (frescura, origen natural) inscrita en dos flechas circulares (ciclo, renovación, segunda
oportunidad). Funciona con texto, solo como isotipo, sobre fondo blanco y sobre fondo verde
(`<Logo tone="light" />`).

| Color | Hex | Uso |
|---|---|---|
| Verde principal | `#1F5D42` | Marca, acciones primarias |
| Verde secundario | `#72B58B` | Acentos |
| Verde pastel | `#DDEFE4` | Superficies suaves |
| Fondo | `#F8FBF9` | Lienzo |
| Texto principal | `#1C2822` | Titulares y cuerpo |
| Gris secundario | `#6B756F` | Texto de apoyo |

**Estados de riesgo:** verde (bajo) · ámbar (medio) · rojo suave (alto). El color **nunca** es la única
señal: todos los badges incluyen texto e icono. La paleta de las gráficas (`#3F9E6B`, `#E0A81C`, `#C8453E`)
se validó para separación cromática bajo daltonismo.

---

## Responsive

- **Web (establecimientos y superadmin):** sidebar, tablas, KPIs, gráficas y filtros en línea.
- **Móvil (clientes):** navegación inferior, tarjetas, botones grandes y filtros en bottom sheet.
- Los administradores conservan las funciones esenciales en móvil (tarjetas en vez de tablas, filtros en modal).

## Estado y consistencia

Todas las acciones producen cambios visibles y persistentes en `localStorage`:
crear producto → aparece en inventario · aplicar descuento → cambia el precio · publicar → aparece en el
marketplace · comprar → baja el stock, registra la venta, alimenta el aprendizaje y actualiza las métricas de
impacto del establecimiento y del panel global.

---

*Prototipo académico · Bogotá, Colombia · Datos y pagos simulados.*
