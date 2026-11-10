# Pruebas de Reverde

Tres niveles, cada uno con su propio comando. Reverde es una SPA con la lógica
en el cliente, así que las pruebas se organizan alrededor de eso: las unidades
cubren el motor de decisión, QA recorre la aplicación en un navegador real y
las de carga miden los límites de escala del cliente y de la entrega estática.

| Nivel | Qué cubre | Herramienta | Comando |
|---|---|---|---|
| Unitarias / integración | Motor de IA, métricas, formato, almacenamiento, store, hooks, consentimiento, datos semilla | Vitest + Testing Library (jsdom) | `npm test` |
| QA end-to-end | Los flujos del guion de sustentación en Chrome y en móvil | Playwright | `npm run test:qa` |
| Carga | Coste del motor con inventarios grandes; entrega HTTP del build | Vitest + autocannon (+ k6 opcional) | `npm run test:load` · `npm run test:load:http` |

```bash
npm test                      # 221 pruebas unitarias del frontend
npm run test:coverage         # con reporte de cobertura (umbral 80 % líneas)
npm run test:qa               # QA en escritorio y móvil
npm run test:load             # presupuestos de rendimiento del motor
npm run test:load:http        # carga HTTP sobre el build de producción
npm run test:all              # los tres niveles en secuencia
```

## Estructura

```
tests/
├── setup.ts                  Entorno jsdom (scrollTo, matchMedia, ResizeObserver)
├── helpers/
│   ├── factories.ts          Constructores de Product, Sale, Order, PromoOutcome, User
│   └── render.tsx            Siembra localStorage y monta los providers reales
├── unit/
│   ├── ai.test.ts            Risk Score, recomendaciones, aprendizaje del histórico
│   ├── metrics.test.ts       Impacto, comparativa mensual, series, inventario
│   ├── format.test.ts        Moneda COP, pesos, fechas, pluralización
│   ├── storage.test.ts       Persistencia y tolerancia a fallos
│   ├── demoState.test.ts     Resembrado por versión y reanclaje de fechas
│   ├── consent.test.ts       Registro de habeas data (Ley 1581 de 2012)
│   ├── consent-context.test.tsx
│   ├── app-context.test.tsx  Login, inventario, carrito, checkout, acciones de IA
│   ├── hooks.test.tsx        useMarketplaceProducts, useEstablishmentData
│   ├── seed-data.test.ts     Integridad de catálogo, cuentas y datos de demo
│   └── routes.test.ts
├── qa/
│   ├── fixtures.ts           Cuentas demo, consentimiento previo, filtro de consola
│   ├── consent.spec.ts       Gate legal y autorización del pedido
│   ├── auth.spec.ts          Acceso por rol y protección de rutas
│   ├── admin-flow.spec.ts    Inventario → alertas → explicabilidad → publicar
│   ├── client-purchase.spec.ts  Explorar → carrito → checkout → confirmación
│   ├── superadmin.spec.ts    Panel global, establecimientos, publicaciones
│   └── resilience.spec.ts    Recargas, enlaces profundos, reinicio, móvil
└── load/
    ├── _dataset.ts           Generadores deterministas y utilidad de medición
    ├── engine-load.test.ts   Presupuestos de tiempo del motor
    ├── http-load.mjs         Carga HTTP con autocannon
    └── k6-marketplace.js     Perfiles humo / carga / pico / estrés con k6
```

## Unitarias

Las pruebas montan los providers reales (`AppProvider`, `ConsentProvider`) sobre
un `localStorage` sembrado, así que ejercitan el mismo camino que la app: no hay
dobles de prueba del store.

El motor de riesgo se prueba con dos anclas numéricas exactas (un producto
tranquilo puntúa 4, uno vencido 88) y con invariantes que no dependen del
calibrado: el score siempre en 0–100 y coherente con su nivel, monotonía al
acercarse el vencimiento, el descuento alivia como máximo 16 puntos, los cuatro
factores vienen ordenados por peso. Así, retocar los pesos del modelo rompe solo
las dos anclas —que se actualizan a propósito— y no las 37 pruebas restantes.

```bash
npm test -- tests/unit/ai.test.ts        # un archivo
npm test -- -t "Risk Score"              # por nombre
npm run test:watch                       # modo vigilancia
```

## QA end-to-end

Playwright levanta `vite` en el puerto 5174 y corre cada especificación en dos
proyectos: **escritorio** (1440×900) y **móvil** (Pixel 7). Las pruebas marcadas
con `isMobile` solo corren en el segundo.

Cada prueba arranca con la autorización de habeas data ya otorgada (inyectada en
`localStorage` antes del primer script) para no cruzar el gate legal en cada
caso; `consent.spec.ts` la desactiva con `test.use({ conConsentimiento: false })`
para probar el gate en sí.

```bash
npm run test:qa                                  # todo
npx playwright test --project=escritorio         # solo escritorio
npx playwright test tests/qa/admin-flow.spec.ts  # un flujo
npx playwright test --headed --debug             # viéndolo pasar
npm run test:qa:report                           # reporte HTML del último run
QA_BASE_URL=https://reverde.vercel.app npm run test:qa   # contra un despliegue
```

Varias pruebas verifican además que la consola no reporte errores durante el
recorrido. El ruido conocido (fotos de productos ausentes del repositorio,
favicon) se filtra en `RUIDO_DE_CONSOLA` dentro de `fixtures.ts`.

## Carga

**Motor (`npm run test:load`).** El Risk Score se recalcula en cada render, así
que el techo de escala de Reverde está en el cliente, no en un servidor. Cada
escenario corre con datasets muy por encima de la demo (10.000 productos,
50.000 ventas, 20.000 pedidos) y falla si pasa de su presupuesto de tiempo. Los
presupuestos tienen entre 4× y 6× de holgura sobre un portátil de desarrollo:
un fallo señala una regresión real —una función que pasó de lineal a
cuadrática—, no ruido de la máquina. Incluye una prueba de escalado (×10 datos
debe costar menos de ×25 tiempo) y una de uso sostenido que vigila la
degradación y el crecimiento del heap.

**HTTP (`npm run test:load:http`).** Compila, levanta `vite preview` y golpea
con autocannon la portada, el login, una ruta profunda del marketplace, una
ruta protegida y el centro legal; verifica cero respuestas no-2xx, p99 por
debajo de 400 ms y al menos 150 req/s. Con `--url` corre contra un despliegue,
que es donde la medición significa algo (CDN, latencia real).

```bash
npm run test:load:http:smoke                               # 5 s por escenario
node tests/load/http-load.mjs --duration 30 --connections 100
node tests/load/http-load.mjs --url https://reverde.vercel.app
```

Escenarios, umbrales y **registro de corridas** con las cifras medidas:
[`qa/carga.md`](./qa/carga.md).

**k6 (opcional).** `tests/load/k6-marketplace.js` ofrece perfiles de humo,
carga, pico y estrés con umbrales declarados, para quien tenga k6 instalado:

```bash
brew install k6
k6 run tests/load/k6-marketplace.js
k6 run -e PERFIL=pico -e BASE_URL=https://reverde.vercel.app tests/load/k6-marketplace.js
```

## En integración continua

```yaml
- run: npm ci
- run: npm run lint
- run: npm run typecheck
- run: npm run test:coverage
- run: npm run test:load
- run: npx playwright install --with-deps chromium
- run: npm run test:qa
```

Con `CI=true` Playwright reintenta dos veces, limita a dos workers y añade el
reporter de GitHub; `forbidOnly` impide que un `test.only` olvidado deje pasar
una suite incompleta.
