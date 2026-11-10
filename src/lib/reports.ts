/**
 * Canal de reporte de errores del usuario.
 *
 * El canal que había antes abría un issue de GitHub. Eso sirve para quien
 * programa, pero **la persona que usa la aplicación —el administrador de un
 * supermercado, alguien comprando pan— no tiene cuenta de GitHub**, así que en
 * la práctica no tenía dónde reportar nada.
 *
 * Este módulo recoge el reporte dentro de la propia aplicación: se guarda, se
 * devuelve un código de seguimiento, y desde ahí la persona elige cómo
 * hacerlo llegar (correo prellenado o, si sabe, GitHub).
 *
 * Privacidad: el reporte lleva el contexto técnico de `feedback.ts`, que está
 * probado para no filtrar datos personales. El correo de contacto es opcional
 * y lo escribe quien reporta, sabiendo para qué es.
 */
import { load, save } from './storage';
import { technicalContext } from './feedback';
import { RESPONSABLE } from '../data/legal';

export type ReportKind = 'error' | 'idea';

export interface Report {
  id: string;
  /** Código corto que se le muestra a la persona para dar seguimiento. */
  code: string;
  kind: ReportKind;
  /** Lo que escribió, tal cual. */
  message: string;
  /** Opcional: solo si quiere respuesta. */
  email?: string;
  /** Ruta de la aplicación donde estaba. */
  path: string;
  createdAt: string;
  /** Navegador, tamaño de pantalla, versión. Nunca datos personales. */
  context: Record<string, string>;
}

const KEY = 'reports';
/** Tope para no llenar el almacenamiento del navegador. */
const MAX = 50;

export const KIND_LABEL: Record<ReportKind, string> = {
  error: 'Algo no funciona',
  idea: 'Una idea para mejorar',
};

/** `RP-` y cinco caracteres: corto de leer en voz alta por teléfono. */
export const reportCode = (): string =>
  'RP-' + Math.random().toString(36).slice(2, 7).toUpperCase();

export function listReports(): Report[] {
  return load<Report[]>(KEY, []);
}

/**
 * Guarda el reporte y devuelve el registro con su código.
 *
 * El mensaje se recorta a 2000 caracteres: más que eso no es un reporte, y
 * `localStorage` tiene un límite que no conviene agotar.
 */
export function saveReport(input: {
  kind: ReportKind;
  message: string;
  email?: string;
  withContext?: boolean;
}): Report {
  const report: Report = {
    id: `rep_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    code: reportCode(),
    kind: input.kind,
    message: input.message.trim().slice(0, 2000),
    email: input.email?.trim() || undefined,
    path: typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search,
    createdAt: new Date().toISOString(),
    context: input.withContext === false ? {} : technicalContext(),
  };

  save(KEY, [report, ...listReports()].slice(0, MAX));
  return report;
}

/** Borra el historial local de reportes (el perfil lo ofrece). */
export function clearReports(): void {
  save(KEY, []);
}

/**
 * El contexto técnico en forma de líneas legibles, para enseñarle a la persona
 * exactamente qué se adjunta antes de que lo adjunte. Un «contexto técnico»
 * que no se puede mirar es pedirle a alguien que firme en blanco.
 */
export function technicalLines(): string[] {
  return Object.entries(technicalContext()).map(([k, v]) => `${k}: ${v}`);
}

/** Cuerpo del reporte en texto plano, el mismo para el correo y para GitHub. */
export function reportBody(report: Report): string {
  const lineas = [
    `Tipo: ${KIND_LABEL[report.kind]}`,
    `Código: ${report.code}`,
    `Pantalla: ${report.path}`,
    '',
    report.message,
  ];

  const contexto = Object.entries(report.context);
  if (contexto.length > 0) {
    lineas.push('', '--- Contexto técnico (sin datos personales) ---');
    for (const [k, v] of contexto) lineas.push(`${k}: ${v}`);
  }
  return lineas.join('\n');
}

/**
 * Enlace `mailto:` ya escrito, que es la vía que funciona para cualquiera: no
 * exige cuenta en ningún lado y abre la aplicación de correo del teléfono.
 */
export function reportMailto(report: Report): string {
  const asunto = `[Reverde ${report.code}] ${report.kind === 'error' ? 'Error' : 'Idea'}`;
  return (
    `mailto:${RESPONSABLE.email}` +
    `?subject=${encodeURIComponent(asunto)}` +
    `&body=${encodeURIComponent(reportBody(report))}`
  );
}
