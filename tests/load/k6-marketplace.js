/**
 * Prueba de carga con k6 (alternativa a `http-load.mjs` cuando hay k6 instalado).
 *
 *   brew install k6
 *   k6 run tests/load/k6-marketplace.js                     # contra vite preview
 *   k6 run -e BASE_URL=https://reverde.vercel.app tests/load/k6-marketplace.js
 *   k6 run -e PERFIL=pico tests/load/k6-marketplace.js      # prueba de pico
 *
 * Perfiles:
 *   humo   ·  5 usuarios,  30 s   — verificación rápida
 *   carga  · 50 usuarios,  4 min  — carga esperada en la sustentación (por defecto)
 *   pico   · 300 usuarios, 3 min  — ráfaga: ¿aguanta el CDN la clase entera?
 *   estres · hasta 600 usuarios   — busca el punto de quiebre
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
const PERFIL = __ENV.PERFIL || 'carga';

const shellLatency = new Trend('reverde_shell_latency', true);
const shellOk = new Rate('reverde_shell_ok');

const PERFILES = {
  humo: { stages: [{ duration: '30s', target: 5 }] },
  carga: [
    { duration: '30s', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  pico: [
    { duration: '20s', target: 20 },
    { duration: '10s', target: 300 },
    { duration: '2m', target: 300 },
    { duration: '30s', target: 0 },
  ],
  estres: [
    { duration: '1m', target: 100 },
    { duration: '1m', target: 300 },
    { duration: '1m', target: 600 },
    { duration: '1m', target: 0 },
  ],
};

export const options = {
  stages: Array.isArray(PERFILES[PERFIL]) ? PERFILES[PERFIL] : PERFILES.humo.stages,
  thresholds: {
    // Reverde es una SPA estática servida por CDN: estos umbrales son los que
    // debe cumplir un despliegue sano.
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    reverde_shell_ok: ['rate>0.99'],
    reverde_shell_latency: ['p(95)<800'],
    checks: ['rate>0.99'],
  },
  // Etiquetas útiles al comparar corridas en la sustentación.
  tags: { app: 'reverde', perfil: PERFIL },
};

/** Rutas que un visitante real recorre en la demo. */
const RUTAS_CLIENTE = ['/', '/login', '/tienda', '/tienda/explorar', '/tienda/mapa', '/legal/privacidad'];
const RUTAS_ADMIN = ['/app/inicio', '/app/inventario', '/app/alertas', '/app/impacto'];

export default function () {
  group('shell de la SPA', () => {
    const res = http.get(`${BASE_URL}/`, { tags: { ruta: '/' } });
    shellLatency.add(res.timings.duration);
    const ok = check(res, {
      'responde 200': (r) => r.status === 200,
      'entrega el HTML de la app': (r) => r.body && r.body.includes('<div id="root"'),
      'carga el bundle': (r) => r.body && /<script[^>]+src="[^"]+\.js"/.test(r.body),
    });
    shellOk.add(ok);
  });

  group('rutas de cliente (rewrite del SPA)', () => {
    const ruta = RUTAS_CLIENTE[Math.floor(Math.random() * RUTAS_CLIENTE.length)];
    const res = http.get(`${BASE_URL}${ruta}`, { tags: { ruta } });
    check(res, {
      'la ruta profunda devuelve el shell': (r) => r.status === 200 && r.body.includes('<div id="root"'),
    });
  });

  group('rutas de administración', () => {
    const ruta = RUTAS_ADMIN[Math.floor(Math.random() * RUTAS_ADMIN.length)];
    const res = http.get(`${BASE_URL}${ruta}`, { tags: { ruta } });
    check(res, { 'la ruta protegida también se sirve desde el CDN': (r) => r.status === 200 });
  });

  // Pausa de lectura: un usuario no pide páginas sin parar.
  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values['p(95)']?.toFixed(0);
  const fallos = (data.metrics.http_req_failed?.values.rate * 100).toFixed(2);
  return {
    stdout: `\nPerfil "${PERFIL}" sobre ${BASE_URL}\n  p95: ${p95} ms · fallos: ${fallos} %\n\n`,
    'tests/load/k6-summary.json': JSON.stringify(data, null, 2),
  };
}
