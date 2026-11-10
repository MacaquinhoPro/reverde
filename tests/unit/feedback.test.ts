import { describe, expect, it } from 'vitest';
import { REPO, feedbackUrl, technicalContext } from '../../src/lib/feedback';

describe('contexto técnico del reporte', () => {
  it('incluye lo que hace falta para reproducir', () => {
    const ctx = technicalContext();
    expect(Object.keys(ctx)).toEqual(
      expect.arrayContaining(['Ruta', 'Pantalla', 'Navegador', 'Versión de la demo']),
    );
  });

  /**
   * La razón de ser de este archivo: el reporte sale de la aplicación hacia un
   * issue PÚBLICO de GitHub. Si alguna vez se cuela un dato personal, se
   * publica. Esta prueba es la barrera.
   */
  it('NO incluye datos personales ni el contenido del almacenamiento', () => {
    localStorage.setItem('reverde.v1.user', JSON.stringify({ email: 'sofia@ejemplo.com', name: 'Sofía' }));

    const serializado = JSON.stringify(technicalContext());

    expect(serializado).not.toContain('sofia@ejemplo.com');
    expect(serializado).not.toContain('Sofía');
    expect(serializado).not.toContain('reverde.v1.');
  });
});

describe('enlace al issue prellenado', () => {
  it('apunta al repositorio del proyecto', () => {
    expect(feedbackUrl('bug')).toContain(`https://github.com/${REPO}/issues/new`);
  });

  it('etiqueta el issue según el tipo', () => {
    expect(feedbackUrl('bug')).toContain('labels=bug');
    expect(feedbackUrl('idea')).toContain('labels=sugerencia');
  });

  it('usa una plantilla distinta para error y para sugerencia', () => {
    // `URL` decodifica el `+` como espacio; `decodeURIComponent` no.
    const bug = new URL(feedbackUrl('bug')).searchParams.get('body') ?? '';
    const idea = new URL(feedbackUrl('idea')).searchParams.get('body') ?? '';
    expect(bug).toContain('Pasos para reproducirlo');
    expect(idea).toContain('Qué te gustaría poder hacer');
    expect(idea).not.toContain('Pasos para reproducirlo');
  });

  it('respeta el título que se le pase', () => {
    const url = new URL(feedbackUrl('bug', '[Error] el carrito no suma'));
    expect(url.searchParams.get('title')).toBe('[Error] el carrito no suma');
  });

  it('deja un prefijo de título cuando no se pasa ninguno', () => {
    expect(new URL(feedbackUrl('bug')).searchParams.get('title')).toBe('[Error] ');
    expect(new URL(feedbackUrl('idea')).searchParams.get('title')).toBe('[Sugerencia] ');
  });

  it('recorta el cuerpo si se pasa de largo: mejor un issue abierto que un enlace roto', () => {
    // Un `userAgent` absurdamente largo es la vía realista de desbordar la URL.
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: 'x'.repeat(9000), configurable: true });

    const cuerpo = new URL(feedbackUrl('bug')).searchParams.get('body') ?? '';
    expect(cuerpo.length).toBeLessThanOrEqual(6100);
    expect(cuerpo).toContain('(recortado)');

    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
  });

  it('el contexto queda dentro del cuerpo del issue, no en la URL suelta', () => {
    const cuerpo = new URL(feedbackUrl('bug')).searchParams.get('body') ?? '';
    expect(cuerpo).toContain('Contexto técnico');
    expect(cuerpo).toContain('**Ruta:**');
  });
});
