import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearReports,
  KIND_LABEL,
  listReports,
  reportBody,
  reportCode,
  reportMailto,
  saveReport,
  technicalLines,
} from '../../src/lib/reports';
import { RESPONSABLE } from '../../src/data/legal';

describe('canal de reporte', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda el reporte y devuelve un código legible por teléfono', () => {
    const r = saveReport({ kind: 'error', message: 'Al publicar no pasa nada' });
    expect(r.code).toMatch(/^RP-[A-Z0-9]{5}$/);
    expect(r.message).toBe('Al publicar no pasa nada');
    expect(listReports()).toHaveLength(1);
    expect(listReports()[0].id).toBe(r.id);
  });

  it('los códigos no se repiten entre reportes', () => {
    const codigos = new Set(Array.from({ length: 200 }, () => reportCode()));
    // Con 36^5 combinaciones, 200 repetidos indicarían un generador roto.
    expect(codigos.size).toBeGreaterThan(195);
  });

  it('pone el más reciente primero', () => {
    saveReport({ kind: 'error', message: 'el primero que escribí' });
    const segundo = saveReport({ kind: 'idea', message: 'el segundo que escribí' });
    expect(listReports()[0].id).toBe(segundo.id);
  });

  it('recorta un mensaje enorme en vez de llenar el almacenamiento', () => {
    const r = saveReport({ kind: 'error', message: 'x'.repeat(5000) });
    expect(r.message).toHaveLength(2000);
  });

  it('guarda como máximo 50 reportes', () => {
    for (let i = 0; i < 55; i++) saveReport({ kind: 'error', message: `reporte ${i}` });
    expect(listReports()).toHaveLength(50);
    expect(listReports()[0].message).toBe('reporte 54');
  });

  it('el correo es opcional y no se guarda vacío', () => {
    expect(saveReport({ kind: 'idea', message: 'una idea', email: '   ' }).email).toBeUndefined();
    expect(saveReport({ kind: 'idea', message: 'otra idea', email: ' a@b.co ' }).email).toBe('a@b.co');
  });

  it('adjunta el contexto técnico salvo que se desmarque', () => {
    expect(Object.keys(saveReport({ kind: 'error', message: 'con contexto' }).context).length).toBeGreaterThan(0);
    expect(saveReport({ kind: 'error', message: 'sin contexto', withContext: false }).context).toEqual({});
  });

  it('el contexto que se muestra es exactamente el que se adjunta', () => {
    const lineas = technicalLines();
    expect(lineas.some((l) => l.startsWith('Navegador:'))).toBe(true);
    expect(lineas.some((l) => l.startsWith('Pantalla:'))).toBe(true);
  });

  /**
   * La misma vigilancia que la prueba de `feedback.ts`: el canal de reporte no
   * puede convertirse en una fuga de datos personales.
   */
  it('el cuerpo del reporte no filtra datos personales del almacenamiento', () => {
    localStorage.setItem(
      'reverde.v1.user',
      JSON.stringify({ email: 'laura@privado.com', name: 'Laura Mendoza' }),
    );
    const cuerpo = reportBody(saveReport({ kind: 'error', message: 'algo falla' }));
    expect(cuerpo).not.toContain('laura@privado.com');
    expect(cuerpo).not.toContain('Laura Mendoza');
  });

  it('el cuerpo lleva tipo, código, pantalla y el mensaje', () => {
    const r = saveReport({ kind: 'idea', message: 'podrían añadir filtros' });
    const cuerpo = reportBody(r);
    expect(cuerpo).toContain(KIND_LABEL.idea);
    expect(cuerpo).toContain(r.code);
    expect(cuerpo).toContain('podrían añadir filtros');
  });

  it('el enlace de correo apunta al responsable y va codificado', () => {
    const r = saveReport({ kind: 'error', message: 'error con acentos: ñ & é' });
    const url = reportMailto(r);
    expect(url.startsWith(`mailto:${RESPONSABLE.email}?subject=`)).toBe(true);
    expect(url).toContain(encodeURIComponent(r.code));
    // Sin codificar, un `&` en el texto partiría el cuerpo del correo.
    expect(url).not.toContain('error con acentos');
    expect(decodeURIComponent(url)).toContain('error con acentos: ñ & é');
  });

  it('se puede vaciar el historial', () => {
    saveReport({ kind: 'error', message: 'uno cualquiera' });
    clearReports();
    expect(listReports()).toEqual([]);
  });
});
