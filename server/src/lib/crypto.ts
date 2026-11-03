/**
 * Primitivas criptográficas.
 *
 * Tres usos distintos que **no** se deben confundir:
 *  1. Contraseñas  → Argon2id (hash lento, irreversible). Ver password.ts.
 *  2. Datos personales que el negocio necesita leer de vuelta (teléfono,
 *     documento) → cifrado simétrico AES-256-GCM, reversible con la llave.
 *  3. Identificadores de búsqueda y bitácoras (tokens de sesión, IP) →
 *     SHA-256 con sal, rápido y suficiente para comparar o anonimizar.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.ts';

/** Deriva una llave de 32 bytes del secreto configurado. */
function key(): Buffer {
  const raw = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  return raw.length === 32 ? raw : createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

/** Cifra un dato personal recuperable. Formato: v1.iv.tag.ciphertext (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Token opaco de alta entropía (sesiones, verificación de correo). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** Huella de un token: es lo único que se guarda en la base de datos. */
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** IP anonimizada para auditoría: no se guarda la dirección en claro. */
export const hashIp = (ip?: string | null): string | null =>
  ip ? createHash('sha256').update(`${env.IP_HASH_SALT}:${ip}`).digest('hex').slice(0, 32) : null;

/** Comparación en tiempo constante de dos cadenas hexadecimales o base64. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Muestra los últimos dígitos de un dato cifrado sin revelarlo entero. */
export const maskTail = (value: string | null, visible = 4): string | null =>
  value ? `${'•'.repeat(Math.max(0, value.length - visible))}${value.slice(-visible)}` : null;
