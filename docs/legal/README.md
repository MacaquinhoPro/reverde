# Documentos legales

> ## ⚠️ Todos son BORRADORES pendientes de revisión por un abogado
>
> Los escribió el equipo de desarrollo sobre la **Ley 1581 de 2012**, el
> **Decreto 1074 de 2015** y los artículos 15 y 20 de la Constitución Política
> de Colombia. **No sustituyen la asesoría jurídica** y no deben usarse con
> datos de personas reales sin revisión profesional.

| Documento | Qué es | Dónde lo ve la persona |
|---|---|---|
| [`politica-privacidad.md`](./politica-privacidad.md) | Política de tratamiento de datos personales | `/legal/privacidad` |
| [`terminos-y-condiciones.md`](./terminos-y-condiciones.md) | Términos y condiciones de uso | `/legal/terminos` |
| [`autorizacion-habeas-data.md`](./autorizacion-habeas-data.md) | Texto de la autorización que se acepta | `/legal/habeas-data` y el diálogo de autorización |

## Estos archivos se generan, no se editan

La fuente de verdad es **`src/data/legal.ts`**, que es el texto que realmente se
le muestra a la persona en la aplicación.

```bash
npm run docs:legal         # regenera los tres documentos
npm run docs:legal:check   # falla si lo versionado quedó desactualizado
```

Se generan por una razón concreta: si el texto del repositorio y el de la
aplicación pueden divergir, **van a divergir**, y un documento que no coincide
con lo que se le mostró al titular **no sirve como prueba del consentimiento**
(Ley 1581 de 2012, art. 9).

Para cambiar un texto: editar `src/data/legal.ts`, **subir `LEGAL_VERSION`** —lo
que vuelve a pedir la autorización a quien la dio con la versión anterior— y
correr `npm run docs:legal`.

## Qué está implementado

| Exigencia legal | Implementación | Estado |
|---|---|---|
| Autorización previa, expresa e informada | `ConsentGate` bloquea el uso hasta autorizar | ✅ |
| Evidencia de la autorización | Versión, fecha y bitácora en el registro del consentimiento | ✅ |
| Consentimiento **en el registro** de la API | `POST /api/auth/register` **exige** `consent.accepted === true` y `consent.version`; se guarda en `User.consentVersion/consentAcceptedAt/consentMarketing` | ✅ |
| Consentimiento por finalidad concreta en el pedido | `Order.consentVersion/AcceptedAt/Purpose` | ✅ |
| Finalidades separadas, la opcional sin condicionar el servicio | `PURPOSES` + `MARKETING_PURPOSE`; `consentMarketing` por defecto `false` | ✅ |
| Derecho a **conocer** | `GET /api/auth/me` · **`GET /api/users/me/export`** (copia completa y portable) · `DataRightsCard` | ✅ |
| Derecho a **actualizar** | `PATCH /api/auth/me` · `DataRightsCard` | ✅ |
| Derecho a **suprimir** | `DELETE /api/users/me`: baja lógica con anonimización, para que el histórico de ventas del establecimiento siga cuadrando | ✅ |
| Derecho a **revocar** la autorización | `revoke()` en `ConsentContext`; apaga también la medición de producto | ✅ |
| Seguridad de los datos | Argon2id, AES-256-GCM, sesiones revocables, auditoría — ver [`../arquitectura/seguridad.md`](../arquitectura/seguridad.md) | ✅ |
| Medición solo con autorización | `track()` descarta eventos sin consentimiento; ningún evento lleva datos personales | ✅ |
| Canales de atención al titular (art. 17) | `RESPONSABLE` en `src/data/legal.ts` | ⚠️ **con datos de relleno: no son efectivos** |
| Conservación de 24 meses | Declarada en la política | ⚠️ **nada la aplica en la base de datos** |
| Registro ante el RNBD de la SIC | — | ⬜ `TODO:` evaluar si es exigible |
| Encargados del tratamiento declarados | La pasarela de pagos y el proveedor de correo deberían figurar en la política | ⚠️ `TODO:` revisar al elegir proveedores |

## Lo que falta, por orden de importancia

1. **`TODO:` Datos reales del responsable.** Hoy el NIT, la dirección, el correo
   y el teléfono de `RESPONSABLE` son marcadores. Mientras lo sean, los canales
   de atención que exige el artículo 17 **no existen**, y eso es el
   incumplimiento más claro que tiene el proyecto.
2. **`TODO:` Revisión por un abogado** de los tres documentos.
3. **`TODO:` Aplicar la retención de 24 meses** en la base de datos (pendiente
   D3 del modelo de datos).
4. **`TODO:` Declarar los encargados del tratamiento** (pasarela de pagos,
   proveedor de correo, y el de analytics o captura de errores si se elige uno)
   en la política, al decidir cada proveedor.
5. **`TODO:` Evaluar el registro ante el RNBD** de la Superintendencia de
   Industria y Comercio.
6. **`TODO:` Revisar la postura sobre supresión y respaldos**, descrita en
   [`../runbooks/backup-recovery.md`](../runbooks/backup-recovery.md) § 6.
7. **`TODO:` Consentimiento para grabar las pruebas con usuarios**
   ([`../diseno/wireframes.md`](../diseno/wireframes.md)): también es tratamiento
   de datos.
