/**
 * Exporta el documento OpenAPI de la API a `docs/arquitectura/openapi.yaml`
 * y `openapi.json`, para poder versionarlo, revisarlo en un diff y abrirlo en
 * herramientas externas (Postman, Insomnia, generadores de cliente).
 *
 *   npm run docs:openapi
 *
 * La fuente sigue siendo `server/src/openapi.ts`: este script no inventa nada,
 * solo serializa. Si el archivo generado queda distinto del versionado, es que
 * alguien cambió la API sin regenerarlo (lo verifica la CI).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { stringify } from 'yaml';

/**
 * `openapi.ts` importa la configuración, que valida el ambiente completo y se
 * cae si falta algo. Aquí no hay servidor ni base de datos: se rellenan valores
 * de relleno para poder importar el módulo sin levantar nada.
 */
process.env.NODE_ENV ??= 'development';
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi?schema=public';
process.env.ENCRYPTION_KEY ??= Buffer.from('export-openapi-placeholder-key-32').toString('base64');
process.env.IP_HASH_SALT ??= 'export-openapi-placeholder-salt';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_YAML = resolve(ROOT, 'docs/arquitectura/openapi.yaml');
const OUT_JSON = resolve(ROOT, 'docs/arquitectura/openapi.json');

const { openApiDocument } = await import('../server/src/openapi.ts');

const header =
  '# Generado por `npm run docs:openapi` desde server/src/openapi.ts.\n' +
  '# No editar a mano: los cambios se pierden en la siguiente generación.\n';

mkdirSync(dirname(OUT_YAML), { recursive: true });
writeFileSync(OUT_YAML, header + stringify(openApiDocument, { lineWidth: 0 }), 'utf8');
writeFileSync(OUT_JSON, `${JSON.stringify(openApiDocument, null, 2)}\n`, 'utf8');

const paths = Object.keys(openApiDocument.paths ?? {}).length;
const schemas = Object.keys(openApiDocument.components?.schemas ?? {}).length;
console.log(`OpenAPI ${openApiDocument.openapi} · ${paths} rutas · ${schemas} esquemas`);
console.log(`  → ${OUT_YAML}`);
console.log(`  → ${OUT_JSON}`);
