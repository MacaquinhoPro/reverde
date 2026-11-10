# Seguridad y autenticación

Qué defensas están implementadas, **dónde** está cada una y qué queda pendiente.
Todo lo afirmado aquí apunta a un archivo verificable.

## Resumen

| Control | Estado | Implementación |
|---|---|---|
| Hash de contraseñas | ✅ | Argon2id · `server/src/lib/password.ts` |
| Sesiones revocables | ✅ | Token opaco + SHA-256 en base · `middleware/auth.ts` |
| Roles y permisos | ✅ | Matriz en base de datos · `middleware/rbac.ts` |
| Aislamiento multi-tenant | ✅ | `middleware/tenancy.ts` |
| Cifrado de datos sensibles | ✅ | AES-256-GCM · `lib/crypto.ts` |
| Secretos por variables de entorno | ✅ | `config/env.ts` con validación Zod |
| CORS en lista blanca | ✅ | `app.ts` |
| Validación de entradas | ✅ | Zod en todo endpoint |
| Límite de peticiones | 🟡 | `middleware/rateLimit.ts` — en memoria, no sirve con varias réplicas |
| Protección CSRF | ✅ | Doble envío de cookie · `middleware/csrf.ts` |
| Cabeceras de seguridad y HSTS | ✅ | Helmet · `app.ts` |
| Bloqueo por fuerza bruta | ✅ | `LoginAttempt` + `lockedUntil` en base |
| Idempotencia en dinero e inventario | ✅ | `middleware/idempotency.ts` |
| Bitácora de auditoría | ✅ | `lib/audit.ts` |
| Barreras de producción | ✅ | `assertProductionSafety()` |
| Webhook con firma verificada | ✅ | `modules/payments/` |
| Content Security Policy del frontend | ⬜ | **pendiente** |
| Análisis de dependencias en CI | 🟡 | `npm audit` corre en la CI sin bloquear |
| Pentest / revisión externa | ⬜ | `TODO:` |

## 1 · Autenticación

### Contraseñas · Argon2id

`lib/password.ts` usa **Argon2id** (`@node-rs/argon2`):

| Parámetro | Producción | Pruebas | Por qué |
|---|---|---|---|
| `memoryCost` | 65536 KiB (64 MiB) | 8192 KiB | Por encima del mínimo de OWASP (19 MiB) |
| `timeCost` | 3 | 2 | Coste cómodo para una API de este tamaño |
| `parallelism` | 1 | 1 | Recomendación de OWASP |
| `outputLen` | 32 bytes | 32 bytes | |

- La **sal la genera la librería** (16 bytes aleatorios por contraseña) y queda
  embebida en el hash junto con los parámetros.
- `needsRehash()` detecta hashes creados con parámetros más débiles: se puede
  subir el coste sin invalidar las contraseñas existentes.
- En pruebas el coste baja a propósito: 60 hashes a 64 MiB harían la suite inusable.
- `verifyPassword()` devuelve `false` ante un hash corrupto en lugar de lanzar
  excepción, para no distinguir «hash roto» de «contraseña incorrecta».

### Sesión: cookie opaca, no JWT

```
Login → token aleatorio de 32 bytes (base64url)
      → la base guarda solo su SHA-256 (Session.tokenHash)
      → el token en claro solo existe en la cookie rv_session (HttpOnly)
```

| Propiedad | Valor | Variable |
|---|---|---|
| Nombre | `rv_session` | `SESSION_COOKIE_NAME` |
| `HttpOnly` | sí, siempre | — |
| `Secure` | **obligatorio en producción** | `COOKIE_SECURE` |
| `SameSite` | `lax` por defecto | `COOKIE_SAMESITE` |
| Vigencia | 72 h, con renovación deslizante | `SESSION_TTL_HOURS` |

Ventajas frente a un JWT en `localStorage`: **no es legible por XSS** y **se
revoca de inmediato** (`DELETE /api/auth/sessions/{id}`), porque la validez la
decide la base de datos y no una firma. Cada sesión guarda `ipHash` y
`userAgent` para que la persona reconozca sus dispositivos.

### Bloqueo por fuerza bruta · dos capas

| Capa | Dónde vive | Límite | Sobrevive a reinicios |
|---|---|---|---|
| Por cuenta | `User.failedLogins` + `lockedUntil` | `MAX_LOGIN_ATTEMPTS` = 5 → bloqueo de `LOGIN_LOCK_MINUTES` = 15 min | ✅ en base de datos |
| Por correo e IP | tabla `LoginAttempt` | 5 por correo · 20 por IP (`MAX_LOGIN_ATTEMPTS * 4`) | ✅ en base de datos |
| Por petición | `rateLimit` en memoria | 10 peticiones/min en `/api/auth/*` | ❌ por proceso |

**A propósito en base de datos y no solo en memoria:** un reinicio del proceso no
debe regalarle intentos a quien está atacando.

`LoginAttempt` registra también los intentos con correos inexistentes, y la
respuesta no distingue «no existe la cuenta» de «contraseña incorrecta» en el
código de error, para no permitir enumerar cuentas.

### Verificación de correo y restablecimiento

`VerificationToken` guarda el **hash** del token; el valor en claro solo viaja en
el correo. Cada token tiene `expiresAt` y `usedAt` (**un solo uso**).
`/api/auth/password/forgot` responde igual exista o no la cuenta.

### El rol nunca se autoasigna

`POST /api/auth/register` crea **siempre** rol `cliente`. Para operar un
establecimiento hace falta una `EstablishmentRequest` aprobada por un
superadministrador. El primer superadministrador se crea una sola vez con
`POST /api/auth/bootstrap-superadmin`, protegido por
`SUPERADMIN_BOOTSTRAP_TOKEN` y limitado a 5 intentos por hora.

## 2 · Autorización

### Roles y permisos en base de datos

Los permisos **no están codificados en el código**: viven en las tablas
`Permission` y `RolePermission`, se cachean 60 s en memoria y se consultan con
`requirePermission('products:write')`. La matriz se puede ajustar sin desplegar.

Catálogo de permisos (`PERMISSIONS` en `middleware/rbac.ts`):

```
products:read · products:write · inventory:write
alerts:read · alerts:write
recommendations:read · recommendations:apply
marketplace:publish · marketplace:browse
dashboard:read · cart:write
orders:create · orders:read:own · orders:read:establishment · orders:manage
payments:checkout
establishments:read · establishments:write · establishments:request
users:read …
```

Dos niveles: `requireRole(...)` para secciones completas y
`requirePermission(...)` para acciones concretas. El seed sincroniza la matriz.

### Aislamiento multi-tenant

`middleware/tenancy.ts`, con tres decisiones deliberadas:

1. **El establecimiento nunca se toma del parámetro de la petición** para un
   administrador: se resuelve desde `EstablishmentUser`. Solo el superadmin puede
   indicarlo explícitamente.
2. **Pedir datos de otro establecimiento responde `403`, no `404`**: un `404`
   confirmaría que ese establecimiento existe.
3. `assertSameEstablishment()` revalida la pertenencia del recurso ya cargado,
   por si la consulta no filtró.

Cubierto por `server/src/tests/tenancy.test.ts`.

## 3 · Datos sensibles

`lib/crypto.ts` separa tres usos que **no deben confundirse**:

| Uso | Primitiva | Reversible | Ejemplos |
|---|---|---|---|
| Contraseñas | Argon2id | ❌ nunca | `User.passwordHash` |
| Datos personales que el negocio necesita leer | **AES-256-GCM** | ✅ con la llave | `phoneEncrypted`, `documentEncrypted`, `contactPhoneEnc` |
| Identificadores de búsqueda y bitácoras | SHA-256 (con sal en la IP) | ❌ | `tokenHash`, `ipHash` |

- Formato del cifrado: `v1.iv.tag.ciphertext` en base64url — **versionado**, para
  poder rotar el algoritmo sin romper lo ya guardado.
- IV aleatorio de 12 bytes **por cada cifrado**; GCM aporta autenticación, así que
  un dato manipulado falla al descifrar en lugar de devolver basura.
- La llave se deriva de `ENCRYPTION_KEY` (32 bytes en base64); si el secreto no
  mide 32 bytes se deriva con SHA-256.
- `safeEqual()` compara en **tiempo constante** (CSRF, tokens).
- `maskTail()` muestra los últimos dígitos sin revelar el dato completo.
- La IP **nunca se guarda en claro**: `hashIp()` usa `IP_HASH_SALT`.

`TODO:` **rotación de llaves.** El formato está versionado, pero no existe el
procedimiento ni el script para re-cifrar con una llave nueva.

## 4 · Manejo de secretos

| Regla | Cómo se cumple |
|---|---|
| Ningún secreto en el repositorio | `.gitignore` excluye `.env` y `.env.*`, versionando solo los `*.example`. Verificado: `git ls-files` no devuelve ningún `.env` real |
| Todo secreto se valida al arrancar | `config/env.ts` con Zod: **si falta o es inválido, el proceso no arranca** |
| Configuración separada por ambiente | Precedencia: `.env.<NODE_ENV>.local` → `.env.<NODE_ENV>` → `.env.local` → `.env` |
| Las pruebas nunca tocan la base real | `TEST_DATABASE_URL` se impone cuando `NODE_ENV=test` |
| Secretos en producción | `TODO:` definir el gestor (variables del proveedor de hosting, Vault, Doppler…) |

### Barreras de producción · `assertProductionSafety()`

Se ejecuta al arrancar y **lanza una excepción** si el despliegue es inseguro.
Es deliberado: un despliegue mal configurado no debe quedar sirviendo tráfico.

| Comprobación | Motivo |
|---|---|
| `ENABLE_DEMO_ACCOUNTS` debe ser `false` | Las cuentas de demostración tienen contraseña conocida |
| `COOKIE_SECURE` debe ser `true` | Sin HTTPS la cookie de sesión viaja en claro |
| `APP_URL` y `API_URL` deben usar `https://` | |
| `CORS_ORIGINS` no puede estar vacío ni llevar `*` | |
| `ENCRYPTION_KEY` no puede ser la de desarrollo | Se decodifica de base64 y se buscan las marcas `dev-only`, `test-only`, `do-not-use` |
| `IP_HASH_SALT` no puede ser la de desarrollo | |
| `MAIL_TRANSPORT` debe ser `smtp` | Con `log` los enlaces de verificación no llegan |
| `PAYMENTS_PROVIDER` no puede ser `mock` | |
| Con `wompi`: las 4 llaves son obligatorias | |
| Llaves `pub_prod_` exigen `PAYMENTS_LIVE_ENABLED=true` | **Cobrar de verdad requiere un interruptor explícito** |
| `PAYMENTS_LIVE_ENABLED=true` con llaves de sandbox falla | Configuración incoherente |

Cubierto por `server/src/tests/environment.test.ts`.

## 5 · Defensa en el borde

### Orden del middleware · `app.ts`

El orden **es** la seguridad:

```
requestId → helmet → cors → pino-http
  → [webhook con cuerpo crudo, antes del parser de JSON]
  → express.json (1 MB) · urlencoded (256 kB) · cookieParser
  → /api/health
  → attachSession → csrfProtection → rateLimit
  → routers de dominio (requireAuth → requirePermission → resolveEstablishment → validate)
  → notFoundHandler → errorHandler
```

Tres decisiones del orden:

1. **El webhook va antes del parser de JSON** porque la firma se valida sobre los
   bytes exactos, y **antes de CSRF** porque no lo origina un navegador.
2. **`/api/health` va antes de la sesión** para que el monitoreo no necesite
   credenciales.
3. **`/api/dev` solo se monta si `NODE_ENV !== 'production'`.**

### Cabeceras · Helmet

`contentSecurityPolicy: false` porque **la API responde JSON**; la CSP le
corresponde al frontend (ver pendiente S1). `crossOriginResourcePolicy:
cross-origin` porque la SPA vive en otro dominio. **HSTS solo en producción**
(`max-age` 1 año, `includeSubDomains`). `x-powered-by` deshabilitado.
`trust proxy: 1` para leer la IP real detrás de Vercel/Nginx y saber que la
conexión original era HTTPS.

### CORS

Lista blanca explícita desde `CORS_ORIGINS`, con `credentials: true` (las cookies
de sesión lo exigen). Fuera de producción se admite cualquier
`localhost`/`127.0.0.1` con puerto. Las peticiones **sin** `Origin` (curl,
webhooks, mismo origen) se permiten. Un origen desconocido se rechaza con error.

### CSRF · doble envío de cookie

La cookie `rv_csrf` **no es `HttpOnly`** a propósito: el frontend la lee y la
repite en `x-csrf-token`. Un atacante en otro origen no puede leer la cookie, así
que no puede construir el encabezado. Se compara con `safeEqual` (tiempo
constante). Exentos: métodos seguros (`GET`/`HEAD`/`OPTIONS`), las peticiones sin
cookie de sesión (login, registro) y el webhook.

### Validación de entradas

**Todo** endpoint valida con Zod (`validate({ body, query, params })`). El tipo
del handler se infiere del esquema, así que un campo sin validar no compila.
Topes de tamaño: JSON 1 MB, formularios 256 kB, webhook 256 kB.

Reglas de negocio que **nunca** dependen del cliente:

- **Los precios y totales se calculan en el servidor.** El cliente envía
  `productId` y `quantity`, jamás un precio.
- `GET /api/cart` recalcula los precios al leer.
- El stock se verifica dentro de la transacción, no antes.

### Límite de peticiones

| Alcance | Límite | Ventana |
|---|---|---|
| Global | `RATE_LIMIT_MAX` = 300 | 60 s |
| `/api/auth/*` | 10 | 60 s |
| `bootstrap-superadmin` | 5 | 1 h |

La clave es el id de usuario si hay sesión, o la IP si no. 🟡 **Limitación
conocida:** el contador vive en memoria del proceso, así que con varias réplicas
el límite efectivo se multiplica por el número de instancias. Con escalado
horizontal hay que moverlo a Redis. El bloqueo de fuerza bruta **no** depende de
esto (está en base de datos).

## 6 · Integridad del dinero y del inventario

| Riesgo | Defensa |
|---|---|
| Doble orden por doble clic | `Order.idempotencyKey` único + `IdempotencyRecord` que **devuelve la misma respuesta** al reintento (y `409` si el cuerpo cambió) |
| Dos intenciones de pago vivas | `Payment.idempotencyKey` único |
| Webhook reenviado | `PaymentEvent.eventId` único |
| Webhook falsificado | Firma verificada; un evento con firma inválida se **guarda** con `signatureValid: false` y no se procesa |
| Stock negativo con compras simultáneas | Transacción con bloqueo de la fila de `Inventory` (`concurrency.test.ts`) |
| Reserva que bloquea stock para siempre | `Order.expiresAt` + `expireStaleOrders` cada 60 s |
| Confirmar sin que el proveedor confirme | **Solo el webhook confirma.** La redirección del navegador no confirma nada |
| Cobrar de verdad sin querer | `PAYMENTS_LIVE_ENABLED` como interruptor explícito |

## 7 · Trazabilidad

### Auditoría

`AuditLog` registra actor, rol, acción, entidad, establecimiento, `ipHash`,
`userAgent` (recortado a 250 caracteres) y metadatos. Dos decisiones:
**nunca guarda cuerpos de petición completos** (evita almacenar datos personales
de más) y **un fallo de auditoría no tumba la operación** (se registra el error
y se continúa). Consultable en `GET /api/admin/audit`.

### Logs

Pino en JSON con `requestId` por petición. `/api/health` se excluye del log
automático para no inundarlo. Nivel por código de estado: `error` ≥ 500,
`warn` ≥ 400, `info` el resto. Los enlaces con token se imprimen **solo** fuera
de producción.

### Errores hacia fuera

El `errorHandler` traduce todo a `{ error: { code, message } }`. El `message` es
para la persona; **el detalle técnico y el stack solo salen fuera de
producción** (`details: env.isProd ? undefined : …`). Los errores de Prisma se
traducen (`P2002` → 409, `P2025` → 404, `P2003` → 409) para no filtrar nombres de
tablas ni restricciones.

## 8 · Cumplimiento normativo (Habeas Data)

Resumen; el detalle está en [`../legal/`](../legal/).

| Exigencia (Ley 1581 de 2012) | Implementación |
|---|---|
| Autorización previa, expresa e informada | `ConsentGate` bloquea el uso hasta autorizar; se registra versión, fecha y finalidad |
| Autorización por finalidad concreta | `Order.consentVersion/AcceptedAt/Purpose` (migración `20261103213844_order_consent`) |
| Derecho a conocer y actualizar | `GET`/`PATCH /api/auth/me` · `DataRightsCard` |
| Derecho a supresión | `DELETE /api/users/me` — baja lógica con **anonimización**: el histórico de ventas del establecimiento sigue cuadrando, pero la identidad se desvincula |
| Seguridad de los datos | Esta sección completa |
| Canales de atención (art. 17) | `RESPONSABLE` en `src/data/legal.ts` — ⚠️ con datos de relleno |

⚠️ **Dos huecos reales:** (1) los datos del responsable son marcadores
(`NIT por definir`), así que los canales de atención **no son efectivos**; (2) no
existe exportación de datos para el derecho de **portabilidad**.

## 9 · Pendientes de seguridad

Ordenados por riesgo.

| # | Pendiente | Riesgo | Nota |
|---|---|---|---|
| S1 | **Content Security Policy del frontend** | Alto | Helmet la desactiva porque la API es JSON; la SPA se sirve en Vercel y hoy va sin CSP. Hay que definirla en `vercel.json` |
| S2 | **El límite de peticiones es por proceso** | Medio-alto | Con réplicas se multiplica. Mover a Redis |
| S3 | **Datos del responsable del tratamiento sin completar** | Medio-alto | Incumplimiento del art. 17 mientras sean marcadores |
| S4 | **Sin exportación de datos personales** | Medio | Derecho de portabilidad |
| S5 | `TODO:` procedimiento de rotación de `ENCRYPTION_KEY` | Medio | El formato está versionado; falta el script y el runbook |
| S6 | `TODO:` política de retención aplicada en base de datos | Medio | `legal.ts` declara 24 meses; nada los borra |
| S7 | `TODO:` destino de despliegue de la API y gestión de secretos | Medio | Sin esto, las barreras de producción nunca se ejercitan |
| S8 | `npm audit` no bloquea la CI | Bajo-medio | Decidir el umbral de severidad que debe romper el build |
| S9 | `TODO:` revisión de seguridad externa o pentest | Bajo (hoy) | Necesario antes de operar con datos reales |
| S10 | Sin 2FA | Bajo | Razonable para el MVP; anotado |
| S11 | `TODO:` cabeceras de seguridad del frontend en Vercel | Medio | `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| S12 | La SPA guarda todo en `localStorage` (Must-have M14) | **Alto mientras siga así** | Cualquiera puede manipular su propio estado: precios, stock y sesión. No hay control de acceso real hasta que la SPA consuma la API |

> **S12 es el más importante de la lista.** Mientras la aplicación que se muestra
> funcione con `localStorage`, todas las defensas descritas arriba están
> implementadas pero **no protegen nada en la demo**: la autoridad está en el
> navegador. No es un defecto del backend, es la consecuencia de que M14 siga
> abierto.
