# Buyer personas

Reverde es un mercado de dos lados: hay un **cliente que paga/adopta** (el
establecimiento) y un **usuario que genera la demanda** (la persona compradora).
Las dos personas son necesarias; si falta una, el producto no funciona.

> **Estado de la investigación:** estas personas están construidas a partir de
> las decisiones ya tomadas en el producto (roles del modelo de datos, flujos
> implementados, datos de los establecimientos de demostración en
> `src/data/establishments.ts` — todos en Bogotá: Chapinero, Suba, Usaquén).
> **No provienen de entrevistas.** Los campos demográficos marcados `TODO:`
> requieren investigación de campo antes de usarse para tomar decisiones de
> producto o de inversión.

---

## Persona 1 · «Laura», administradora de supermercado de barrio

**Rol en el sistema:** `supermercado` (decisora y usuaria a la vez)
**Es el cliente que paga.** Sin ella no hay oferta.

### Perfil demográfico

| | |
|---|---|
| Edad | `TODO:` validar rango (hipótesis: 30–50) |
| Ubicación | Bogotá — zonas con supermercados de barrio y tiendas de cadena pequeña |
| Cargo | Administradora o jefa de punto de venta |
| Educación | `TODO:` validar (hipótesis: técnica o profesional en áreas administrativas) |
| Tamaño del negocio | `TODO:` definir el segmento objetivo: ¿1 punto, 2–5 puntos, o cadena? |
| Ingreso / presupuesto de software | `TODO:` crítico para fijar el precio; hoy no hay modelo de negocio definido |

### Perfil técnico

| | |
|---|---|
| Dispositivo principal | Computador de escritorio en la oficina del punto, navegador Chrome |
| Dispositivo secundario | Teléfono Android en el piso de venta — **por eso el panel de administración conserva todas sus funciones en móvil** (tarjetas en vez de tablas, filtros en modal) |
| Competencia digital | Media. Usa Excel y el POS del negocio con soltura; no programa ni consulta APIs |
| Sistemas que ya usa | POS / software de inventario propio, WhatsApp con proveedores, Excel |
| Tolerancia a la fricción | **Baja.** Si registrar un producto toma más de un minuto, no lo hace |
| Conectividad | Estable en la oficina, intermitente en bodega |

### Un día relevante

Llega a las 7:00, revisa qué llegó del proveedor, y en algún momento de la mañana
recorre las góndolas buscando producto cerca de vencer. Ese recorrido es
**memoria y ojo**, no sistema. Lo que encuentra tarde, lo marca como merma al
cierre del mes y nadie vuelve a mirarlo.

### Qué quiere lograr (jobs to be done)

1. Que la merma del mes baje sin tener que vigilar cada producto.
2. Saber **hoy** qué tres productos atender, no tener otro informe que leer.
3. Descontar lo mínimo necesario para vender: no regalar margen.
4. Poder mostrarle a la dirección una cifra de lo que recuperó.

### Frustraciones

- «Me doy cuenta cuando ya no se puede vender.»
- «Si descuento al 50 % pierdo plata, y si descuento al 10 % no se mueve.»
- «No voy a cargar un inventario entero a mano en otro sistema.» ← **riesgo de
  adopción número uno del MVP**
- «Lo que me recomienda el sistema no sé de dónde sale.»

### Qué la convence

- Ver el Risk Score aplicado **a sus propios productos** en la primera sesión.
- La explicación de cada recomendación (los cuatro factores con su peso).
- Que publicar en el marketplace sea **un clic desde la alerta**, no un flujo aparte.
- Que el histórico de promociones le diga qué descuento funcionó antes en su categoría.

### Objeciones esperadas

| Objeción | Respuesta que el producto ya soporta |
|---|---|
| «¿Y mis datos?» | Política de tratamiento y autorización explícita (Ley 1581 de 2012); datos sensibles cifrados con AES-256-GCM |
| «¿Vender barato no me canibaliza el precio normal?» | El marketplace es un canal separado (`SalesChannel.marketplace`) y solo recibe producto en riesgo |
| «¿Tengo que capacitar a mi equipo?» | Roles de membresía `owner` / `manager` / `staff` con permisos distintos |
| «¿Cuánto cuesta?» | `TODO:` **sin respuesta**: no hay modelo de negocio definido |

---

## Persona 2 · «Camilo», chef-propietario de restaurante

**Rol en el sistema:** `restaurante`
Variante de Laura, con diferencias que sí cambian el producto:

- Su inventario es **insumo y preparado**, no producto empacado: la unidad de
  medida importa (`Unit`: kg, g, litro, bandeja, caja, unidad).
- Su salida natural son las **cajas de rescate** (`isRescueBox`), no el producto
  individual.
- Decide él mismo: **no hay comité de compras**, el ciclo de venta es corto.
- Está en cocina, no en oficina: el móvil es su dispositivo **principal**.
- Horizonte de caducidad mucho más corto (horas, no días), lo que empuja el
  Risk Score a niveles altos más rápido.

`TODO:` validar si restaurantes y supermercados deben ser el mismo producto o
dos experiencias distintas. Hoy comparten pantallas y permisos.

---

## Persona 3 · «Sofía», compradora consciente del precio

**Rol en el sistema:** `cliente`
**No paga suscripción: genera la demanda.** Sin ella, el establecimiento no
recupera valor y abandona la plataforma.

### Perfil demográfico

| | |
|---|---|
| Edad | `TODO:` validar (hipótesis: 22–40) |
| Ubicación | Bogotá, a pocos km de los establecimientos — el catálogo muestra `distanceKm` |
| Ocupación | `TODO:` validar |
| Motivación declarada | Doble: **ahorro** y **impacto ambiental**, en ese orden según el diseño de la app (el precio y el ahorro son lo más prominente en `ProductCard`) |
| Sensibilidad al precio | Alta — es la razón de entrada |

### Perfil técnico

| | |
|---|---|
| Dispositivo | **Teléfono, casi exclusivamente.** De ahí la navegación inferior, los botones grandes y los filtros en *bottom sheet* |
| Competencia digital | Alta. Compra en apps, paga con PSE/Nequi/tarjeta sin ayuda |
| Expectativa de velocidad | Explorar → comprar en menos de 2 minutos |
| Método de pago | Tarjeta, PSE, Nequi, Bancolombia o **pago en el local** (`PaymentMethod`) |
| Conectividad | Datos móviles; tolera poco peso de página |

### Qué quiere lograr

1. Comida buena más barata, hoy, cerca de donde está.
2. Saber **qué tan cerca** está el establecimiento y **hasta cuándo** puede recoger.
3. Confiar en que el producto está en buen estado aunque esté por vencer.
4. Sentir que su compra evitó un desperdicio concreto (los kg que la app le muestra).

### Frustraciones

- «No sé qué hay disponible hasta que llego.»
- «¿Está vencido o por vencer? No es lo mismo.» ← **el producto muestra siempre
  la fecha de vencimiento explícita, nunca solo el descuento**
- «Reservé y cuando llegué ya no estaba.» ← lo mitiga la reserva de stock con
  `reservedQuantity` y expiración (`expiresAt` en `Order`)
- «Me tocó pagar en una pasarela rara.»

### Qué la convence

- El ahorro en pesos, visible antes de entrar al detalle.
- La ventana de recogida y la distancia.
- Poder **reservar y pagar en el local** sin dar datos de tarjeta.
- El contador de impacto de sus propias compras.

---

## Anti-persona: para quién NO es Reverde

Dejarlo explícito evita diluir el MVP:

- **Cadenas grandes con ERP corporativo** que exigen integración vía API con su
  sistema de inventario: no hay integración de inventario en el MVP.
- **Quien busca donación/gratuidad.** Reverde es un canal de venta con descuento;
  la donación se registra pero no se gestiona.
- **Restaurantes de alta cocina** sin excedente estandarizable.
- **Compradores que quieren domicilio.** No hay logística: la recogida es presencial.

---

## Preguntas abiertas para validación

1. `TODO:` ¿Cuál es el segmento inicial exacto de establecimiento (1 punto vs. cadena pequeña)? Define el precio y el esfuerzo de onboarding.
2. `TODO:` ¿Quién carga el inventario el primer día? Es la mayor fricción de adopción y hoy no hay importación masiva ni integración con POS.
3. `TODO:` ¿La compradora entra por ahorro o por sostenibilidad? Cambia por completo el mensaje de la landing y de la UVP.
4. `TODO:` ¿Cuántos establecimientos activos se necesitan en una zona para que el catálogo valga la pena para la compradora? (problema del arranque en frío del lado de la oferta)
