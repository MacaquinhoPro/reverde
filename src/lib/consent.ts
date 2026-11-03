/**
 * Registro del consentimiento de habeas data.
 *
 * La Ley 1581 de 2012 exige poder probar que el titular autorizó el
 * tratamiento: guardamos la versión del documento aceptado, la fecha y hora,
 * qué finalidades aceptó y una huella mínima del contexto (navegador y ruta).
 *
 * Se almacena bajo su propio prefijo, fuera de `reverde.v1.`, para que ni el
 * resembrado de la demo ni «Reiniciar datos» borren la prueba del
 * consentimiento: solo la revocatoria explícita del titular la elimina.
 */

import { LEGAL_VERSION } from '../data/legal';

const KEY = 'reverde.legal.consent';

export interface ConsentRecord {
  /** Versión del paquete legal aceptado. */
  version: string;
  /** Fecha y hora de la aceptación (ISO 8601). */
  acceptedAt: string;
  /** Términos y condiciones. Obligatorio. */
  terms: boolean;
  /** Autorización de tratamiento de datos (habeas data). Obligatorio. */
  dataProcessing: boolean;
  /** Comunicaciones comerciales. Opcional y revocable por separado. */
  marketing: boolean;
  /** Titular identificado, si ya había sesión al momento de autorizar. */
  subject?: { userId?: string; email?: string };
  /** Contexto de la manifestación de voluntad, como soporte de la prueba. */
  evidence: { userAgent: string; language: string; path: string };
  /** Historial de cambios al consentimiento (otorgado, modificado, revocado). */
  log: ConsentEvent[];
}

export interface ConsentEvent {
  at: string;
  action: 'otorgado' | 'actualizado' | 'revocado';
  detail: string;
  version: string;
}

export interface ConsentChoices {
  terms: boolean;
  dataProcessing: boolean;
  marketing: boolean;
}

/** Huella del contexto en el que se otorgó la autorización. */
export function currentEvidence(): ConsentRecord['evidence'] {
  return {
    userAgent: typeof navigator === 'undefined' ? 'desconocido' : navigator.userAgent,
    language: typeof navigator === 'undefined' ? 'es-CO' : navigator.language,
    path: typeof window === 'undefined' ? '/' : window.location.pathname,
  };
}

export function loadConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...parsed, log: Array.isArray(parsed.log) ? parsed.log : [] };
  } catch {
    return null;
  }
}

export function saveConsent(record: ConsentRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* almacenamiento no disponible: el consentimiento solo vive en memoria */
  }
}

export function clearConsent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * Un consentimiento sirve si cubre las dos autorizaciones obligatorias y se
 * otorgó sobre la versión vigente de los documentos. Si la versión cambió,
 * hay que volver a preguntar.
 */
export function isConsentValid(record: ConsentRecord | null): record is ConsentRecord {
  return Boolean(
    record && record.terms && record.dataProcessing && record.version === LEGAL_VERSION,
  );
}

export function buildConsent(
  choices: ConsentChoices,
  subject?: ConsentRecord['subject'],
  previous?: ConsentRecord | null,
): ConsentRecord {
  const at = new Date().toISOString();
  const log = previous?.log ?? [];
  return {
    version: LEGAL_VERSION,
    acceptedAt: at,
    terms: choices.terms,
    dataProcessing: choices.dataProcessing,
    marketing: choices.marketing,
    subject,
    evidence: currentEvidence(),
    log: [
      ...log,
      {
        at,
        action: previous ? 'actualizado' : 'otorgado',
        detail: `Términos: ${yn(choices.terms)} · Tratamiento de datos: ${yn(choices.dataProcessing)} · Comunicaciones comerciales: ${yn(choices.marketing)}`,
        version: LEGAL_VERSION,
      },
    ],
  };
}

const yn = (v: boolean) => (v ? 'sí' : 'no');
