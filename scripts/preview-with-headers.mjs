/**
 * Sirve `dist/` aplicando las MISMAS cabeceras que `vercel.json`, para poder
 * comprobar en local que la Content-Security-Policy no rompe la aplicación.
 *
 *   npm run build
 *   npm run preview:headers                  # http://localhost:4173
 *   QA_BASE_URL=http://localhost:4173 npm run test:qa
 *
 * Una CSP mal puesta no da error visible en el build: falla en el navegador de
 * quien entra, en producción. Las pruebas de QA que vigilan la consola sí la
 * detectan, así que esto permite probarla antes de desplegar.
 *
 * No reemplaza a `vercel dev`: emula las cabeceras y el `rewrite` del SPA, que
 * es lo que hace falta para validar la política.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');
const PORT = Number(process.env.PREVIEW_PORT ?? 4173);

const config = JSON.parse(await readFile(resolve(ROOT, 'vercel.json'), 'utf8'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Traduce el patrón de Vercel (`/assets/(.*)`) a una expresión regular. */
const toRegExp = (source) => new RegExp(`^${source.replace(/\(\.\*\)/g, '.*')}$`);

/** Todas las cabeceras de vercel.json cuyo patrón case con la ruta. */
function headersFor(pathname) {
  const out = {};
  for (const rule of config.headers ?? []) {
    if (toRegExp(rule.source).test(pathname)) {
      for (const { key, value } of rule.headers) out[key] = value;
    }
  }
  return out;
}

async function resolveFile(pathname) {
  // Nunca salir de dist/, incluso con `..` en la ruta.
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(DIST, safe);
  if (!candidate.startsWith(DIST)) return null;
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  } catch {
    /* no existe: cae al index.html, como el rewrite del SPA */
  }
  return null;
}

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const file = (await resolveFile(pathname)) ?? join(DIST, 'index.html');
  const isIndex = file.endsWith('index.html');

  try {
    const body = await readFile(file);
    // El index.html se sirve también para las rutas del SPA: las cabeceras que
    // le toquen son las de `/index.html`, no las de la ruta pedida.
    const headers = { ...headersFor(pathname), ...(isIndex ? headersFor('/index.html') : {}) };
    res.writeHead(200, {
      ...headers,
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Length': body.length,
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado. ¿Corriste `npm run build`?');
  }
});

server.listen(PORT, () => {
  const csp = headersFor('/')['Content-Security-Policy'];
  console.log(`Sirviendo dist/ con las cabeceras de vercel.json en http://localhost:${PORT}`);
  console.log(`\nContent-Security-Policy:\n  ${csp?.replace(/; /g, '\n  ') ?? '(ninguna)'}`);
  console.log(`\nPara probar la app completa contra esta política:`);
  console.log(`  QA_BASE_URL=http://localhost:${PORT} npm run test:qa\n`);
});
