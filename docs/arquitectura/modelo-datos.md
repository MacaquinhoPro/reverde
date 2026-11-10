# Modelo de datos (DER)

- **Motor:** **PostgreSQL 16** (`provider = "postgresql"` en `server/prisma/schema.prisma`).
  En desarrollo corre en Docker (`docker compose up -d db`, puerto **5433**); las
  pruebas usan una base aparte en `tmpfs` (puerto **5434**).
- **ORM y migraciones:** Prisma 6.19. El esquema es la fuente de verdad y las
  migraciones están versionadas en `server/prisma/migrations/`.
- **Tamaño:** **27 modelos** y **22 enumeraciones**.
- `TODO:` definir el proveedor de base de datos gestionada para producción
  (Neon, Supabase, RDS, Railway…). Hoy solo existe la de desarrollo.

## Convenciones

| Convención | Regla |
|---|---|
| Identificadores | `uuid` generado por la base (`@default(uuid())`) |
| Dinero | **Enteros en COP.** El peso colombiano no usa decimales. A la pasarela va en centavos (`amountInCents`) |
| Multi-tenant | Toda entidad de negocio lleva `establishmentId` indexado |
| Borrado | **Lógico** donde hay histórico que preservar (`deletedAt` en `User` y `Product`) |
| Datos personales recuperables | Cifrados con **AES-256-GCM** (`phoneEncrypted`, `documentEncrypted`, `contactPhoneEnc`) |
| Contraseñas | **Argon2id**, nunca cifrado reversible |
| Tokens (sesión, verificación) | Se guarda el **hash SHA-256**; el valor en claro solo vive en la cookie o en el correo |
| IP | Se guarda `ipHash` con sal (`IP_HASH_SALT`), nunca la IP en claro |
| Fechas | `DateTime` en UTC; la presentación usa `America/Bogota` |
| Payloads de terceros | Columnas `Json` (`providerSnapshot`, `payload`, `metadata`, `actions`) |

---

## 1 · Identidad, roles y sesiones

```mermaid
erDiagram
    Role ||--o{ RolePermission : "otorga"
    Permission ||--o{ RolePermission : "pertenece a"
    User ||--o{ Session : "abre"
    User ||--o{ VerificationToken : "recibe"
    User ||--o{ EstablishmentUser : "es miembro de"
    User ||--o{ AuditLog : "genera"

    Role {
        UserRole code PK "supermercado|restaurante|cliente|superadmin"
        String name
        String description
    }
    Permission {
        String code PK "ej. products:write"
        String description
    }
    RolePermission {
        UserRole roleCode PK, FK
        String permissionCode PK, FK
    }
    User {
        String id PK
        String email UK
        String name
        String passwordHash "Argon2id"
        UserRole role "default cliente"
        UserStatus status "activo|pendiente|suspendido"
        DateTime emailVerifiedAt "opcional"
        String phoneEncrypted "opcional · AES-256-GCM"
        String documentEncrypted "opcional · AES-256-GCM"
        Boolean isDemo
        Int failedLogins "bloqueo por fuerza bruta"
        DateTime lockedUntil "opcional"
        DateTime lastLoginAt "opcional"
        DateTime deletedAt "opcional · baja lógica"
    }
    Session {
        String id PK
        String userId FK
        String tokenHash UK "SHA-256 del token opaco"
        DateTime expiresAt
        DateTime revokedAt "opcional"
        String ipHash "opcional"
        String userAgent "opcional"
    }
    VerificationToken {
        String id PK
        String userId FK
        TokenPurpose purpose "email_verification|password_reset"
        String tokenHash UK
        DateTime expiresAt
        DateTime usedAt "opcional · un solo uso"
    }
    LoginAttempt {
        String id PK
        String email
        String ipHash
        Boolean success
        DateTime createdAt
    }
```

`LoginAttempt` no tiene relación con `User` a propósito: registra también los
intentos con correos que no existen, sin revelar si la cuenta existe.

---

## 2 · Establecimientos

```mermaid
erDiagram
    Establishment ||--o{ EstablishmentUser : "tiene miembros"
    User ||--o{ EstablishmentUser : "pertenece a"
    Establishment |o--o| EstablishmentRequest : "nace de"
    User ||--o{ EstablishmentRequest : "solicita"
    User ||--o{ EstablishmentRequest : "revisa"

    Establishment {
        String id PK
        String slug UK
        String name
        EstablishmentType type "supermercado|restaurante"
        String address
        String city
        String schedule
        Float rating
        Float latitude "opcional · coordenada real"
        Float longitude "opcional"
        Float mapX "posición en el mapa simulado"
        Float mapY
        Float distanceKm
        EstablishmentStatus status "default pendiente"
        DateTime joinedAt
    }
    EstablishmentUser {
        String id PK
        String establishmentId FK
        String userId FK
        MembershipRole role "owner|manager|staff"
    }
    EstablishmentRequest {
        String id PK
        String userId FK
        String establishmentName
        EstablishmentType type
        String address
        String city
        String contactPhoneEnc "opcional · AES-256-GCM"
        RequestStatus status "pendiente|aprobada|rechazada"
        String notes "opcional"
        String reviewedById FK "opcional"
        DateTime reviewedAt "opcional"
        String establishmentId FK, UK "opcional"
    }
```

> **El rol nunca se autoasigna.** Quien se registra entra como `cliente`; para
> operar un establecimiento hace falta una `EstablishmentRequest` aprobada por un
> superadministrador, que crea el establecimiento, la membresía `owner` y cambia
> el rol en una sola transacción.

---

## 3 · Productos, inventario e inteligencia

```mermaid
erDiagram
    Establishment ||--o{ Product : "publica"
    Product ||--|| Inventory : "tiene stock"
    Product ||--o{ InventoryMovement : "registra"
    Inventory ||--o{ InventoryMovement : "afecta"
    Product |o--o| ExpirationAlert : "genera"
    Product |o--o| Recommendation : "recibe"
    Product |o--o| MarketplaceListing : "se publica como"
    User ||--o{ Product : "crea"
    User ||--o{ InventoryMovement : "ejecuta"

    Product {
        String id PK
        String establishmentId FK
        String name
        String description
        String category
        String emoji
        String image "gradiente de respaldo"
        String photo "opcional"
        Unit unit "unidad|kg|g|litro|bandeja|caja"
        Float weightPerUnitKg
        DateTime entryDate
        DateTime expiryDate "entra al Risk Score"
        Int originalPrice "COP entero"
        Int discountPercent
        ProductStatus status "en_inventario|publicado|agotado|vencido|donado"
        Float dailySales "rotación histórica"
        Float demandTrend "variación reciente"
        Boolean isRescueBox
        ProductOrigin origin "seed|user"
        DateTime deletedAt "opcional"
    }
    Inventory {
        String id PK
        String productId FK, UK
        Int quantity "stock físico"
        Int reservedQuantity "comprometido en órdenes sin pagar"
    }
    InventoryMovement {
        String id PK
        String inventoryId FK
        String productId FK
        String establishmentId FK
        MovementType type "ingreso|ajuste|reserva|liberacion|venta|donacion|merma"
        Int quantity "positivo entra, negativo sale"
        String reason "opcional"
        String orderId FK "opcional"
        String userId FK "opcional"
    }
    ExpirationAlert {
        String id PK
        String productId FK, UK
        String establishmentId FK
        RiskLevel level "bajo|medio|alto"
        Int riskScore "0-100"
        Int wasteProbability
        String title
        String body
        AlertStatus status "abierta|silenciada|resuelta"
        DateTime snoozedUntil "opcional"
    }
    Recommendation {
        String id PK
        String productId FK, UK
        String establishmentId FK
        String title
        String rationale "explicabilidad"
        String learningNote "opcional · aprendido del histórico"
        Int suggestedDiscount
        Int confidence
        Int riskScore
        Json actions "acciones sugeridas"
        String appliedAction "opcional"
        DateTime appliedAt "opcional"
        String appliedById FK "opcional"
    }
    MarketplaceListing {
        String id PK
        String productId FK, UK
        String establishmentId FK
        ListingStatus status "activa|pausada|agotada"
        Boolean featured
        DateTime publishedAt
        DateTime unpublishedAt "opcional"
    }
```

**Por qué `Inventory` está separado de `Product`:** el stock es la fila que más
cambia y la que hay que bloquear en las compras simultáneas. Separarla permite
tomar el bloqueo sobre una sola fila estrecha sin congelar el producto completo.
Es lo que verifica `server/src/tests/concurrency.test.ts`.

---

## 4 · Carrito, órdenes y pagos

```mermaid
erDiagram
    User ||--|| Cart : "tiene"
    Cart ||--o{ CartItem : "contiene"
    Product ||--o{ CartItem : "está en"
    User ||--o{ Order : "realiza"
    Order ||--o{ OrderItem : "contiene"
    Product |o--o{ OrderItem : "copiado en"
    Establishment ||--o{ OrderItem : "despacha"
    Order ||--o{ Payment : "se cobra con"
    Payment ||--o{ PaymentEvent : "recibe"
    Order ||--o{ InventoryMovement : "mueve"

    Cart {
        String id PK
        String userId FK, UK
        CartStatus status "activo|convertido|abandonado"
    }
    CartItem {
        String id PK
        String cartId FK
        String productId FK
        Int quantity
    }
    Order {
        String id PK
        String code UK "RV-XXXXX"
        String userId FK
        OrderMode mode "compra|reserva"
        PaymentMethod paymentMethod "tarjeta|pse|nequi|bancolombia|establecimiento"
        OrderStatus status "PENDING_PAYMENT|PAID|FAILED|CANCELLED|EXPIRED|REFUNDED"
        FulfillmentStatus fulfillmentStatus "reservado|confirmado|entregado|anulado"
        Int subtotalCop "calculado en el servidor"
        Int totalCop
        Int savingsCop
        Float wasteAvoidedKg
        String pickupWindow
        DateTime expiresAt "opcional · libera la reserva si no se paga"
        DateTime paidAt "opcional"
        String idempotencyKey UK "opcional"
        String consentVersion "opcional · Ley 1581 de 2012"
        DateTime consentAcceptedAt "opcional"
        String consentPurpose "opcional"
    }
    OrderItem {
        String id PK
        String orderId FK
        String productId FK "opcional · SetNull: el histórico sobrevive"
        String establishmentId FK
        String name "copia inmutable"
        Int quantity
        Int unitOriginalPrice
        Int unitPrice
        Float weightKg
        String category
        Int discountPercent
    }
    Payment {
        String id PK
        String orderId FK
        PaymentProvider provider "wompi|mercadopago|mock|efectivo"
        String reference UK "entra en la firma de integridad"
        Int amountInCents
        String currency "COP"
        PaymentStatus status "PENDING|APPROVED|DECLINED|VOIDED|ERROR|EXPIRED|REFUNDED"
        String providerTransactionId UK "opcional"
        String checkoutUrl "opcional"
        String idempotencyKey UK "una intención viva por orden"
        DateTime expiresAt "opcional"
        Json providerSnapshot "opcional · sin datos de tarjeta"
    }
    PaymentEvent {
        String id PK
        String paymentId FK "opcional"
        PaymentProvider provider
        String eventId UK "el webhook reenviado no se reprocesa"
        String eventType
        String transactionId "opcional"
        String reportedStatus "opcional"
        Boolean signatureValid
        Json payload
        DateTime processedAt "opcional"
        String result "opcional"
    }
```

### Dos estados independientes, a propósito

`OrderStatus` es el **ciclo del dinero** (fuente de verdad del cobro) y
`FulfillmentStatus` el **ciclo logístico** (lo que ve la persona). Una reserva
pagada en el local está `PENDING_PAYMENT` + `reservado`; al recoger y pagar pasa a
`PAID` + `entregado`. Mezclarlos en un solo campo obligaría a inventar estados
como «reservado-pendiente-de-pago-pero-confirmado».

### Tres barreras contra el doble cobro

| Barrera | Restricción | Qué evita |
|---|---|---|
| Orden duplicada | `Order.idempotencyKey` único | Doble clic en «Pagar» |
| Intención de pago duplicada | `Payment.idempotencyKey` único | Dos checkouts vivos para la misma orden |
| Webhook reenviado | `PaymentEvent.eventId` único | Mover inventario o confirmar dos veces |

Además `IdempotencyRecord` guarda la respuesta completa por clave, así que el
reintento del cliente recibe **la misma respuesta** y no un conflicto.

---

## 5 · Ventas, aprendizaje y operación

```mermaid
erDiagram
    Establishment ||--o{ Sale : "registra"
    Order |o--o{ Sale : "origina"
    OrderItem |o--o| Sale : "detalla"
    Product |o--o{ Sale : "vendido en"
    Establishment ||--o{ PromoOutcome : "aprende de"
    User ||--o{ Notification : "recibe"
    Establishment ||--o{ Notification : "recibe"
    User ||--o{ AuditLog : "actor de"

    Sale {
        String id PK
        String establishmentId FK
        String productId FK "opcional"
        String orderId FK "opcional"
        String orderItemId FK "opcional"
        String productName "copia"
        String category
        String customerName
        Int quantity
        Int originalPrice
        Int soldPrice
        Int discountPercent
        Int recovered "COP recuperados"
        Float wasteAvoidedKg
        SalesChannel channel "marketplace|tienda"
        DateTime occurredAt
        Boolean isSeed
    }
    PromoOutcome {
        String id PK
        String establishmentId FK
        String category
        Int discountPercent
        Int sellThrough "porcentaje vendido"
        Int daysToSell
        DateTime occurredAt
        Boolean isSeed
    }
    Notification {
        String id PK
        String userId FK "opcional"
        String establishmentId FK "opcional"
        String type
        String title
        String body
        Json data "opcional"
        DateTime readAt "opcional"
    }
    AuditLog {
        String id PK
        String actorUserId FK "opcional"
        String actorRole "opcional"
        String action
        String entity
        String entityId "opcional"
        String establishmentId "opcional"
        String ipHash "opcional"
        Json metadata "opcional"
    }
    IdempotencyRecord {
        String id PK
        String key UK
        String scope
        String userId "opcional"
        String requestHash
        Int responseStatus "opcional"
        Json responseBody "opcional"
        DateTime expiresAt
    }
```

**`PromoOutcome` es la memoria del motor de recomendaciones.** Cada venta de un
producto con descuento deja un registro (categoría, descuento, % de inventario
vendido, días hasta agotarse) y `learnFromHistory()` busca ahí el descuento con
mejor relación entre venta y margen para esa categoría. Por eso las
recomendaciones cambian a medida que se usa el sistema.

**`isSeed`** separa los datos de demostración de los reales: permite reiniciar la
demo sin borrar lo que generó una persona.

---

## 6 · El ciclo del dato, de punta a punta

```mermaid
flowchart LR
    P[Product + Inventory] -->|expiryDate, quantity<br/>dailySales, demandTrend| R{domain/risk.ts}
    R -->|riskScore, level| EA[ExpirationAlert]
    R -->|descuento sugerido<br/>+ rationale| RC[Recommendation]
    PO[(PromoOutcome)] -->|learnFromHistory| RC
    RC -->|aplicar| P
    RC -->|publicar| ML[MarketplaceListing]
    ML --> CI[CartItem] --> O[Order + OrderItem]
    O --> PAY[Payment] -->|webhook firmado| PE[PaymentEvent]
    PE -->|APPROVED| TX{{Transacción}}
    TX --> IM[InventoryMovement venta]
    TX --> S[Sale]
    TX --> PO
    IM --> P
    S --> DASH[Dashboard e impacto]
```

Todo lo que ocurre tras un pago aprobado pasa en **una sola transacción**:
descontar stock, registrar el movimiento, escribir la venta y guardar el
resultado de la promoción. O todo, o nada.

---

## Migraciones

| Migración | Qué trae |
|---|---|
| `20261103184359_init_reverde` | Esquema completo inicial (812 líneas de SQL) |
| `20261103213844_order_consent` | `consentVersion`, `consentAcceptedAt` y `consentPurpose` en `Order` — prueba de la autorización de tratamiento de datos |

```bash
npm run db:migrate   # crea y aplica una migración en desarrollo
npm run db:deploy    # aplica las pendientes (producción, idempotente)
npm run db:reset     # borra y vuelve a sembrar (solo desarrollo)
npm run db:studio    # explorador visual de Prisma
```

## Pendientes del modelo

| # | Pendiente | Por qué importa |
|---|---|---|
| D1 | `TODO:` proveedor de base de datos gestionada para producción | Sin esto no hay despliegue de la API |
| D2 | Índice para búsqueda de texto en `Product.name` | Hoy el marketplace filtra con `contains`; con catálogos grandes conviene `pg_trgm` o `tsvector` |
| D3 | `TODO:` política de retención en base de datos | `data/legal.ts` declara 24 meses, pero no hay trabajo que borre lo vencido |
| D4 | Particionar o archivar `AuditLog` y `PaymentEvent` | Crecen de forma indefinida |
| D5 | `latitude`/`longitude` están sin usar | El mapa es simulado (`mapX`/`mapY`); si se adopta geolocalización real, migrar y agregar índice geoespacial |
