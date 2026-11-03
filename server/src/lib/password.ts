/**
 * Hashing de contraseñas con Argon2id.
 *
 * Parámetros alineados con la recomendación de OWASP (19 MiB, 2 iteraciones,
 * paralelismo 1 como mínimo viable). Aquí se usan 64 MiB y 3 iteraciones, que
 * es cómodo para una API de este tamaño. La sal la genera la librería (16
 * bytes aleatorios por contraseña) y queda embebida en el hash resultante,
 * junto con los parámetros: así se puede subir el costo más adelante sin
 * invalidar las contraseñas existentes.
 */
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { env } from '../config/env.ts';

const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  // En pruebas se baja el costo: 60 hashes a 64 MiB harían la suite inusable.
  memoryCost: env.isTest ? 8192 : 65536, // KiB
  timeCost: env.isTest ? 2 : 3,
  parallelism: 1,
  outputLen: 32,
} as const;

export const hashPassword = (plain: string): Promise<string> => hash(plain, OPTIONS);

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    return await verify(stored, plain, OPTIONS);
  } catch {
    // Hash corrupto o de otro algoritmo: se trata como contraseña incorrecta.
    return false;
  }
}

/** ¿El hash quedó con parámetros más débiles que los actuales? */
export function needsRehash(stored: string): boolean {
  const m = /\$argon2id\$v=19\$m=(\d+),t=(\d+)/.exec(stored);
  if (!m) return true;
  return Number(m[1]) < OPTIONS.memoryCost || Number(m[2]) < OPTIONS.timeCost;
}
