# Pruebas de carga · escenarios, umbrales y registro de resultados

Tres herramientas, tres preguntas distintas:

| Herramienta | Pregunta que responde | Comando | Dónde |
|---|---|---|---|
| **Vitest** (presupuestos del motor) | ¿Aguanta la lógica de riesgo un inventario grande? | `npm run test:load` | `tests/load/engine-load.test.ts` |
| **autocannon** | ¿Entrega la SPA bajo concurrencia? | `npm run test:load:http` | `tests/load/http-load.mjs` |
| **k6** | ¿Aguanta un despliegue real los perfiles de carga, pico y estrés? | `k6 run …` | `tests/load/k6-marketplace.js` |

> **Lo que estas pruebas NO cubren todavía:** la API. Los tres escenarios miden
> el cliente y la entrega estática, porque **la SPA no consume la API** (Must-have
> M14). En cuanto se conecte, hace falta un cuarto escenario contra
> `/api/marketplace` y `/api/orders`, que es donde están la base de datos y las
> transacciones. Ver [pendientes](#pendientes).

---

## 1 · Presupuestos del motor

El Risk Score **se recalcula en cada render**, así que el techo de escala de
Reverde está en el cliente, no en un servidor. Cada escenario corre con datos
muy por encima de la demo y **falla si pasa de su presupuesto de tiempo**.

Los presupuestos tienen entre 4× y 6× de holgura sobre un portátil de
desarrollo: un fallo señala una regresión real —una función que pasó de lineal a
cuadrática—, no ruido de la máquina.

| Escenario | Datos | Presupuesto |
|---|---|---|
| Risk Score de todo el inventario | 10.000 productos | ver `engine-load.test.ts` |
| Recomendaciones con histórico | 10.000 productos + 50.000 ventas | |
| Estadísticas e inventario por categoría | 10.000 productos | 120 ms |
| Perfil del cliente | 20.000 pedidos | 15 ms |
| Pasada completa del tablero | 500 productos × 60 recálculos | 25 ms (p95) |
| Escalado | ×10 datos debe costar < ×25 tiempo | — |
| Memoria | sin crecimiento de heap tras 10 pasadas | — |

## 2 · Carga HTTP (autocannon)

Compila, levanta `vite preview` y golpea cinco rutas. Umbrales: **0 respuestas
no-2xx**, **p99 < 400 ms**, **≥ 150 req/s**.

```bash
npm run test:load:http:smoke                                 # 5 s por escenario
npm run test:load:http                                       # corrida completa
node tests/load/http-load.mjs --duration 30 --connections 100
node tests/load/http-load.mjs --url https://…                # contra un despliegue
```

Las rutas elegidas cubren los cuatro casos de entrega distintos: la portada, una
ruta reescrita (`/login`), una ruta profunda (`/tienda/explorar`), una protegida
(`/app/inventario`) y el centro legal.

## 3 · Perfiles de k6

`tests/load/k6-marketplace.js` declara cuatro perfiles y sus umbrales:

| Umbral | Valor | Qué protege |
|---|---|---|
| `http_req_failed` | `rate < 0.01` | Menos del 1 % de error |
| `http_req_duration` | `p(95) < 800 ms` · `p(99) < 1500 ms` | Latencia percibida |
| `reverde_shell_ok` | `rate > 0.99` | La SPA se entrega completa |
| `reverde_shell_latency` | `p(95) < 800 ms` | Primer byte útil |
| `checks` | `rate > 0.99` | Las aserciones del escenario |

```bash
brew install k6
k6 run tests/load/k6-marketplace.js                              # perfil por defecto
k6 run -e PERFIL=humo   tests/load/k6-marketplace.js
k6 run -e PERFIL=carga  tests/load/k6-marketplace.js
k6 run -e PERFIL=pico   -e BASE_URL=https://… tests/load/k6-marketplace.js
k6 run -e PERFIL=estres -e BASE_URL=https://… tests/load/k6-marketplace.js
```

**k6 solo significa algo contra un despliegue real** (CDN, latencia de red,
límites del proveedor). Contra `localhost` mide el portátil.

---

## 4 · Cómo registrar una corrida

1. Anota **contra qué** corriste (local o URL del despliegue) y el commit.
2. Pega las cifras en la tabla de abajo: p50, p95, p99, req/s y tasa de error.
3. Si algún umbral falla, abre un issue con la etiqueta `rendimiento` y enlázalo.
4. Compara contra la corrida anterior del mismo escenario: **la tendencia dice
   más que el número absoluto**, porque la máquina cambia.
5. Guarda el reporte completo si la herramienta lo genera
   (`tests/load/k6-summary.json` está en `.gitignore`: no se versiona, se adjunta
   al issue o al PR).

### Registro

| Fecha | Commit | Escenario | Contra | p50 | p95 / p99 | req/s | Errores | Umbrales | Notas |
|---|---|---|---|---|---|---|---|---|---|
| 2026-11-09 | `a30a2b1` | Motor (12 presupuestos) | local · Node 24, macOS | — | ver salida | — | 0 | ✅ **12/12 pasan** | `inventoryStats+riskByCategory ×10.000`: p95 **18,6 ms** sobre 120 ms de presupuesto · `clientMetrics` 20.000 pedidos: p95 **0,7 ms** sobre 15 ms · pasada sostenida ×60: p95 **3,4 ms** sobre 25 ms · degradación **0,98×** · heap **−46,7 MB** (no retiene) |
| 2026-11-09 | `a30a2b1` | HTTP humo · 5 rutas | local · `vite preview`, 20 conexiones, 5 s | **1 ms** | p99 **1 ms** (máx 11 ms) | **~15.300** | **0** | ✅ todos | Build de producción. Son cifras de disco local: sirven de línea base, no predicen producción |
| | | k6 · perfil humo | `TODO:` despliegue | | | | | ⬜ sin ejecutar | Falta decidir el dominio |
| | | k6 · perfil carga | `TODO:` despliegue | | | | | ⬜ sin ejecutar | |
| | | k6 · perfil pico | `TODO:` despliegue | | | | | ⬜ sin ejecutar | |
| | | API · `/api/marketplace` | — | | | | | ⬜ **no existe el escenario** | Depende de M14 |

---

## Pendientes

| # | Pendiente | Impacto |
|---|---|---|
| L1 | **No hay pruebas de carga de la API.** Los tres escenarios miden el cliente | Alto cuando se cierre M14: la base de datos y las transacciones son el cuello de botella real |
| L2 | k6 nunca se ha ejecutado contra un despliegue | Las cifras locales no predicen producción |
| L3 | `TODO:` decidir el dominio y el entorno de preproducción contra el que medir | Bloquea L2 |
| L4 | `TODO:` ejecutar la carga en la CI de forma periódica (no en cada PR: es lento y ruidoso) | Detectaría regresiones de rendimiento sin frenar el desarrollo |
| L5 | Sin escenario de **concurrencia de compra** (dos personas, un último producto) | La lógica ya está probada en `server/src/tests/concurrency.test.ts`, pero no bajo carga |
