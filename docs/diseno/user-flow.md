# User flow · navegación de Reverde

Diagramas de la navegación **tal como está implementada** en
`src/App.tsx` y `src/lib/routes.ts`. Si una ruta cambia en el código, este
documento cambia con ella.

## 1 · Mapa completo de navegación

```mermaid
flowchart TD
    START((Entrada)) --> LAND["/ · Landing"]

    LAND --> GATE{¿Autorizó el<br/>tratamiento de datos?}
    LAND --> LEGAL["/legal · /legal/:slug<br/>Centro legal"]
    LEGAL -.->|siempre accesible<br/>sin autorizar| LAND

    GATE -->|no| CONSENT[ConsentGate<br/>diálogo modal bloqueante]
    CONSENT -->|No autorizo| OUT[Mensaje de salida<br/>+ reconsiderar]
    OUT --> CONSENT
    CONSENT -->|Autorizo las 2<br/>obligatorias| LOGIN
    GATE -->|sí| LOGIN["/login"]

    LOGIN --> ROLE{Rol de la sesión}
    LOGIN -->|sin sesión| SHOP

    ROLE -->|supermercado<br/>restaurante| ADMIN
    ROLE -->|cliente| SHOP
    ROLE -->|superadmin| SUPER

    subgraph ADMIN["Establecimiento · /app/* (sidebar en web, nav inferior en móvil)"]
        A1["/app/inicio<br/>KPIs e impacto"]
        A2["/app/inventario<br/>tabla web · tarjetas móvil"]
        A3["/app/alertas<br/>priorizadas por riesgo"]
        A4["/app/alertas/:productId<br/>explicabilidad + acciones"]
        A5["/app/marketplace<br/>publicaciones propias"]
        A6["/app/ventas<br/>histórico"]
        A7["/app/impacto<br/>CO₂, agua, COP"]
        A1 --> A2 --> A3 --> A4
        A4 -->|Aplicar descuento| A2
        A4 -->|Publicar| A5
        A1 --> A7
        A1 --> A6
    end

    subgraph SHOP["Cliente · /tienda/* (navegación inferior, móvil primero)"]
        C1["/tienda<br/>Inicio"]
        C2["/tienda/explorar<br/>catálogo + filtros"]
        C3["/tienda/producto/:id<br/>detalle"]
        C4["/tienda/mapa<br/>establecimientos"]
        C5["/tienda/carrito<br/>ahorro e impacto"]
        C6["/tienda/checkout<br/>método de pago"]
        C7["/tienda/confirmacion/:orderId<br/>código RV-XXXXX"]
        C8["/tienda/perfil"]
        C1 --> C2 --> C3 --> C5 --> C6 --> C7
        C1 --> C4 --> C3
        C3 -->|Comprar ahora| C6
        C7 --> C2
        C1 --> C8
    end

    subgraph SUPER["Superadmin · /admin/*"]
        S1["/admin/inicio<br/>resumen global"]
        S2["/admin/establecimientos"]
        S3["/admin/establecimientos/:id"]
        S4["/admin/publicaciones"]
        S5["/admin/actividad"]
        S1 --> S2 --> S3
        S1 --> S4
        S1 --> S5
    end

    A5 -.->|el producto publicado<br/>aparece en el catálogo| C2
    C7 -.->|la venta vuelve al<br/>inventario y al impacto| A6
    A5 -.-> S4
```

## 2 · Guardas de acceso

Implementadas en `RequireRole` (`src/App.tsx`) y en `ConsentBoundary`.

```mermaid
flowchart LR
    REQ[Petición de ruta] --> PUB{¿Ruta pública?<br/>/ · /legal/*}
    PUB -->|sí| RENDER[Renderiza]
    PUB -->|no| CONS{¿Hay consentimiento?}
    CONS -->|no| MODAL[ConsentGate bloquea]
    CONS -->|sí| SESS{¿Hay sesión?}
    SESS -->|no| L["Redirige a /login"]
    SESS -->|sí| PERM{¿El rol está<br/>autorizado en la ruta?}
    PERM -->|no| HOME["Redirige a homeForRole(rol)"]
    PERM -->|sí| RENDER
```

| Desde | Rol | Resultado |
|---|---|---|
| `/app/*` | sin sesión | → `/login` |
| `/app/*` | `cliente` | → `/tienda` |
| `/app/*` | `superadmin` | → `/admin/inicio` |
| `/admin/*` | `supermercado` · `restaurante` | → `/app/inicio` |
| `/tienda/*` | cualquiera, incluso sin sesión | accesible (el catálogo es público) |
| ruta inexistente | cualquiera | → `/` |

## 3 · Flujo del administrador: de la alerta a la venta

Es el recorrido que demuestra la propuesta de valor completa.

```mermaid
sequenceDiagram
    actor Admin as Administradora
    participant INV as Inventario
    participant AI as Motor de riesgo
    participant ALE as Alertas
    participant MKT as Marketplace
    actor Cli as Compradora

    Admin->>INV: Revisa el inventario
    INV->>AI: Calcula el Risk Score de cada producto
    AI-->>ALE: Productos en riesgo medio y alto
    Admin->>ALE: Abre la alerta de mayor riesgo
    ALE->>AI: Pide la explicación
    AI-->>Admin: 4 factores con su peso + fórmula
    AI-->>Admin: Descuento sugerido y confianza
    Note over AI: El histórico de PromoOutcome<br/>ajusta la sugerencia por categoría
    Admin->>INV: Aplica el descuento
    Admin->>MKT: Publica en el marketplace
    MKT-->>Cli: Aparece en el catálogo
    Cli->>MKT: Compra o reserva
    MKT->>INV: Descuenta stock (o lo reserva)
    MKT->>AI: Registra el resultado de la promoción
    MKT-->>Admin: Venta visible + impacto actualizado
```

## 4 · Flujo de compra y pago

El estado del pago y el estado logístico son **independientes**
(`OrderStatus` y `FulfillmentStatus` en el esquema).

```mermaid
stateDiagram-v2
    [*] --> Explorando
    Explorando --> Carrito: Agregar al carrito
    Explorando --> Checkout: Comprar ahora
    Carrito --> Carrito: Ajustar cantidad<br/>(topada por el stock)
    Carrito --> Explorando: Vaciar el carrito
    Carrito --> Checkout: Continuar

    Checkout --> Consentimiento: Autorización del pedido<br/>(casilla obligatoria)
    Consentimiento --> Checkout: Sin marcar → botón deshabilitado

    Checkout --> PENDING_PAYMENT: Crear orden<br/>(reserva el stock)
    PENDING_PAYMENT --> PAID: Webhook APPROVED
    PENDING_PAYMENT --> FAILED: Webhook DECLINED/ERROR
    PENDING_PAYMENT --> EXPIRED: No se pagó antes de expiresAt<br/>(scheduler libera el stock)
    PENDING_PAYMENT --> CANCELLED: La persona cancela

    PAID --> Confirmacion: Código RV-XXXXX
    Confirmacion --> [*]

    note right of PENDING_PAYMENT
        Pago en el local: la reserva
        queda confirmada y se cobra
        al recoger.
    end note
```

## 5 · Alta de un establecimiento

Implementado en la API (`/api/establishments/requests` y
`/api/admin/requests/:id/{approve,reject}`). **Todavía sin pantallas en la SPA**
— ver Should-have S3 en [`mvp-moscow.md`](../estrategia/mvp-moscow.md).

```mermaid
flowchart LR
    R[Registro como cliente] --> SOL[Solicitud de cuenta<br/>de establecimiento]
    SOL --> PEND[(EstablishmentRequest<br/>pendiente)]
    PEND --> REV{Revisión del<br/>superadmin}
    REV -->|aprueba| CREA[Crea el establecimiento<br/>+ membresía owner<br/>+ cambia el rol]
    REV -->|rechaza| RECH[Rechazada con nota]
    CREA --> ADMIN[Acceso a /app/*]
    RECH --> R

    style PEND fill:#FDF3E1,stroke:#A9761A
```

> **El rol nunca se autoasigna.** Quien se registra siempre entra como `cliente`;
> convertirse en establecimiento exige aprobación. Es una decisión de seguridad
> deliberada (ver [`seguridad.md`](../arquitectura/seguridad.md)).

## 6 · Ejercicio de los derechos del titular (Habeas Data)

```mermaid
flowchart TD
    P["/tienda/perfil"] --> DR[DataRightsCard]
    DR --> CONS[Consultar<br/>qué datos tenemos]
    DR --> UPD[Actualizar<br/>nombre y contacto]
    DR --> DEL[Eliminar la cuenta]
    DR --> REV[Revocar la autorización]
    DEL --> CONF{Confirmación}
    CONF -->|sí| ANON["DELETE /api/users/me<br/>baja lógica + anonimización"]
    ANON --> OUT[Sesión cerrada]
    DR --> CANAL["Canales del artículo 17<br/>Ley 1581 de 2012"]
```

## Puntos de fricción conocidos del flujo

| # | Fricción | Dónde | Estado |
|---|---|---|---|
| F1 | El inventario inicial se digita producto por producto | `/app/inventario` | Could-have C1 (importación CSV) |
| F2 | No hay pantalla para solicitar cuenta de establecimiento | falta en `/login` | Should-have S3 |
| F3 | El cliente no recibe aviso cuando se publica algo cerca | — | Could-have C3 |
| F4 | `TODO:` validar si el gate de consentimiento antes de `/login` reduce el registro | `ConsentBoundary` | Por medir |
