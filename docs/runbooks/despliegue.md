# Runbook · despliegue, dominio y HTTPS

Qué se despliega, dónde, cómo se verifica y cómo se revierte.

## Estado

| Componente | Destino | Estado |
|---|---|---|
| **SPA** (`src/` → `dist/`) | Vercel, proyecto `reverde` (ya enlazado en `.vercel/project.json`) | ✅ desplegable |
| **API** (`server/`) | `TODO:` **sin decidir** | ⬜ nunca se ha desplegado |
| **PostgreSQL** | `TODO:` **sin decidir** | ⬜ solo existe en Docker local |
| **Dominio propio** | `TODO:` sin comprar | ⬜ hoy solo el subdominio `*.vercel.app` |

> Mientras la API no tenga destino, lo desplegado es **solo la SPA con
> `localStorage`**: funciona de punta a punta para la demostración, pero sin
> persistencia compartida ni multiusuario real (Must-have M14).

---

## 1 · Integración continua

`.github/workflows/ci.yml` corre en cada push y PR a `main` y `develop`, en
cuatro trabajos paralelos:

| Trabajo | Qué verifica | Bloquea el merge |
|---|---|---|
| `calidad` | lint · typecheck · 221 unitarias con cobertura · 31 unitarias de API · presupuestos del motor · build · deriva de OpenAPI | ✅ |
| `api` | 10 archivos de pruebas de integración contra un PostgreSQL 16 real · build de la API | ✅ |
| `qa` | Playwright: 474 casos en Chromium, Firefox y WebKit + 3 perfiles móviles | ✅ |
| `seguridad` | `npm audit` (informativo) · **ningún `.env` versionado** (bloquea) | parcial |

`TODO:` activar la protección de rama en GitHub para exigir estos trabajos
antes de permitir el merge a `main`. Hoy el workflow corre pero **nada impide
mezclar con la CI en rojo**: Ajustes → Branches → Branch protection rules.

---

## 2 · Despliegue de la SPA

El proyecto ya está enlazado a Vercel, que despliega **por integración con Git**
(no hace falta un workflow de despliegue):

| Rama | Resultado |
|---|---|
| `main` | Despliegue de **producción** |
| `develop` y ramas de trabajo | Despliegue de **vista previa** con URL propia por commit |
| Pull request | Vercel comenta la URL de vista previa en el PR |

```bash
# Despliegue manual, si hace falta
npx vercel           # vista previa
npx vercel --prod    # producción
npx vercel ls        # historial
```

Configuración en `vercel.json`:

- **Rewrite** `/(.*)` → `/index.html`: lo necesita toda SPA con rutas del lado
  del cliente; sin él, `/tienda/explorar` daría 404 al entrar directamente.
- **Cabeceras de seguridad** (ver § 4).
- **Caché**: `/assets/*` immutable por un año (los nombres llevan hash);
  `index.html` con `must-revalidate` para que un despliegue nuevo se vea de
  inmediato.

### Verificación posterior al despliegue

```bash
URL=https://…                                    # la URL desplegada
curl -sI "$URL" | grep -i "content-security-policy\|strict-transport"
curl -s -o /dev/null -w '%{http_code}\n' "$URL/tienda/explorar"   # debe ser 200, no 404
QA_BASE_URL="$URL" npm run test:qa:all           # la suite completa contra lo desplegado
node tests/load/http-load.mjs --url "$URL"       # carga real, con CDN
```

### Revertir

Vercel conserva todos los despliegues: **Dashboard → Deployments → el anterior →
Promote to Production**. Tarda segundos y no necesita build. Es más rápido y
seguro que revertir el commit, que además dispara un build nuevo.

---

## 3 · Despliegue de la API · pendiente de decisión

No hay destino elegido. Lo que **sí** está listo: `server/Dockerfile`
multi-stage con Node 24, que aplica `prisma migrate deploy` al arrancar
(idempotente), y `assertProductionSafety()`, que impide arrancar con una
configuración insegura.

| Candidato | A favor | En contra |
|---|---|---|
| **Render** | PostgreSQL gestionado y despliegue por Docker en el mismo sitio; plan gratuito para demostrar | El plan gratuito duerme el servicio |
| **Railway** | Muy rápido de configurar, Postgres incluido | Coste al crecer |
| **Fly.io** | Buen rendimiento, región en Latinoamérica | Más configuración |
| **Vercel Functions** | Todo en un proveedor | Habría que adaptar Express al modelo de funciones y buscar Postgres aparte |

Recomendación: **Render o Railway**, porque dejan la API y la base en el mismo
lugar y el Dockerfile ya existe.

Lista de verificación para cuando se decida:

- [ ] Crear el servicio desde `server/Dockerfile`
- [ ] Aprovisionar PostgreSQL 16 gestionado **con respaldos automáticos**
- [ ] Configurar **todas** las variables de `.env.production.example` en el panel del proveedor (nunca en el repo)
- [ ] `ENCRYPTION_KEY` e `IP_HASH_SALT` nuevas: `openssl rand -base64 32`
- [ ] `CORS_ORIGINS` con el dominio exacto de la SPA
- [ ] `COOKIE_SECURE=true` · `APP_URL` y `API_URL` con `https://`
- [ ] `ENABLE_DEMO_ACCOUNTS=false`
- [ ] `MAIL_TRANSPORT=smtp` con el proveedor de correo configurado
- [ ] `PAYMENTS_PROVIDER=wompi` con llaves de **sandbox** primero
- [ ] Apuntar la URL de eventos de Wompi a `https://…/api/payments/webhook/wompi`
- [ ] Verificar `GET /api/health` → `{"data":{"status":"ok","database":"ok"}}`
- [ ] Crear el primer superadministrador con `POST /api/auth/bootstrap-superadmin` y **borrar el token después**
- [ ] Programar el respaldo ([backup-recovery.md](./backup-recovery.md))
- [ ] Añadir el trabajo de despliegue de la API a la CI

---

## 4 · Dominio, HTTPS y cabeceras

### Dominio

`TODO:` **sin comprar.** Hoy el despliegue vive en un subdominio `*.vercel.app`.

Cuando se compre, el reparto natural es:

| Subdominio | Apunta a |
|---|---|
| `reverde.app` · `www.reverde.app` | SPA en Vercel |
| `api.reverde.app` | API |

Pasos en Vercel: Project → Settings → Domains → añadir el dominio y copiar los
registros DNS que indique. El certificado se emite solo.

### HTTPS

| Garantía | Cómo se cumple | Verificación |
|---|---|---|
| Certificado TLS | Vercel lo emite y renueva automáticamente (Let's Encrypt) | `curl -vI https://…` |
| **Redirección de HTTP a HTTPS** | **La hace Vercel en su borde**, antes de llegar a la aplicación: no hay nada que configurar y no se puede desactivar | `curl -sI http://… \| grep -i location` → debe dar `308` hacia `https://` |
| HSTS | Cabecera en `vercel.json`: `max-age=31536000; includeSubDomains; preload` | `curl -sI https://… \| grep -i strict-transport` |
| HSTS en la API | Helmet con el mismo `max-age`, **solo en producción** | |
| Cookies solo por HTTPS | `COOKIE_SECURE=true`, exigido por `assertProductionSafety()` | El arranque falla si es `false` |
| Contenido mixto | `upgrade-insecure-requests` en la CSP | |

`TODO:` cuando el dominio sea definitivo, inscribirlo en la
[lista de precarga de HSTS](https://hstspreload.org/). **Antes no**: la
inscripción es difícil de revertir.

### Cabeceras de seguridad

Definidas en `vercel.json` y aplicadas a todas las rutas:

| Cabecera | Valor | Qué evita |
|---|---|---|
| `Content-Security-Policy` | ver abajo | Inyección de scripts (XSS) |
| `Strict-Transport-Security` | 1 año, subdominios, preload | Degradación a HTTP |
| `X-Content-Type-Options` | `nosniff` | Que el navegador adivine el tipo de un archivo |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Fuga de rutas en el `Referer` |
| `Permissions-Policy` | cámara, micrófono, ubicación, pagos… denegados | Acceso a APIs del dispositivo que la app no usa |
| `Cross-Origin-Opener-Policy` | `same-origin` | Manipulación entre ventanas |

**La CSP, explicada:**

```
default-src 'self'            todo lo no listado: solo del propio origen
script-src 'self'             sin scripts en línea ni CDN: el build no los necesita
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src  'self' https://fonts.gstatic.com data:
img-src   'self' data: blob:
connect-src 'self'            ← OJO: hay que añadir aquí la URL de la API al cerrar M14
frame-src 'none' · object-src 'none' · frame-ancestors 'none'
base-uri 'self' · form-action 'self'
upgrade-insecure-requests
```

Dos cosas que hay que saber:

1. **`'unsafe-inline'` en `style-src` es una concesión deliberada.** React y
   Recharts aplican estilos en línea. Quitarlo exige nonces por respuesta, que
   Vercel no genera para archivos estáticos. El riesgo residual es inyección de
   estilos, muy inferior al de scripts (que **sí** está cerrado).
2. **`connect-src 'self'` bloqueará las llamadas a la API** en cuanto la SPA
   empiece a consumirla, si la API vive en otro dominio. Al cerrar M14 hay que
   añadir `https://api.…` ahí. Es un fallo que no se ve en el build y solo
   aparece en el navegador: por eso existe la comprobación local de abajo.

### Comprobar la CSP antes de desplegar

Una CSP mal puesta no rompe el build: rompe el navegador de quien entra, en
producción. Para probarla en local con las cabeceras reales:

```bash
npm run build
npm run preview:headers                                 # http://localhost:4173
QA_BASE_URL=http://localhost:4173 npm run test:qa       # la app completa bajo la política
```

`scripts/preview-with-headers.mjs` lee `vercel.json` y aplica esas mismas
cabeceras. Las pruebas de QA que vigilan la consola detectan cualquier bloqueo.

**Verificado el 9 de noviembre de 2026:** 75 pruebas en verde contra el build de
producción con la CSP aplicada, sin violaciones en consola.

---

## 5 · Gestión de secretos

| Entorno | Dónde viven |
|---|---|
| Local | `.env.development.local` (en `.gitignore`) |
| CI | Variables del propio workflow; las pruebas usan credenciales de juguete de `testEnv.ts` |
| SPA en producción | Variables de entorno del proyecto en Vercel (solo `VITE_*`, que son **públicas**: nunca un secreto ahí) |
| API en producción | `TODO:` el panel del proveedor que se elija |

El trabajo `seguridad` de la CI falla si aparece un `.env` versionado.

---

## 6 · Incidentes

| Síntoma | Primera comprobación | Acción |
|---|---|---|
| La SPA no carga | Vercel → Deployments: ¿el último build falló? | Promover el despliegue anterior |
| Pantalla en blanco tras desplegar | Consola del navegador: ¿hay violación de CSP? | Ajustar `vercel.json` y volver a desplegar; reproducir antes con `preview:headers` |
| Rutas profundas dan 404 | ¿Sigue el rewrite en `vercel.json`? | Restaurarlo |
| La API responde 503 | `GET /api/health` → `database` | Revisar la base; ver [backup-recovery.md](./backup-recovery.md) |
| La API no arranca | Logs del proveedor | Casi siempre `assertProductionSafety()`: el mensaje dice qué variable está mal |
| Los pagos no se confirman | `GET /api/admin/payment-events` | ¿Llegan los webhooks? ¿`signatureValid: false`? Revisar la URL de eventos y `WOMPI_EVENTS_SECRET` |
| Stock bloqueado por reservas | `SELECT` de órdenes `PENDING_PAYMENT` vencidas | El scheduler las libera cada 60 s; si no, revisar que el proceso esté vivo |

`TODO:` definir a quién se avisa y por qué canal. Hoy no hay guardia ni alertas.

---

## Pendientes

| # | Pendiente | Impacto |
|---|---|---|
| P1 | Destino de despliegue de la API y base gestionada | **Bloquea** tener un producto real |
| P2 | Protección de rama que exija la CI | Hoy se puede mezclar con la CI en rojo |
| P3 | Dominio propio | Bloquea HSTS preload, el correo con dominio verificado y las pruebas de carga con sentido |
| P4 | Añadir la URL de la API a `connect-src` al cerrar M14 | Fallo silencioso en producción si se olvida |
| P5 | Trabajo de despliegue de la API en la CI | Depende de P1 |
| P6 | Entorno de preproducción | Hoy las vistas previas de Vercel hacen ese papel para la SPA |
