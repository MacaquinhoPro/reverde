## Qué cambia

<!-- Una o dos frases en lenguaje llano: qué hace diferente el producto después
     de este cambio. Si no se puede explicar así, probablemente el PR es muy grande. -->

## Por qué

<!-- El problema que resuelve. Si hay issue, enlázalo: Closes #123 -->

## Hito del plan de trabajo

<!-- Marca el que corresponda y enlaza el documento afectado. -->

- [ ] 1 · Estrategia — `docs/estrategia/`
- [ ] 2 · Diseño — `docs/diseno/`
- [ ] 3 · Arquitectura — `docs/arquitectura/`
- [ ] 4 · Desarrollo
- [ ] 5 · Calidad (QA)
- [ ] 6 · Lanzamiento
- [ ] 7 · Legal — `docs/legal/`
- [ ] Ninguno (corrección, mantenimiento o refactor)

## Tipo

- [ ] `feat` funcionalidad nueva
- [ ] `fix` corrección
- [ ] `refactor` sin cambio de comportamiento
- [ ] `docs` documentación
- [ ] `test` pruebas
- [ ] `chore` herramientas, dependencias, CI
- [ ] `perf` rendimiento

## Cómo se probó

<!-- Qué ejecutaste, no qué deberías haber ejecutado. Pega la salida si aporta. -->

```
npm run lint
npm run typecheck
npm test
```

- [ ] `npm run lint` sin errores
- [ ] `npm run typecheck` en verde
- [ ] `npm test` en verde (y pruebas nuevas si el cambio es de lógica)
- [ ] `npm run test:api` en verde (si tocaste `server/`)
- [ ] `npm run test:qa` en verde (si tocaste pantallas o flujos)
- [ ] Probado a mano en el navegador: **escritorio y móvil**

## Revisión obligatoria

- [ ] **No hay secretos** en el diff (llaves, contraseñas, tokens, `.env`)
- [ ] Las variables de entorno nuevas están en `.env.example` **y** validadas en `server/src/config/env.ts`
- [ ] Si cambió el esquema de datos: hay migración de Prisma versionada y `docs/arquitectura/modelo-datos.md` sigue siendo correcto
- [ ] Si cambió la API: `npm run docs:openapi` ejecutado y `openapi.yaml` commiteado (lo verifica `npm run docs:openapi:check`)
- [ ] Si se recogen datos personales nuevos: revisado contra `docs/legal/` y la finalidad declarada
- [ ] La documentación afectada quedó actualizada (incluido `docs/STATUS.md` si cambia el estado de un hito)

## Impacto

- [ ] Cambio que rompe compatibilidad <!-- si sí, explica la migración -->
- [ ] Afecta el flujo de pagos o de inventario <!-- si sí, exige revisión de otra persona -->
- [ ] Afecta datos personales o el consentimiento
- [ ] Afecta el rendimiento <!-- adjunta medición -->

## Capturas

<!-- Obligatorias si el cambio se ve. Escritorio y móvil. -->

## Pendientes que deja

<!-- Lo que este PR NO resuelve a propósito. Mejor escrito aquí que olvidado. -->
