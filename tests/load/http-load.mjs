#!/usr/bin/env node
/**
 * Prueba de carga HTTP de Reverde.
 *
 * Reverde se despliega como SPA estática (Vercel), así que lo que recibe carga
 * es la entrega del shell, los bundles y el rewrite de rutas profundas a
 * `index.html`. Este guion levanta `vite preview` sobre el build de producción
 * y lo golpea con autocannon, verificando umbrales de errores, latencia y
 * rendimiento.
 *
 * Uso:
 *   node tests/load/http-load.mjs                      # build + preview + carga
 *   node tests/load/http-load.mjs --url https://…      # contra un despliegue
 *   node tests/load/http-load.mjs --duration 30 --connections 100
 *   node tests/load/http-load.mjs --smoke               # pasada corta para CI
 *
 * Salida: tabla por escenario y código de salida 1 si algún umbral falla.
 */
import autocannon from 'autocannon';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/* ── Argumentos ─────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const SMOKE = has('smoke');
const DURATION = Number(flag('duration', SMOKE ? 5 : 15));
const CONNECTIONS = Number(flag('connections', SMOKE ? 20 : 50));
const EXTERNAL_URL = flag('url', null);

/**
 * Escenarios: rutas reales de la demo.
 * `maxLatencyP99` en ms y `minRps` son los umbrales que deben cumplirse.
 */
const SCENARIOS = [
  { name: 'Portada (shell de la SPA)', path: '/', maxLatencyP99: 400, minRps: 150 },
  { name: 'Login (ruta reescrita)', path: '/login', maxLatencyP99: 400, minRps: 150 },
  { name: 'Marketplace (ruta profunda)', path: '/tienda/explorar', maxLatencyP99: 400, minRps: 150 },
  { name: 'Panel admin (ruta protegida)', path: '/app/inventario', maxLatencyP99: 400, minRps: 150 },
  { name: 'Centro legal', path: '/legal/privacidad', maxLatencyP99: 400, minRps: 150 },
];

/* ── Utilidades ─────────────────────────────────────────────────────────── */
const sh = (cmd, cmdArgs, opts = {}) =>
  new Promise((ok, fail) => {
    const p = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', ...opts });
    p.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} salió con código ${code}`))));
    p.on('error', fail);
  });

const freePort = () =>
  new Promise((ok) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => ok(port));
    });
  });

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      /* todavía no está arriba */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`El servidor no respondió en ${url} tras ${timeoutMs / 1000} s`);
}

const run = (url) =>
  new Promise((ok, fail) => {
    autocannon(
      { url, connections: CONNECTIONS, duration: DURATION, pipelining: 1, timeout: 10 },
      (err, result) => (err ? fail(err) : ok(result)),
    );
  });

/* ── Ejecución ──────────────────────────────────────────────────────────── */
let preview = null;
let base = EXTERNAL_URL;

try {
  if (!base) {
    if (!existsSync(resolve(ROOT, 'dist/index.html'))) {
      console.log('→ No hay build de producción. Ejecutando `npm run build`…\n');
      await sh('npm', ['run', 'build']);
    }
    const port = await freePort();
    base = `http://localhost:${port}`;
    console.log(`→ Levantando \`vite preview\` en ${base}\n`);
    preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    await waitForServer(base);
  }

  console.log(`Carga HTTP sobre ${base}`);
  console.log(`${CONNECTIONS} conexiones · ${DURATION} s por escenario\n`);

  const rows = [];
  let failures = 0;

  for (const s of SCENARIOS) {
    const r = await run(`${base}${s.path}`);
    const noLlega = r.non2xx + r.errors + r.timeouts;
    const problemas = [];

    if (noLlega > 0) problemas.push(`${noLlega} respuestas no-2xx/errores`);
    if (r.latency.p99 > s.maxLatencyP99) problemas.push(`p99 ${r.latency.p99} ms > ${s.maxLatencyP99} ms`);
    if (r.requests.average < s.minRps) problemas.push(`${r.requests.average.toFixed(0)} req/s < ${s.minRps}`);
    if (problemas.length) failures++;

    rows.push({
      Escenario: s.name,
      Ruta: s.path,
      'req/s': r.requests.average.toFixed(0),
      'p50 ms': r.latency.p50,
      'p99 ms': r.latency.p99,
      'máx ms': r.latency.max,
      '2xx': r['2xx'] ?? r.requests.total - noLlega,
      Errores: noLlega,
      Estado: problemas.length ? `✗ ${problemas.join('; ')}` : '✓',
    });
  }

  console.table(rows);

  if (failures) {
    console.error(`\n✗ ${failures} escenario(s) fuera de umbral.`);
    process.exitCode = 1;
  } else {
    console.log('\n✓ Todos los escenarios dentro de los umbrales.');
  }
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  preview?.kill('SIGTERM');
}
