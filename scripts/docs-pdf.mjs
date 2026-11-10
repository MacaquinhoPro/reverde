/**
 * Exporta toda la documentación de `docs/` (y el README) a PDF.
 *
 *   npm run docs:pdf
 *
 * Produce en `docs/pdf/`:
 *   · un PDF por documento, con el mismo nombre que el `.md`;
 *   · `reverde-documentacion.pdf`, el compendio con portada e índice y los 26
 *     documentos en el orden del plan de trabajo.
 *
 * Cómo funciona: Markdown → HTML (markdown-it) → Chromium (el de Playwright,
 * ya instalado para las pruebas E2E) → PDF. Los diagramas ```mermaid se pintan
 * en la página antes de imprimir y las muestras de color de `ui-kit.md` entran
 * como imágenes reales, porque un servidor estático sirve el repositorio
 * mientras se imprime. La hoja de estilos usa los tokens de
 * `design.tokens.mjs`: el PDF se ve como el producto.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { chromium } from 'playwright';
import { colors, fontFamily } from '../design.tokens.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const salida = join(raiz, 'docs/pdf');

/* ───────────────────────── Orden del compendio ─────────────────────────── */
/** Las fases son las del plan de trabajo; el README las lista igual. */
const fases = [
  {
    fase: 'Resumen',
    docs: ['README.md', 'docs/STATUS.md', 'docs/PENDIENTES.md', 'docs/SUSTENTACION.md'],
  },
  {
    fase: 'Estrategia',
    docs: [
      'docs/estrategia/problema-solucion.md',
      'docs/estrategia/buyer-persona.md',
      'docs/estrategia/uvp.md',
      'docs/estrategia/mvp-moscow.md',
    ],
  },
  {
    fase: 'Diseño',
    docs: ['docs/diseno/user-flow.md', 'docs/diseno/wireframes.md', 'docs/diseno/ui-kit.md'],
  },
  {
    fase: 'Arquitectura',
    docs: [
      'docs/arquitectura/stack.md',
      'docs/arquitectura/modelo-datos.md',
      'docs/arquitectura/api.md',
      'docs/arquitectura/seguridad.md',
    ],
  },
  { fase: 'Desarrollo', docs: ['docs/integraciones.md'] },
  {
    fase: 'Calidad',
    docs: ['docs/TESTING.md', 'docs/QA-PLAN.md', 'docs/qa/interfaz.md', 'docs/qa/carga.md'],
  },
  {
    fase: 'Lanzamiento',
    docs: ['docs/analytics.md', 'docs/runbooks/despliegue.md', 'docs/runbooks/backup-recovery.md'],
  },
  {
    fase: 'Legal',
    docs: [
      'docs/legal/README.md',
      'docs/legal/politica-privacidad.md',
      'docs/legal/terminos-y-condiciones.md',
      'docs/legal/autorizacion-habeas-data.md',
    ],
  },
];

const documentos = fases.flatMap(({ fase, docs }) =>
  docs.map((ruta) => {
    const absoluta = join(raiz, ruta);
    if (!existsSync(absoluta)) throw new Error(`No existe ${ruta} (revisa la lista de este script)`);
    const fuente = readFileSync(absoluta, 'utf8');
    const titulo = (fuente.match(/^#\s+(.+)$/m)?.[1] ?? ruta).replace(/\s*[·|].*$/, '').trim();
    return {
      ruta,
      absoluta,
      fuente,
      fase,
      titulo,
      // README.md vive en la raíz; el resto conserva su ruta bajo docs/.
      destino: join(salida, `${ruta.replace(/^docs\//, '').replace(/\//g, '-').replace(/\.md$/, '')}.pdf`),
      ancla: ruta.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    };
  }),
);

/* ───────────────────────────── Markdown → HTML ─────────────────────────── */
const porRuta = new Map(documentos.map((d) => [d.ruta, d]));

function crearMd({ modo, docActual }) {
  const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

  // Los bloques ```mermaid no son código: son diagramas que Chromium pinta.
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const token = tokens[i];
    if (token.info.trim().toLowerCase() === 'mermaid') {
      return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`;
    }
    return fence(tokens, i, opts, env, self);
  };

  /** Ruta de repositorio (`docs/diseno/swatches/x.svg`) para un enlace relativo. */
  const aRutaRepo = (href) => relative(raiz, resolve(dirname(docActual.absoluta), href)).replace(/\\/g, '/');

  // Las imágenes se sirven desde el servidor estático, con ruta absoluta.
  const imagen = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, i, opts, env, self) => {
    const src = tokens[i].attrGet('src');
    if (src && !/^(https?:|data:|\/)/.test(src)) tokens[i].attrSet('src', `/${aRutaRepo(src)}`);
    return imagen(tokens, i, opts, env, self);
  };

  // Los enlaces entre documentos apuntan al PDF hermano (sueltos) o al ancla
  // interna (compendio). Lo que sale del repositorio se queda como está.
  const defaultLink =
    md.renderer.rules.link_open ?? ((t, i, o, _e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, i, opts, env, self) => {
    const href = tokens[i].attrGet('href');
    if (href && !/^(https?:|mailto:|#)/.test(href)) {
      const [ruta, ancla] = href.split('#');
      const repo = ruta ? aRutaRepo(ruta) : docActual.ruta;
      const destino = porRuta.get(repo);
      if (destino && modo === 'compendio') {
        tokens[i].attrSet('href', `#${destino.ancla}`);
      } else if (destino) {
        tokens[i].attrSet('href', relative(salida, destino.destino));
      } else {
        // Archivo del repositorio que no se exporta (código, YAML, SQL…).
        tokens[i].attrSet('href', `https://github.com/MacaquinhoPro/reverde/blob/main/${repo}${ancla ? `#${ancla}` : ''}`);
        tokens[i].attrSet('class', 'enlace-repo');
      }
    }
    return defaultLink(tokens, i, opts, env, self);
  };

  return md;
}

const render = (doc, modo) => crearMd({ modo, docActual: doc }).render(doc.fuente);

/* ──────────────────────────────── Estilos ──────────────────────────────── */
const fuente = fontFamily.sans.join(', ');
const css = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: ${fuente}; font-size: 10.5pt; line-height: 1.55;
    color: ${colors.ink.DEFAULT}; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1, h2, h3, h4 { letter-spacing: -.02em; line-height: 1.2; break-after: avoid; }
  h1 { font-size: 21pt; margin: 0 0 .6em; color: ${colors.brand[700]}; }
  h2 {
    font-size: 15pt; margin: 1.8em 0 .5em; padding-bottom: .25em;
    border-bottom: 1.5px solid ${colors.brand[200]};
  }
  h3 { font-size: 12pt; margin: 1.4em 0 .4em; color: ${colors.brand[800]}; }
  h4 { font-size: 10.5pt; margin: 1.2em 0 .3em; color: ${colors.ink.soft}; }
  p, ul, ol { margin: 0 0 .7em; }
  li { margin-bottom: .22em; }
  a { color: ${colors.brand[700]}; text-decoration: none; border-bottom: .5px solid ${colors.brand[300]}; }
  code {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: .86em; background: ${colors.brand[50]}; color: ${colors.brand[900]};
    padding: .1em .35em; border-radius: 4px; border: .5px solid ${colors.brand[100]};
  }
  pre {
    background: ${colors.brand[50]}; border: .5px solid ${colors.brand[100]};
    border-radius: 10px; padding: .8em 1em; overflow: hidden;
    white-space: pre-wrap; word-break: break-word; font-size: 8.6pt; line-height: 1.45;
    break-inside: avoid;
  }
  pre code { background: none; border: 0; padding: 0; font-size: 1em; }
  blockquote {
    margin: .9em 0; padding: .55em .9em; background: ${colors.brand[50]};
    border-left: 3px solid ${colors.brand[400]}; border-radius: 0 8px 8px 0;
  }
  blockquote > :last-child { margin-bottom: 0; }
  table {
    width: 100%; border-collapse: collapse; margin: .9em 0; font-size: 8.8pt;
    break-inside: auto;
  }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td {
    border: .5px solid ${colors.brand[200]}; padding: .42em .55em;
    text-align: left; vertical-align: top;
  }
  th { background: ${colors.brand[100]}; color: ${colors.brand[900]}; font-weight: 600; }
  tbody tr:nth-child(even) { background: ${colors.brand[50]}; }
  td code { font-size: .92em; }
  img { max-width: 100%; }
  td img { vertical-align: middle; }
  hr { border: 0; border-top: .5px solid ${colors.brand[200]}; margin: 1.6em 0; }
  .mermaid { background: none; border: 0; padding: 0; text-align: center; break-inside: avoid; }
  /* Un diagrama alto se encoge para caber en la página en vez de partirse. */
  .mermaid svg { max-width: 100%; max-height: 225mm; height: auto; }

  /* Compendio */
  .doc { break-before: page; }
  .doc:first-of-type { break-before: auto; }
  .fase {
    font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: ${colors.brand[500]}; margin-bottom: .4em;
  }
  .portada {
    height: 247mm; display: flex; flex-direction: column; justify-content: center;
    text-align: center; break-after: page;
  }
  .portada img { width: 76px; height: 76px; margin: 0 auto 1.2em; }
  .portada h1 { font-size: 34pt; margin: 0 0 .15em; border: 0; }
  .portada .lema { font-size: 13pt; color: ${colors.ink.soft}; margin-bottom: 2.4em; }
  .portada .meta { font-size: 9.5pt; color: ${colors.ink.faint}; }
  .indice { break-after: page; }
  .indice ol { list-style: none; padding: 0; margin: 0; }
  .indice > ol > li { margin-bottom: 1.1em; }
  .indice .grupo {
    font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: ${colors.brand[500]}; border-bottom: .5px solid ${colors.brand[200]};
    padding-bottom: .25em; margin-bottom: .45em;
  }
  .indice ol ol li { padding: .12em 0; }
  .indice a { border: 0; color: ${colors.ink.DEFAULT}; }
`;

const pagina = (titulo, cuerpo) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>${css}</style></head>
<body>${cuerpo}
<script src="/node_modules/mermaid/dist/mermaid.min.js"></script>
<script>
  window.__mermaidListo = (async () => {
    if (!document.querySelector('.mermaid')) return;
    mermaid.initialize({
      startOnLoad: false, theme: 'base', fontFamily: ${JSON.stringify(fuente)},
      themeVariables: {
        primaryColor: '${colors.brand[100]}', primaryBorderColor: '${colors.brand[700]}',
        primaryTextColor: '${colors.ink.DEFAULT}', lineColor: '${colors.brand[600]}',
        secondaryColor: '${colors.brand[50]}', tertiaryColor: '#fff',
        fontSize: '13px',
      },
      flowchart: { useMaxWidth: true }, er: { useMaxWidth: true }, sequence: { useMaxWidth: true },
    });
    await mermaid.run({ querySelector: '.mermaid' });
  })();
</script>
</body></html>`;

/* ─────────────── Servidor estático: el repo mientras se imprime ────────── */
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json',
};
const paginas = new Map(); // id → html

const servidor = createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (paginas.has(ruta)) {
    res.writeHead(200, { 'content-type': tipos['.html'] });
    return res.end(paginas.get(ruta));
  }
  const archivo = join(raiz, ruta);
  if (!archivo.startsWith(raiz) || !existsSync(archivo) || !statSync(archivo).isFile()) {
    res.writeHead(404).end('no');
    return;
  }
  res.writeHead(200, { 'content-type': tipos[extname(archivo)] ?? 'application/octet-stream' });
  createReadStream(archivo).pipe(res);
});

await new Promise((ok) => servidor.listen(0, 'localhost', ok));
const puerto = servidor.address().port;

/* ──────────────────────────────── Impresión ────────────────────────────── */
const pie = (etiqueta) => `
  <div style="width:100%;font-family:${fuente};font-size:7pt;color:${colors.ink.faint};
              padding:0 16mm;display:flex;justify-content:space-between;">
    <span>${etiqueta}</span>
    <span>pág. <span class="pageNumber"></span></span>
  </div>`;

mkdirSync(salida, { recursive: true });
const navegador = await chromium.launch();
const page = await navegador.newPage();

async function imprimir(id, html, destino, etiquetaPie) {
  paginas.set(id, html);
  await page.goto(`http://localhost:${puerto}${id}`, { waitUntil: 'load' });
  await page.evaluate(() => window.__mermaidListo);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: destino, format: 'A4', printBackground: true,
    margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: pie(etiquetaPie),
  });
  paginas.delete(id);
}

for (const [i, doc] of documentos.entries()) {
  const cuerpo = `<div class="fase">${doc.fase}</div>${render(doc, 'suelto')}`;
  await imprimir(`/__render/${i}.html`, pagina(doc.titulo, cuerpo), doc.destino, `Reverde · ${doc.ruta}`);
  console.log(`  ✓ ${relative(raiz, doc.destino)}`);
}

const hoy = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const portada = `
<div class="portada">
  <img src="/public/reverde.svg" alt="">
  <h1>Reverde</h1>
  <div class="lema">Documentación del proyecto</div>
  <div class="meta">${documentos.length} documentos · ${hoy}</div>
</div>
<div class="indice">
  <h1>Índice</h1>
  <ol>${fases
    .map(
      (f) => `<li><div class="grupo">${f.fase}</div><ol>${f.docs
        .map((r) => {
          const d = porRuta.get(r);
          return `<li><a href="#${d.ancla}">${d.titulo}</a></li>`;
        })
        .join('')}</ol></li>`,
    )
    .join('')}</ol>
</div>`;

const compendio = documentos
  .map((doc) => `<section class="doc" id="${doc.ancla}"><div class="fase">${doc.fase}</div>${render(doc, 'compendio')}</section>`)
  .join('\n');

const destinoCompendio = join(salida, 'reverde-documentacion.pdf');
await imprimir('/__render/compendio.html', pagina('Reverde · documentación', portada + compendio), destinoCompendio, 'Reverde · documentación del proyecto');
console.log(`  ✓ ${relative(raiz, destinoCompendio)}`);

await navegador.close();
servidor.close();
console.log(`\n${documentos.length} PDF + compendio en docs/pdf/`);
