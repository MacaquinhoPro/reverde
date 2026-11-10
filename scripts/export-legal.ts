/**
 * Genera los documentos legales en Markdown desde `src/data/legal.ts`, que es
 * la fuente de verdad y lo que realmente ve la persona en la aplicación.
 *
 *   npm run docs:legal
 *
 * Se generan en vez de escribirse a mano por una razón concreta: si el texto
 * del repositorio y el de la aplicación pueden divergir, **van a divergir**, y
 * un documento legal que no coincide con lo que se mostró al titular no sirve
 * como prueba del consentimiento (Ley 1581 de 2012, art. 9).
 *
 * `npm run docs:legal:check` falla si lo versionado quedó desactualizado.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LegalDocument } from '../src/data/legal.ts';
import {
  LEGAL_INDEX,
  LEGAL_UPDATED_AT,
  LEGAL_VERSION,
  RESPONSABLE,
  RETENTION_MONTHS,
  SUBJECT_RIGHTS,
} from '../src/data/legal.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'docs/legal');

/** Nombre de archivo por documento. */
const FILES: Record<string, string> = {
  terminos: 'terminos-y-condiciones.md',
  privacidad: 'politica-privacidad.md',
  'habeas-data': 'autorizacion-habeas-data.md',
};

const AVISO = `> ## ⚠️ BORRADOR · PENDIENTE DE REVISIÓN POR UN ABOGADO
>
> Este documento es un **borrador redactado por el equipo de desarrollo**, no un
> texto validado jurídicamente. Está construido sobre la Ley 1581 de 2012, el
> Decreto 1074 de 2015 y los artículos 15 y 20 de la Constitución Política de
> Colombia, pero **no sustituye la asesoría de un profesional del derecho**.
>
> **No debe publicarse ni usarse con datos de personas reales** hasta que:
>
> 1. Un abogado con experiencia en protección de datos lo revise y apruebe.
> 2. Se completen los datos reales del responsable del tratamiento (hoy son
>    marcadores: el NIT, la dirección, el correo y el teléfono de abajo **no son
>    válidos**), lo que hace que los canales de atención al titular que exige el
>    artículo 17 de la Ley 1581 de 2012 **no sean efectivos**.
> 3. Se registre la base de datos ante la Superintendencia de Industria y
>    Comercio (RNBD), si resulta exigible según el tamaño de la organización.`;

const GENERADO = `<!-- GENERADO por \`npm run docs:legal\` desde src/data/legal.ts.
     No editar a mano: los cambios se pierden en la siguiente generación.
     Para cambiar el texto, edita src/data/legal.ts y sube LEGAL_VERSION. -->`;

/** Un bloque del documento → Markdown. */
function renderBlock(block: LegalDocument['sections'][number]['blocks'][number]): string {
  switch (block.kind) {
    case 'p':
      return block.text ?? '';
    case 'ul':
      return (block.items ?? []).map((i) => `- ${i}`).join('\n');
    case 'ol':
      return (block.items ?? []).map((i, n) => `${n + 1}. ${i}`).join('\n');
    case 'note':
      // Una nota destacada en la app se vuelve cita en Markdown.
      return (block.text ?? '')
        .split('\n')
        .map((line) => `> **${line}**`)
        .join('\n');
  }
}

function render(doc: LegalDocument): string {
  const partes = [
    GENERADO,
    '',
    `# ${doc.title}`,
    '',
    AVISO,
    '',
    `**Versión ${LEGAL_VERSION}** · Última actualización: ${LEGAL_UPDATED_AT}`,
    '',
    `*${doc.summary}*`,
    '',
    '---',
    '',
  ];

  for (const section of doc.sections) {
    partes.push(`## ${section.title}`, '');
    for (const block of section.blocks) {
      const texto = renderBlock(block);
      if (texto) partes.push(texto, '');
    }
  }

  partes.push(
    '---',
    '',
    '## Responsable del tratamiento',
    '',
    '| | |',
    '|---|---|',
    `| Razón social | ${RESPONSABLE.legalName} |`,
    `| NIT | ${RESPONSABLE.nit} ⚠️ **marcador** |`,
    `| Dirección | ${RESPONSABLE.address} ⚠️ **marcador** |`,
    `| Correo de atención al titular | ${RESPONSABLE.email} ⚠️ **marcador** |`,
    `| Teléfono | ${RESPONSABLE.phone} ⚠️ **marcador** |`,
    `| Horario de atención | ${RESPONSABLE.hours} |`,
    `| Conservación de los datos | ${RETENTION_MONTHS} meses desde la última interacción |`,
    '',
    '## Derechos del titular',
    '',
    ...SUBJECT_RIGHTS.map((r) => `- ${r}`),
    '',
    'Cómo ejercerlos en la aplicación: *Perfil → Tus datos*',
    '(`src/components/legal/DataRightsCard.tsx`), o escribiendo al correo de',
    'atención al titular.',
    '',
    `*Texto mostrado en la aplicación en \`/legal/${doc.slug}\`. Fuente:`,
    '`src/data/legal.ts`.*',
    '',
  );

  return partes.join('\n');
}

const modo = process.argv.includes('--check') ? 'check' : 'write';
mkdirSync(OUT, { recursive: true });

let desactualizados = 0;
for (const doc of LEGAL_INDEX) {
  const destino = resolve(OUT, FILES[doc.slug]);
  const contenido = render(doc);
  if (modo === 'check') {
    let actual = '';
    try {
      actual = readFileSync(destino, 'utf8');
    } catch {
      /* no existe */
    }
    if (actual !== contenido) {
      console.error(`✗ ${FILES[doc.slug]} está desactualizado respecto a src/data/legal.ts`);
      desactualizados += 1;
    }
  } else {
    writeFileSync(destino, contenido, 'utf8');
    console.log(`  → docs/legal/${FILES[doc.slug]} (${doc.sections.length} secciones)`);
  }
}

if (modo === 'check') {
  if (desactualizados > 0) {
    console.error('\nRegenera con: npm run docs:legal');
    process.exit(1);
  }
  console.log('✓ Los documentos legales coinciden con src/data/legal.ts');
} else {
  console.log(`\nVersión legal ${LEGAL_VERSION} · ${LEGAL_INDEX.length} documentos generados`);
}
