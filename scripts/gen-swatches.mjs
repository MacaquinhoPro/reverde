/**
 * Genera las muestras de color de la guía de estilos a partir de
 * `design.tokens.mjs`, para que `docs/diseno/ui-kit.md` enseñe el color
 * *pintado* y no solo su código hexadecimal.
 *
 *   node scripts/gen-swatches.mjs
 *
 * Escribe en `docs/diseno/swatches/`:
 *   · un SVG por token (`brand-700.svg`, `risk-high.svg`…) de 64 × 22, el chip
 *     que va dentro de las tablas de Markdown;
 *   · `paleta.svg`, la lámina con la paleta completa rotulada.
 *
 * Los SVG se versionan en el repositorio a propósito: GitHub y la vista previa
 * de VS Code los pintan sin red y sin plantilla de documentación.
 *
 * Al cambiar un color en `design.tokens.mjs`, vuelve a ejecutar este script
 * (`npm run docs:swatches`) y confirma los SVG resultantes.
 */
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { colors } from '../design.tokens.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'docs/diseno/swatches');

/** Paleta aplanada: el orden es el de la guía. */
const grupos = [
  {
    titulo: 'Marca',
    muestras: Object.entries(colors.brand).map(([paso, hex]) => ({
      archivo: `brand-${paso}`,
      etiqueta: paso,
      hex,
    })),
  },
  {
    titulo: 'Texto y lienzo',
    muestras: [
      { archivo: 'ink', etiqueta: 'ink', hex: colors.ink.DEFAULT },
      { archivo: 'ink-soft', etiqueta: 'soft', hex: colors.ink.soft },
      { archivo: 'ink-faint', etiqueta: 'faint', hex: colors.ink.faint },
      { archivo: 'canvas', etiqueta: 'canvas', hex: colors.canvas },
      { archivo: 'white', etiqueta: 'white', hex: '#FFFFFF' },
    ],
  },
  {
    titulo: 'Riesgo',
    muestras: [
      { archivo: 'risk-low', etiqueta: 'bajo', hex: colors.risk.low },
      { archivo: 'risk-mid', etiqueta: 'medio', hex: colors.risk.mid },
      { archivo: 'risk-high', etiqueta: 'alto', hex: colors.risk.high },
    ],
  },
  {
    titulo: 'Gráficas',
    muestras: [
      { archivo: 'chart-ok', etiqueta: 'ok', hex: colors.chart.ok },
      { archivo: 'chart-warn', etiqueta: 'warn', hex: colors.chart.warn },
      { archivo: 'chart-bad', etiqueta: 'bad', hex: colors.chart.bad },
    ],
  },
];

const FUENTE = "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif";
const BORDE = 'rgba(28,40,34,.16)'; // deja ver los tonos muy claros sobre blanco
const TINTA = colors.ink.DEFAULT;
const TINTA_SUAVE = colors.ink.soft;

/** Luminancia relativa (WCAG) para decidir si el rótulo va blanco o verde oscuro. */
function luminancia(hex) {
  const canal = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** Rótulo del chip: el de los dos que más contrasta con el fondo. */
function sobre(hex) {
  const razon = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const l = luminancia(hex);
  return razon(l, luminancia(colors.brand[900])) >= razon(l, 1) ? colors.brand[900] : '#FFFFFF';
}

/** Chip en línea para las tablas: solo el color, el hex lo pone la tabla. */
function chip(hex) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="22" viewBox="0 0 64 22" role="img">
  <rect x=".5" y=".5" width="63" height="21" rx="6" fill="${hex}" stroke="${BORDE}"/>
</svg>
`;
}

/** Lámina con la paleta completa rotulada. */
function lamina() {
  const ANCHO_CHIP = 66;
  const ALTO_CHIP = 48;
  const HUECO = 7;
  const MARGEN = 22;
  const columnas = Math.max(...grupos.map((g) => g.muestras.length));
  const ancho = MARGEN * 2 + columnas * ANCHO_CHIP + (columnas - 1) * HUECO;
  const ALTO_GRUPO = 18 + ALTO_CHIP + 30 + 18; // título + chip + hex + aire
  const alto = MARGEN * 2 + grupos.length * ALTO_GRUPO - 18;

  let y = MARGEN;
  const piezas = [];
  for (const grupo of grupos) {
    piezas.push(
      `  <text x="${MARGEN}" y="${y + 10}" font-family="${FUENTE}" font-size="12" font-weight="700" fill="${TINTA}" letter-spacing=".04em">${grupo.titulo.toUpperCase()}</text>`,
    );
    const yChip = y + 18;
    grupo.muestras.forEach((m, i) => {
      const x = MARGEN + i * (ANCHO_CHIP + HUECO);
      piezas.push(
        `  <rect x="${x + 0.5}" y="${yChip + 0.5}" width="${ANCHO_CHIP - 1}" height="${ALTO_CHIP - 1}" rx="10" fill="${m.hex}" stroke="${BORDE}"/>`,
        `  <text x="${x + ANCHO_CHIP / 2}" y="${yChip + ALTO_CHIP / 2 + 4}" text-anchor="middle" font-family="${FUENTE}" font-size="12" font-weight="600" fill="${sobre(m.hex)}">${m.etiqueta}</text>`,
        `  <text x="${x + ANCHO_CHIP / 2}" y="${yChip + ALTO_CHIP + 16}" text-anchor="middle" font-family="${FUENTE}" font-size="10" fill="${TINTA_SUAVE}">${m.hex}</text>`,
      );
    });
    y += ALTO_GRUPO;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Paleta de color de Reverde">
  <rect width="${ancho}" height="${alto}" rx="16" fill="${colors.canvas}" stroke="${BORDE}"/>
${piezas.join('\n')}
</svg>
`;
}

mkdirSync(destino, { recursive: true });
for (const viejo of readdirSync(destino).filter((f) => f.endsWith('.svg'))) {
  rmSync(join(destino, viejo));
}

let n = 0;
for (const grupo of grupos) {
  for (const m of grupo.muestras) {
    writeFileSync(join(destino, `${m.archivo}.svg`), chip(m.hex));
    n++;
  }
}
writeFileSync(join(destino, 'paleta.svg'), lamina());

console.log(`✓ ${n} chips + paleta.svg en docs/diseno/swatches/`);
