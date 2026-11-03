import { Info } from 'lucide-react';
import type { LegalDocument, LegalSection } from '../../data/legal';
import { cx } from '../../lib/format';

/** Renderiza los bloques de una sección legal con tipografía de lectura. */
export function LegalBlocks({ section }: { section: LegalSection }) {
  return (
    <>
      {section.blocks.map((block, i) => {
        if (block.kind === 'note') {
          return (
            <p
              key={i}
              className="mt-3 flex gap-2.5 rounded-2xl bg-brand-50 p-3.5 text-[13.5px] leading-relaxed text-ink"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <span>{block.text}</span>
            </p>
          );
        }
        if (block.kind === 'ul' || block.kind === 'ol') {
          const List = block.kind === 'ol' ? 'ol' : 'ul';
          return (
            <List
              key={i}
              className={cx(
                'mt-3 space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-soft',
                block.kind === 'ol' ? 'list-decimal' : 'list-disc',
              )}
            >
              {block.items?.map((item) => (
                <li key={item} className="marker:text-brand-500">
                  {item}
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i} className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
            {block.text}
          </p>
        );
      })}
    </>
  );
}

export function LegalDocBody({ doc, className }: { doc: LegalDocument; className?: string }) {
  return (
    <div className={className}>
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-7 first:mt-0 scroll-mt-24">
          <h2 className="text-[16px] font-bold text-ink">{s.title}</h2>
          <LegalBlocks section={s} />
        </section>
      ))}
    </div>
  );
}
