# QA de interfaz · cobertura automatizada y checklist manual

Dos partes: lo que verifica una máquina en cada push, y lo que solo puede
verificar una persona mirando la pantalla.

Plan de pruebas y hallazgos abiertos: [`../QA-PLAN.md`](../QA-PLAN.md) ·
Niveles de prueba: [`../TESTING.md`](../TESTING.md)

---

## 1 · Matriz cross-browser

Seis proyectos de Playwright, **79 casos cada uno: 474 pruebas** en total
(`playwright.config.ts`).

El criterio es el **motor de renderizado**, no la marca: Chrome, Edge, Brave y
Opera comparten Chromium, y Safari —el navegador de todo iPhone— es WebKit.
Cubrir los tres motores cubre el parque real sin multiplicar las corridas.

| Proyecto | Motor | Dispositivo / viewport | Por qué está |
|---|---|---|---|
| `escritorio-chromium` | Chromium | 1440 × 900 | El navegador del administrador del establecimiento |
| `escritorio-firefox` | Gecko | 1440 × 900 | Único motor independiente; detecta dependencias de Chromium |
| `escritorio-webkit` | WebKit | 1440 × 900 | Safari en macOS; es el que rompe primero |
| `móvil-android` | Chromium | Pixel 7 | El perfil más común de la compradora |
| `móvil-ios` | WebKit | iPhone 14 | Safari móvil: viewport, `env(safe-area-inset-*)`, teclado |
| `móvil-pequeño` | Chromium | 360 × 640 | El peor caso de layout que hay que soportar |

```bash
npx playwright install        # una vez: descarga los tres motores
npm run test:qa               # rápido: Chromium escritorio + Android (158 casos)
npm run test:qa:all           # la matriz completa (474 casos)
npx playwright test --project=escritorio-webkit
npm run test:qa:report        # abre el reporte HTML
QA_BASE_URL=https://… npm run test:qa:all   # contra un despliegue, sin servidor local
```

### Última corrida verificada · 9 de noviembre de 2026

| Proyecto | Resultado | Nota |
|---|---|---|
| `escritorio-chromium` + `móvil-android` | ✅ **154 pasan**, 4 omitidas | Las omitidas son casos solo-móvil o solo-escritorio |
| `escritorio-webkit` | ✅ **75 pasan**, 4 omitidas | |
| `móvil-ios` + `móvil-pequeño` | ✅ **158 pasan** | |
| `escritorio-firefox` | ⚠️ **no se pudo ejecutar localmente** | `browserType.launch: Could not find profile folder` — fallo del Firefox de Playwright en este macOS, **no de la aplicación**. Lo ejecuta la CI en Ubuntu |

**Total verificado localmente: 387 pruebas en verde** sobre 5 de los 6 proyectos.

`TODO:` confirmar en la primera corrida de CI que `escritorio-firefox` pasa en
Ubuntu. Si fallara por el motor y no por el entorno, es un hallazgo real y hay
que registrarlo en [`../QA-PLAN.md`](../QA-PLAN.md).

---

## 2 · Cobertura de código

Objetivo del plan de trabajo: **≥ 70 % en la lógica crítica**. Hay tres puertas,
y cada una mide lo que puede medir de forma determinista.

| Suite | Comando | Umbral que bloquea | Medición real |
|---|---|---|---|
| Lógica del frontend (`src/lib`, `hooks`, `store`, `data`) | `npm run test:coverage` | 80 % líneas · 80 % funciones · 80 % sentencias · 70 % ramas | ✅ **98,56 % líneas** · 90,12 % ramas · 221 pruebas |
| Lógica pura de la API (Risk Score, contraseñas, cifrado, reintentos) | `npm run test:api:coverage` | 80 % líneas · 80 % funciones · 70 % ramas | ✅ **94 % líneas** · 74,14 % ramas · 31 pruebas |
| Integración de la API (requiere PostgreSQL) | `npm run test:api` | **sin umbral todavía** | ⚠️ sin medir: necesita base de datos |

El tercero no tiene umbral **a propósito**: su cobertura solo se puede medir
donde haya PostgreSQL, y fijar un número sin haberlo observado rompería la CI
por un dato inventado. En cuanto la CI reporte una cifra estable, se fija en ese
valor menos un margen (`server/vitest.config.ts` tiene la nota).

```bash
npm run test:coverage       # frontend · reporte HTML en coverage/
npm run test:api:unit       # 31 pruebas de la API SIN base de datos, en 0,3 s
npm run test:api:coverage   # con cobertura
npm run test:api            # integración completa (necesita npm run db:up)
```

> `npm run test:api:unit` existe para que la red de seguridad de la API no
> dependa de tener Docker encendido.

---

## 3 · Checklist manual

Lo que una aserción no juzga bien: que las cifras resulten creíbles, que las
gráficas se lean, que el texto quepa y que el relato se sostenga.

**Cómo usarla:** copiar la tabla al PR o a la hoja de la ronda de QA, poner
`✅` / `❌` / `n/a` y la fecha. Un `❌` se convierte en issue con la plantilla de
bug antes de cerrar la ronda.

### 3.1 · Antes de empezar

- [ ] `npm run build && npm run preview` (se prueba el **build de producción**, no el servidor de desarrollo)
- [ ] Almacenamiento limpio (ventana privada o *Borrar datos del sitio*)
- [ ] Zoom del navegador al 100 %
- [ ] Probar en al menos **dos** motores distintos

### 3.2 · Primer contacto y capa legal

| # | Comprobación | Resultado |
|---|---|---|
| 1.1 | La portada carga en menos de 2 s con red normal | |
| 1.2 | Aparece el diálogo de autorización de datos antes de poder usar la app | |
| 1.3 | La portada y `/legal/*` se leen **sin** autorizar nada | |
| 1.4 | El texto legal se puede leer completo, sin cortes ni desbordes | |
| 1.5 | «No autorizo» explica la consecuencia y permite reconsiderar | |
| 1.6 | Tras autorizar, no vuelve a preguntar al recargar | |
| 1.7 | Los enlaces del pie legal funcionan (nada roto ni a `#`) | |

### 3.3 · Credibilidad de los datos (lo que mira un evaluador)

| # | Comprobación | Resultado |
|---|---|---|
| 2.1 | Los precios parecen precios colombianos reales (`$4.200`, no `$4.2` ni `$4,200.00`) | |
| 2.2 | **El peso COP nunca muestra decimales** | |
| 2.3 | Las fechas de vencimiento son coherentes con el nivel de riesgo mostrado | |
| 2.4 | Ningún producto de la demo aparece vencido al abrir la app | |
| 2.5 | Los KPI de impacto son plausibles (no 0, no absurdamente grandes) | |
| 2.6 | Las equivalencias de CO₂ y agua tienen magnitud creíble | |
| 2.7 | Los porcentajes de descuento coinciden con la diferencia real de precio | |
| 2.8 | La suma del carrito coincide con los productos, al peso | |
| 2.9 | El ahorro mostrado = precio original − precio con descuento | |

### 3.4 · Legibilidad de las gráficas

| # | Comprobación | Resultado |
|---|---|---|
| 3.1 | Las etiquetas de los ejes se leen sin solaparse | |
| 3.2 | Ninguna gráfica queda cortada en móvil | |
| 3.3 | Las leyendas identifican la serie sin depender solo del color | |
| 3.4 | Los tooltips aparecen al pasar el cursor y no tapan el dato | |
| 3.5 | Con una sola fecha de datos, la gráfica no se ve vacía ni rota | |
| 3.6 | Los tres niveles de riesgo se distinguen **en escala de grises** | |

### 3.5 · El relato de la sustentación

| # | Comprobación | Resultado |
|---|---|---|
| 4.1 | El recorrido admin → cliente → admin se completa **sin recargar a mano** | |
| 4.2 | El producto publicado aparece en el marketplace **de inmediato** | |
| 4.3 | Tras la compra, el stock bajó en el inventario | |
| 4.4 | La venta aparece en `/app/ventas` con el monto correcto | |
| 4.5 | `/app/impacto` subió en kg y en pesos | |
| 4.6 | La recomendación **cambia** después de una compra (aprendizaje visible) | |
| 4.7 | La explicabilidad se entiende sin explicación verbal | |
| 4.8 | «Reiniciar datos de la demo» devuelve todo al estado inicial | |
| 4.9 | Los accesos rápidos de los 4 roles funcionan | |

### 3.6 · Interfaz y estados

| # | Comprobación | Resultado |
|---|---|---|
| 5.1 | Ningún texto se desborda ni se corta (probar con nombres largos) | |
| 5.2 | Toda lista vacía muestra un `EmptyState` con salida, no una pantalla blanca | |
| 5.3 | Toda acción que cambia datos confirma con un aviso | |
| 5.4 | Las acciones destructivas piden confirmación | |
| 5.5 | Los botones deshabilitados se ven deshabilitados | |
| 5.6 | Las imágenes que faltan caen al gradiente de categoría, sin icono roto | |
| 5.7 | Las transiciones no «saltan» ni parpadean | |
| 5.8 | El scroll vuelve arriba al cambiar de pantalla | |
| 5.9 | Nada de texto de relleno, `TODO` ni «Lorem ipsum» visible | |
| 5.10 | La consola del navegador queda **sin errores** en todo el recorrido | |

### 3.7 · Móvil (con un teléfono real, no solo el emulador)

| # | Comprobación | Resultado |
|---|---|---|
| 6.1 | Ningún control mide menos de 44 px de lado | |
| 6.2 | La navegación inferior no tapa contenido ni el botón principal | |
| 6.3 | El contenido respeta el notch y la barra inferior (`safe-area`) | |
| 6.4 | El teclado no oculta el campo que se está escribiendo | |
| 6.5 | **No hay scroll horizontal** en ninguna pantalla | |
| 6.6 | Los filtros en hoja inferior abren y cierran bien, y se pueden descartar | |
| 6.7 | El inventario del administrador es usable como tarjetas | |
| 6.8 | Funciona en vertical **y** en horizontal | |
| 6.9 | El checkout se completa entero desde el teléfono | |

### 3.8 · Accesibilidad

Cubierto en parte por las pruebas automatizadas; esto es lo que falta mirar.

| # | Comprobación | Resultado |
|---|---|---|
| 7.1 | Se puede recorrer toda la app **solo con el teclado** (Tab/Enter/Esc) | |
| 7.2 | El foco se ve siempre (anillo visible) | |
| 7.3 | Los modales atrapan el foco y cierran con `Esc` | |
| 7.4 | Todo campo tiene etiqueta asociada (**hallazgo H-2 abierto**) | |
| 7.5 | El riesgo se entiende sin color: texto + icono | |
| 7.6 | Las imágenes informativas tienen `alt`; las decorativas, `alt=""` | |
| 7.7 | Un lector de pantalla anuncia los avisos del `Toaster` | |
| 7.8 | Contraste AA en texto y controles (`TODO:` medir con axe o Lighthouse) | |
| 7.9 | Con `prefers-reduced-motion` activo no hay animación (**pendiente U2**) | |

### 3.9 · Rendimiento percibido

| # | Comprobación | Resultado |
|---|---|---|
| 8.1 | Ninguna interacción se siente trabada (filtros, orden, búsqueda) | |
| 8.2 | Las gráficas no provocan un salto visible al montar | |
| 8.3 | Con 100+ productos el inventario sigue respondiendo | |
| 8.4 | `TODO:` Lighthouse móvil ≥ 90 en rendimiento y accesibilidad — sin medir |

---

## 4 · Registro de rondas

| Ronda | Fecha | Quién | Versión / commit | Motores probados | ❌ encontrados | Issues abiertos |
|---|---|---|---|---|---|---|
| — | | | | | | *(sin rondas manuales registradas todavía)* |

## 5 · Pendientes de QA de interfaz

| # | Pendiente | Impacto |
|---|---|---|
| Q1 | Confirmar `escritorio-firefox` en la CI | Es el único motor sin verificar |
| Q2 | `TODO:` auditoría con axe-core o Lighthouse (puntos 7.8 y 8.4) | La conformidad AA está afirmada, no medida |
| Q3 | Cerrar el hallazgo **H-2** (campos sin etiqueta) | Accesibilidad |
| Q4 | Implementar `prefers-reduced-motion` (pendiente U2 del UI Kit) | Accesibilidad |
| Q5 | Hacer la primera ronda manual completa y registrarla arriba | Ninguna persona ha recorrido esta checklist todavía |
| Q6 | `TODO:` probar en un teléfono físico, no solo en el emulador | El emulador no detecta problemas de teclado ni de rendimiento real |
