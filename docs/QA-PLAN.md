# Plan de QA · Reverde

Qué se prueba, cómo se prueba y qué quedó abierto. La parte automatizada vive
en `tests/qa` (Playwright, 154 casos entre escritorio y móvil); la lista de
verificación manual al final es para la sustentación, donde hay que mirar cosas
que una aserción no juzga bien: que las cifras resulten creíbles, que las
gráficas se lean y que el relato se sostenga.

Ejecución: `npm run test:qa` · reporte: `npm run test:qa:report` · detalles en
[TESTING.md](./TESTING.md).

---

## Alcance

| Área | Riesgo si falla | Automatizado en |
|---|---|---|
| Autorización de habeas data | Incumplimiento de la Ley 1581 de 2012 | `consent.spec.ts` |
| Acceso y separación de roles | Un rol ve datos de otro | `auth.spec.ts` |
| Inventario y alertas de IA | El valor central del producto no se demuestra | `admin-flow.spec.ts` |
| Explicabilidad del Risk Score | La IA parece una caja negra | `admin-flow.spec.ts` |
| Compra y reserva del cliente | El flujo B2B2C se corta | `client-purchase.spec.ts` |
| Trazabilidad venta → impacto | Las métricas no cuadran con lo ocurrido | `client-purchase.spec.ts` |
| Supervisión global | El superadmin no puede auditar la red | `superadmin.spec.ts` |
| Persistencia y recargas | La demo se pierde a media sustentación | `resilience.spec.ts` |
| Uso en móvil | La demo no se puede mostrar desde un teléfono | proyecto `móvil` |

Fuera de alcance, y por qué: no hay pruebas de pasarela de pago (es simulada y
no toca ningún proveedor), ni de API (el backend en `server/` todavía no tiene
código), ni auditoría de accesibilidad completa —solo las comprobaciones
puntuales que aparecen abajo.

---

## Casos automatizados

### 1 · Autorización de tratamiento de datos (`consent.spec.ts`)

| # | Caso | Resultado esperado |
|---|---|---|
| 1.1 | Primera visita a `/login` | Aparece el diálogo modal de autorización |
| 1.2 | Portada y `/legal/*` sin autorizar | Se leen sin diálogo: el titular puede informarse antes |
| 1.3 | «No autorizo» | Mensaje de salida y opción de reconsiderar |
| 1.4 | «Autorizo» sin marcar las casillas | El diálogo no se cierra |
| 1.5 | Autorizar las dos obligatorias | Se desbloquea y queda registro con versión, fecha y bitácora |
| 1.6 | Recargar después de autorizar | No vuelve a preguntar |
| 1.7 | «Leer el texto completo» | Se despliega el texto de la autorización |
| 1.8 | Checkout sin la casilla del pedido | El botón de pago está deshabilitado |
| 1.9 | Checkout con la casilla marcada | El pedido guarda `consent` con versión y finalidad |

### 2 · Acceso y roles (`auth.spec.ts`)

| # | Caso | Resultado esperado |
|---|---|---|
| 2.1–2.4 | Accesos rápidos de los cuatro roles | Cada uno aterriza en su área y la sesión guardada coincide |
| 2.5 | Formulario con cuenta válida | Entra al panel del establecimiento |
| 2.6 | Contraseña incorrecta | «Contraseña incorrecta», sigue en `/login` |
| 2.7 | Correo inexistente | «No encontramos una cuenta», sigue en `/login` |
| 2.8–2.9 | `/app/*` y `/admin/*` sin sesión | Redirige a `/login` |
| 2.10 | Cliente entrando a `/app/*` | Redirige a `/tienda` |
| 2.11 | Administrador entrando a `/admin/*` | Redirige a `/app/inicio` |
| 2.12 | Superadmin entrando a `/app/*` | Redirige a `/admin/inicio` |
| 2.13 | Marketplace sin sesión | Se explora libremente |
| 2.14 | Cerrar sesión | Sin sesión y con el carrito vacío |
| 2.15 | Ruta inexistente | Vuelve a la portada |

### 3 · Flujo del administrador (`admin-flow.spec.ts`)

| # | Caso | Resultado esperado |
|---|---|---|
| 3.1 | Inicio | KPIs e identidad del establecimiento |
| 3.2 | Navegación completa | Las cinco secciones cargan su encabezado |
| 3.3 | Inventario | Lista con insignia de riesgo por producto |
| 3.4 | Filtro «Alto» | Solo quedan productos de alto riesgo (panel desplegable en móvil) |
| 3.5 | Búsqueda | Encuentra el producto por nombre |
| 3.6 | Alertas | Priorizadas y filtrables por nivel |
| 3.7 | Explicabilidad | Los cuatro factores del Risk Score y la fórmula, plegable |
| 3.8 | Aplicar descuento recomendado | El producto queda con ese descuento |
| 3.9 | Publicar desde la alerta | Pasa a estado publicado |
| 3.10 | Histórico de la categoría | Muestra el mejor descuento aprendido |
| 3.11 | Ventas | Hay movimientos del histórico simulado |
| 3.12 | Impacto | Equivalencias de CO₂ y agua |
| 3.13 | Registrar producto | El botón exige datos válidos; el producto aparece en el inventario |
| 3.14 | Recorrido completo | Sin errores en consola |

### 4 · Flujo del cliente (`client-purchase.spec.ts`)

| # | Caso | Resultado esperado |
|---|---|---|
| 4.1 | Inicio de la tienda | Productos a la vista |
| 4.2 | Explorar | Precio, impacto y vencimiento en cada tarjeta |
| 4.3 | Búsqueda | Filtra el catálogo |
| 4.4 | Búsqueda sin resultados | «No encontramos productos» |
| 4.5 | Mapa | Establecimientos ubicados |
| 4.6 | Ficha del producto | Comprar, reservar, agregar e impacto |
| 4.7 | Agregar al carrito | Aviso y resumen con ahorro e impacto |
| 4.8 | Subir cantidad más allá del stock | Se topa y lo explica |
| 4.9 | Quitar el último producto | Carrito vacío con salida a explorar |
| 4.10 | Compra con tarjeta | Confirmación con código `RV-XXXXX`; el carrito queda limpio |
| 4.11 | Reserva | «Reserva confirmada», se paga en el local |
| 4.12 | Perfil | Acumula pedidos y ahorro |
| 4.13 | Venta de vuelta en el panel | El administrador ve la venta del cliente |
| 4.14 | Recorrido completo | Sin errores en consola |

### 5 · Superadmin (`superadmin.spec.ts`)

| # | Caso | Resultado esperado |
|---|---|---|
| 5.1 | Resumen global | Ranking y gráficas de la red |
| 5.2 | Listado | Los seis establecimientos de la demo |
| 5.3 | Búsqueda | Filtra por nombre |
| 5.4 | Búsqueda sin coincidencias | «Sin resultados» |
| 5.5 | Detalle | Inventario por riesgo, publicaciones, ubicación e impacto |
| 5.6 | Establecimiento inexistente | Estado vacío con vuelta al listado |
| 5.7–5.8 | Publicaciones y actividad | Cargan y listan la red |
| 5.9 | Ruta desconocida | Vuelve al resumen |
| 5.10 | Recorrido completo | Sin errores en consola |

### 6 · Resiliencia y móvil (`resilience.spec.ts`)

| # | Caso | Resultado esperado |
|---|---|---|
| 6.1 | Recargar con sesión | Se mantiene la sesión y la ruta |
| 6.2 | Recargar con carrito | El carrito sobrevive |
| 6.3 | Enlace profundo a un producto | Abre la ficha directamente |
| 6.4 | Producto inexistente | Estado vacío, sin pantalla blanca |
| 6.5 | Confirmación inexistente | Estado vacío, sin pantalla blanca |
| 6.6 | JSON corrupto en `localStorage` | La app abre y resiembra |
| 6.7 | `null` en una lista de `localStorage` | **Defecto abierto**, ver más abajo |
| 6.8 | Reiniciar la demo | Restaura el inventario original |
| 6.9 | Reiniciar la demo | **No** borra la autorización de habeas data |
| 6.10 | Almacenamiento vacío | Vuelve a sembrar sola |
| 6.11 | Barra inferior en móvil | Navega toda la tienda |
| 6.12 | Panel admin en móvil | Tarjetas en vez de tabla |
| 6.13 | Filtros en móvil | Se abren en un panel |
| 6.14 | Desbordamiento horizontal | Ninguna pantalla desborda |
| 6.15 | Pantallas públicas | Sin errores en consola |
| 6.16 | Encabezados | Toda pantalla tiene encabezado principal |

---

## Hallazgos abiertos

### H-1 · `null` en una lista de `localStorage` deja la app en blanco · **alto**

`load()` en `src/lib/storage.ts` solo cae al valor por defecto si la clave no
existe o el JSON no se puede parsear. Si el valor guardado es el literal
`null` —válido para `user`, no para las listas—, lo devuelve tal cual:

```js
localStorage.setItem('reverde.v1.cart', 'null');
// → load('cart', []) devuelve null
// → cartCount: cart.reduce(...) lanza
//   TypeError: Cannot read properties of null (reading 'reduce')
```

Resultado: pantalla en blanco, sin forma de recuperarse salvo limpiar el
almacenamiento a mano. Cubierto por el caso 6.7, marcado `test.fail()`: cuando
se corrija, la prueba empezará a pasar y Playwright avisará para quitar la
anotación.

Arreglo sugerido, en `load`:

```ts
const parsed = JSON.parse(raw) as T;
return parsed === null && fallback !== null ? fallback : parsed;
```

### H-2 · Los campos de texto no tienen etiqueta asociada · **medio** (accesibilidad)

`Field` (`src/components/ui/Field.tsx`) renderiza `<label>` sin `htmlFor` y el
input como hermano, no anidado. Un lector de pantalla anuncia los campos de
login, búsqueda y del formulario de producto sin nombre, y `getByLabel` no los
encuentra —por eso las pruebas los localizan por placeholder, lo que es más
frágil—. `Checkbox`, en cambio, sí asocia correctamente con `htmlFor` + `id`.

Arreglo: generar un `useId()` en `Field`, pasarlo como `htmlFor` y propagarlo al
hijo (o envolver el input dentro del `<label>`).

### H-3 · Ordenar el marketplace recalcula el riesgo dentro del comparador · **bajo** (rendimiento)

En `useMarketplaceProducts`, los órdenes «relevancia» y «vencimiento» llaman a
`computeRisk` dentro de la función de comparación: con 10.000 publicaciones son
~265.000 llamadas y 150 ms por ordenamiento (medido en
`tests/load/engine-load.test.ts`). Con el catálogo de la demo es irrelevante;
si el inventario crece, conviene calcular el riesgo una vez y ordenar por el
valor ya calculado.

### H-4 · Las ventas semilla de hoy pueden quedar con hora futura · **bajo** (cosmético)

`buildSeedSales` reparte las ventas del día en horario comercial (9:00–19:00),
así que al abrir la demo por la mañana el historial muestra ventas con hora
posterior a la actual. No afecta a ninguna métrica. El caso está documentado en
`tests/unit/seed-data.test.ts`, que sí exige que ninguna venta quede fechada
después de hoy.

### H-5 · `applyRecommendation` deja código inalcanzable en el checkout · **informativo**

`Checkout` deshabilita el botón de pago mientras falte la casilla de
autorización, así que la rama `if (!dataOk) { setDataError(true); return; }` y
el mensaje `dataError` ya no se pueden alcanzar desde la interfaz. No es un
error —es defensa en profundidad—, pero conviene saberlo antes de refactorizar.

---

## Lista de verificación manual (sustentación)

Lo que conviene mirar con ojos propios antes de presentar. 15 minutos.

**Preparación**

- [ ] `npm run build && npm run preview` sobre el build de producción
- [ ] Perfil → «Reiniciar datos de la demo» para partir del estado conocido
- [ ] Probar en el equipo y el proyector reales (resolución y contraste)

**Credibilidad de las cifras** — ninguna aserción juzga esto bien

- [ ] Los KPIs de inicio dan cifras plausibles para un supermercado de barrio
- [ ] La comparativa mensual no muestra saltos absurdos (+900 %)
- [ ] Las gráficas de 8 semanas tienen forma creíble, sin huecos ni picos raros
- [ ] Las equivalencias de impacto (CO₂, agua) se entienden sin explicación
- [ ] El yogur natural aparece en alto riesgo, como dice el guion del README

**Narrativa de la IA**

- [ ] La recomendación de la alerta principal suena razonable, no automática
- [ ] «¿Por qué recomendamos esto?» se lee de corrido y convence
- [ ] El texto del aprendizaje cita un histórico coherente con la categoría
- [ ] Al aplicar el descuento, el riesgo baja de forma visible

**Recorrido del cliente**

- [ ] Las fotos de los productos cargan (si no, se ve el gradiente de respaldo)
- [ ] El ahorro del carrito coincide con la suma de las tarjetas
- [ ] El código de compra es legible de lejos
- [ ] La venta aparece de inmediato en el panel del establecimiento

**Presentación**

- [ ] En proyector, los textos de 11–12 px se leen desde el fondo del salón
- [ ] Las transiciones no distraen ni se sienten lentas
- [ ] Funciona sin internet (no hay servicios externos)
- [ ] Hay un teléfono listo para mostrar la vista móvil

**Cierre**

- [ ] Reiniciar la demo al terminar, para dejarla lista para la siguiente
