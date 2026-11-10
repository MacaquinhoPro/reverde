# Runbook · respaldo y recuperación de la base de datos

## Resumen operativo

| | |
|---|---|
| **Qué se respalda** | La base PostgreSQL completa: es el único estado con valor. El código está en Git y las imágenes en el repositorio |
| **Cómo** | `pg_dump` en formato personalizado comprimido (`-Fc`), verificado tras crearlo |
| **Dónde** | `backups/` en local (está en `.gitignore`) · `TODO:` destino remoto cifrado |
| **Frecuencia objetivo** | Diaria automática + antes de cada migración y de cada despliegue |
| **Retención** | 14 días por defecto (`RETENTION_DAYS`), ver § retención |
| **RPO objetivo** | **24 h** (lo que se puede perder) |
| **RTO objetivo** | **1 h** (lo que se tarda en volver) |
| **Estado real** | 🟡 **los scripts existen y están verificados; nada está programado y la restauración nunca se ha probado de punta a punta** |

> ⚠️ **Lo más importante de este documento:** un respaldo que nunca se ha
> restaurado **no es un respaldo, es una esperanza**. La sección
> [§ 5](#5--prueba-de-restauración) existe para que eso deje de ser cierto, y su
> tabla está vacía.

---

## 1 · Qué hay que proteger

| Dato | Dónde vive | Si se pierde |
|---|---|---|
| Usuarios, contraseñas, roles | `User`, `Role`, `RolePermission` | Nadie puede entrar. **Irrecuperable** |
| Establecimientos y membresías | `Establishment`, `EstablishmentUser` | Se pierde la red de clientes |
| Inventario y existencias | `Product`, `Inventory`, `InventoryMovement` | El establecimiento tiene que recargar todo a mano |
| **Órdenes y pagos** | `Order`, `Payment`, `PaymentEvent` | **Problema contable y legal**: hay dinero cobrado sin registro |
| Ventas e impacto | `Sale`, `PromoOutcome` | Se pierden las métricas y el aprendizaje del motor |
| **Autorizaciones de datos** | `Order.consentVersion/AcceptedAt/Purpose` | **Incumplimiento de la Ley 1581 de 2012**: hay que poder demostrar la autorización |
| Bitácora de auditoría | `AuditLog` | Se pierde la trazabilidad de quién hizo qué |

Las dos filas en negrita son las que convierten esto en obligatorio y no en
buena práctica: el registro de pagos y la **prueba del consentimiento**.

**No** hace falta respaldar: `Session` (se vuelve a iniciar sesión),
`IdempotencyRecord` (caduca en 24 h), `LoginAttempt` (se limpia a los 30 días).
Se incluyen igual porque el volcado es completo y pesan poco.

---

## 2 · Hacer un respaldo

```bash
npm run db:backup                           # usa DATABASE_URL del ambiente
DATABASE_URL=… npm run db:backup            # una base concreta
RETENTION_DAYS=30 npm run db:backup         # cambia la rotación
BACKUP_DIR=/ruta/segura npm run db:backup   # otro destino
```

Qué hace `scripts/db-backup.sh`, en orden:

1. Resuelve `DATABASE_URL` del ambiente o de los archivos `.env`.
2. Usa `pg_dump` del sistema **o**, si no está instalado, el del contenedor
   `db` de Docker. No hay que instalar nada para respaldar la base local.
3. Volca en **formato personalizado comprimido** (`-Fc --compress=9`), que
   permite restaurar tablas por separado y pesa mucho menos que SQL plano.
4. Usa `--no-owner --no-privileges`: el volcado se puede restaurar en una base
   con otro usuario, que es el caso al pasar de local a una base gestionada.
5. **Verifica el archivo** con `pg_restore --list`. Si está ilegible **lo
   borra**, para no dar una falsa sensación de seguridad.
6. Guarda un **SHA-256** junto al volcado, para detectar corrupción silenciosa.
7. Rota los respaldos con más de `RETENTION_DAYS` días.
8. Recuerda que el archivo **contiene datos personales**.

Formato del nombre: `<base>-<AAAAMMDD-HHMMSS>.dump`.

### Cuándo hacer uno a mano, sin falta

- **Antes de cada migración** (`npm run db:migrate` / `db:deploy`).
- **Antes de cada despliegue** de la API a producción.
- Antes de cualquier operación masiva sobre datos.
- Antes de probar una restauración (§ 5).

---

## 3 · Programar el respaldo · pendiente

`TODO:` **nada está programado todavía.** Depende de dónde viva la base
(decisión P1 de [`despliegue.md`](./despliegue.md)). Las tres opciones, en orden
de preferencia:

### Opción A · Respaldos del proveedor gestionado (recomendada)

Render, Railway, Neon y Supabase hacen respaldos automáticos con recuperación a
un punto en el tiempo. Es lo más confiable porque no depende de que un proceso
nuestro esté vivo, y el RPO baja de 24 h a minutos.

- [ ] Activarlos al aprovisionar la base
- [ ] Anotar aquí la frecuencia y la retención que ofrece el plan
- [ ] **Probar la restauración de todos modos** (§ 5): que el proveedor diga que
      respalda no prueba que podamos volver

**Y además** mantener el volcado lógico propio: protege de perder la cuenta del
proveedor, y es el único formato que se puede llevar a otro sitio.

### Opción B · Cron en el servidor

```cron
# Diario a las 03:00 (hora de Bogotá). La salida al log para poder auditarlo.
0 3 * * * cd /app && DATABASE_URL="$DATABASE_URL" RETENTION_DAYS=14 \
          bash scripts/db-backup.sh >> /var/log/reverde-backup.log 2>&1
```

Requiere `postgresql-client` en la imagen y un volumen persistente para
`backups/`. **Sin volumen no sirve de nada:** el respaldo se iría con el
contenedor.

### Opción C · GitHub Actions programado

Deliberadamente **no** se ha añadido como workflow activo, por dos razones:
exigiría abrir la base a las IP de GitHub o un túnel, y un workflow programado
que falla cada día por falta de secretos es ruido que la gente aprende a
ignorar. Plantilla para cuando haya decisión:

```yaml
# .github/workflows/backup.yml  ← TODO: activar cuando exista base en producción
on:
  schedule: [{ cron: '0 8 * * *' }]   # 03:00 en Bogotá (UTC-5)
  workflow_dispatch:
jobs:
  respaldo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get update && sudo apt-get install -y postgresql-client
      - run: bash scripts/db-backup.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}   # TODO: crear el secreto
      # TODO: subir el volcado a un almacenamiento CIFRADO y privado.
      # Un artefacto de GitHub NO sirve: contiene datos personales.
```

---

## 4 · Restaurar

```bash
npm run db:restore                                  # el respaldo más reciente
npm run db:restore -- backups/reverde_dev-2026….dump  # uno concreto
TARGET_DATABASE_URL=… npm run db:restore            # a otra base
```

`scripts/db-restore.sh` es **destructivo** y está escrito para que no se pueda
ejecutar por accidente:

| Barrera | Qué hace |
|---|---|
| Verificación de integridad | `pg_restore --list` + comprobación del SHA-256. Si el archivo cambió, se niega |
| Confirmación escrita | Hay que escribir `restaurar`. Un `y` distraído no basta |
| Protección de producción | Si el destino no parece local, exige `I_UNDERSTAND_THIS_IS_PRODUCTION=yes` |
| Atomicidad | `--single-transaction`: un fallo a mitad **no** deja la base en un estado intermedio |
| Limpieza previa | `--clean --if-exists` borra los objetos antes de recrearlos |

### Después de restaurar, siempre

```bash
npm run db:deploy                        # aplica migraciones posteriores al volcado
curl -s localhost:4000/api/health | jq   # database debe decir "ok"
npm run db:studio                        # revisar a ojo que los datos están
```

Y una comprobación que no es obvia: **que los datos cifrados se puedan leer**.
`phoneEncrypted` y `documentEncrypted` están cifrados con `ENCRYPTION_KEY`; si
se restaura en un entorno con **otra llave**, los datos están ahí pero son
ilegibles para siempre. Restaurar la base **no** restaura la llave: esa vive en
las variables de entorno y hay que guardarla aparte, en el gestor de secretos.

> `TODO:` documentar dónde se custodia `ENCRYPTION_KEY`. Hoy no está escrito, y
> **perderla equivale a perder los datos personales cifrados** aunque el
> respaldo esté intacto.

---

## 5 · Prueba de restauración

**Obligatoria antes de operar con datos reales, y después una vez por trimestre.**

Procedimiento (30 min, sin tocar producción):

1. `npm run db:backup` contra la base de origen.
2. Crear una base vacía aparte:
   `docker compose exec db createdb -U reverde reverde_restore_test`
3. Restaurar ahí:
   `TARGET_DATABASE_URL=postgresql://reverde:reverde@localhost:5433/reverde_restore_test npm run db:restore`
4. Apuntar la API a esa base y comprobar:
   - [ ] `GET /api/health` → `database: "ok"`
   - [ ] Iniciar sesión con una cuenta existente (prueba el hash de contraseñas)
   - [ ] `GET /api/auth/me` devuelve el teléfono descifrado (**prueba la llave de cifrado**)
   - [ ] `GET /api/products` lista el inventario con sus existencias
   - [ ] `GET /api/orders` muestra el histórico con sus pagos
   - [ ] Un pedido con autorización conserva `consentVersion` y `consentAcceptedAt`
   - [ ] `GET /api/admin/audit` conserva la bitácora
5. **Cronometrar** desde el paso 2 y anotar el tiempo: ese es el RTO real.
6. Borrar la base de prueba.
7. **Registrar el resultado abajo.** Una restauración sin registrar no cuenta.

### Registro de pruebas de restauración

| Fecha | Quién | Respaldo usado | Destino | Tiempo (RTO real) | Resultado | Notas |
|---|---|---|---|---|---|---|
| — | | | | | ⬜ **nunca se ha probado** | Bloqueado: no hay base de producción, y en esta máquina no hay Docker ni `pg_dump` |

---

## 6 · Retención y datos personales

Un respaldo es una copia de datos personales, así que la Ley 1581 de 2012 aplica
igual que a la base en vivo.

| Regla | Estado |
|---|---|
| Retención de respaldos: 14 días | ✅ implementado (`RETENTION_DAYS`) |
| Retención de datos: 24 meses desde la última interacción | ⚠️ **declarado en `src/data/legal.ts`, no implementado** (pendiente D3/S6) |
| Los respaldos no se versionan | ✅ `/backups` está en `.gitignore` |
| Almacenamiento remoto cifrado | ⬜ `TODO:` sin destino |
| Acceso restringido a los respaldos | ⬜ `TODO:` definir quién puede descargarlos |

### El problema de la supresión y los respaldos

`DELETE /api/users/me` anonimiza la cuenta en la base en vivo, pero **los
respaldos anteriores siguen conteniendo los datos originales**. Es el conflicto
clásico entre el derecho de supresión y la integridad de los respaldos.

Postura razonable, y la que se recomienda documentar en la política:

- La supresión se aplica de inmediato en la base en vivo.
- Los respaldos se conservan **14 días** y **solo** se usan para recuperación
  ante desastre, nunca para reconstruir un perfil.
- Si hay que restaurar un respaldo anterior a una supresión, **se vuelve a
  aplicar la supresión** inmediatamente después, como paso del procedimiento.

`TODO:` que un abogado revise esta postura y, si procede, reflejarla en la
política de privacidad. Hoy la política no dice nada de los respaldos.

---

## 7 · Escenarios de desastre

| Escenario | Qué hacer | RTO esperado |
|---|---|---|
| Borrado accidental de datos | Restaurar el último respaldo en una base aparte, extraer solo lo borrado, insertarlo | 1 h |
| Base corrupta | Restaurar el último respaldo sobre una base nueva y reapuntar la API | 1 h |
| Migración que salió mal | Restaurar el respaldo **previo a la migración** (de ahí la regla del § 2) | 30 min |
| Pérdida del proveedor de base de datos | Aprovisionar en otro proveedor y restaurar el volcado lógico | 2–4 h (`TODO:` sin probar) |
| **Pérdida de `ENCRYPTION_KEY`** | **Sin remedio**: los datos cifrados quedan ilegibles | — |
| Pérdida de todos los respaldos | Sin remedio | — |

Las dos últimas filas son la razón de ser de este documento.

---

## Pendientes

| # | Pendiente | Impacto |
|---|---|---|
| B1 | **Nunca se ha probado una restauración** | No se sabe si los respaldos sirven |
| B2 | Nada está programado | Depende de P1 (dónde vive la base) |
| B3 | `TODO:` destino remoto cifrado para los volcados | Un respaldo junto a la base no protege de perder el servidor |
| B4 | `TODO:` documentar la custodia de `ENCRYPTION_KEY` | Perderla hace inútil el respaldo |
| B5 | Retención de 24 meses declarada pero no implementada | Incumplimiento de lo que promete la propia política |
| B6 | `TODO:` revisión legal de la postura sobre supresión y respaldos | |
