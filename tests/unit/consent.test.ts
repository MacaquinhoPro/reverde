import { describe, expect, it, vi } from 'vitest';
import {
  buildConsent,
  clearConsent,
  currentEvidence,
  isConsentValid,
  loadConsent,
  saveConsent,
  type ConsentRecord,
} from '../../src/lib/consent';
import { LEGAL_VERSION } from '../../src/data/legal';

const KEY = 'reverde.legal.consent';
const choices = { terms: true, dataProcessing: true, marketing: false };

describe('buildConsent', () => {
  it('registra versión, fecha y las tres finalidades', () => {
    const record = buildConsent({ terms: true, dataProcessing: true, marketing: true });
    expect(record.version).toBe(LEGAL_VERSION);
    expect(Number.isNaN(new Date(record.acceptedAt).getTime())).toBe(false);
    expect(record).toMatchObject({ terms: true, dataProcessing: true, marketing: true });
  });

  it('guarda la huella del contexto como soporte de la prueba', () => {
    const record = buildConsent(choices);
    expect(record.evidence.userAgent.length).toBeGreaterThan(0);
    expect(record.evidence.language.length).toBeGreaterThan(0);
    expect(record.evidence.path.startsWith('/')).toBe(true);
  });

  it('identifica al titular cuando ya hay sesión', () => {
    const record = buildConsent(choices, { userId: 'u-cli-1', email: 'cliente1@reverde.com' });
    expect(record.subject).toEqual({ userId: 'u-cli-1', email: 'cliente1@reverde.com' });
  });

  it('abre la bitácora con un evento "otorgado"', () => {
    const record = buildConsent(choices);
    expect(record.log).toHaveLength(1);
    expect(record.log[0]).toMatchObject({ action: 'otorgado', version: LEGAL_VERSION });
    expect(record.log[0].detail).toContain('Términos: sí');
    expect(record.log[0].detail).toContain('Comunicaciones comerciales: no');
  });

  it('al reautorizar conserva la bitácora y marca "actualizado"', () => {
    const previo = buildConsent(choices);
    const nuevo = buildConsent({ ...choices, marketing: true }, undefined, previo);
    expect(nuevo.log).toHaveLength(2);
    expect(nuevo.log[0].action).toBe('otorgado');
    expect(nuevo.log[1].action).toBe('actualizado');
    expect(nuevo.log[1].detail).toContain('Comunicaciones comerciales: sí');
  });
});

describe('isConsentValid', () => {
  it('exige las dos casillas obligatorias', () => {
    expect(isConsentValid(buildConsent({ terms: true, dataProcessing: true, marketing: false }))).toBe(true);
    expect(isConsentValid(buildConsent({ terms: false, dataProcessing: true, marketing: true }))).toBe(false);
    expect(isConsentValid(buildConsent({ terms: true, dataProcessing: false, marketing: true }))).toBe(false);
  });

  it('invalida el consentimiento de una versión legal anterior', () => {
    const viejo: ConsentRecord = { ...buildConsent(choices), version: '0.9' };
    expect(isConsentValid(viejo)).toBe(false);
  });

  it('null no es consentimiento', () => {
    expect(isConsentValid(null)).toBe(false);
  });
});

describe('loadConsent / saveConsent / clearConsent', () => {
  it('persiste bajo su propia clave, fuera del prefijo de la demo', () => {
    saveConsent(buildConsent(choices));
    expect(localStorage.getItem(KEY)).toBeTruthy();
    expect(Object.keys(localStorage).some((k) => k.startsWith('reverde.v1.'))).toBe(false);
  });

  it('recupera el registro guardado', () => {
    const record = buildConsent(choices, { email: 'cliente1@reverde.com' });
    saveConsent(record);
    expect(loadConsent()).toEqual(record);
  });

  it('sin registro previo devuelve null', () => {
    expect(loadConsent()).toBeNull();
  });

  it('tolera un registro corrupto o no objeto', () => {
    localStorage.setItem(KEY, '{roto');
    expect(loadConsent()).toBeNull();
    localStorage.setItem(KEY, 'null');
    expect(loadConsent()).toBeNull();
  });

  it('normaliza una bitácora ausente a arreglo vacío', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: LEGAL_VERSION, terms: true, dataProcessing: true }));
    expect(loadConsent()!.log).toEqual([]);
  });

  it('clearConsent elimina la prueba del consentimiento', () => {
    saveConsent(buildConsent(choices));
    clearConsent();
    expect(loadConsent()).toBeNull();
  });

  it('no lanza cuando el almacenamiento no está disponible', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => saveConsent(buildConsent(choices))).not.toThrow();
    setItem.mockRestore();

    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => clearConsent()).not.toThrow();
    removeItem.mockRestore();
  });
});

describe('currentEvidence', () => {
  it('describe el contexto del navegador y la ruta', () => {
    const e = currentEvidence();
    expect(e).toHaveProperty('userAgent');
    expect(e).toHaveProperty('language');
    expect(e.path).toBe(window.location.pathname);
  });
});
