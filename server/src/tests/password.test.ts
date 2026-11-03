import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from '../lib/password.ts';
import { decrypt, encrypt, hashIp, safeEqual, sha256 } from '../lib/crypto.ts';

describe('contraseñas con Argon2id', () => {
  it('produce un hash Argon2id, nunca texto plano', async () => {
    const hash = await hashPassword('Reverde2026');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Reverde2026');
  });

  it('usa una sal distinta por contraseña: dos hashes nunca son iguales', async () => {
    const [a, b] = await Promise.all([hashPassword('Reverde2026'), hashPassword('Reverde2026')]);
    expect(a).not.toBe(b);
    // Y ambos verifican la misma contraseña.
    expect(await verifyPassword('Reverde2026', a)).toBe(true);
    expect(await verifyPassword('Reverde2026', b)).toBe(true);
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashPassword('Reverde2026');
    expect(await verifyPassword('Reverde2026', hash)).toBe(true);
    expect(await verifyPassword('reverde2026', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('no explota con un hash corrupto: lo trata como contraseña incorrecta', async () => {
    expect(await verifyPassword('Reverde2026', 'no-es-un-hash')).toBe(false);
  });

  it('detecta hashes con parámetros más débiles que los actuales', () => {
    expect(needsRehash('$argon2id$v=19$m=1024,t=1,p=1$abc$def')).toBe(true);
    expect(needsRehash('$2b$12$bcryptlookalike')).toBe(true);
  });
});

describe('datos personales recuperables', () => {
  it('cifra y descifra el teléfono (no se hashea: hay que poder leerlo)', () => {
    const phone = '+57 300 1234567';
    const stored = encrypt(phone);
    expect(stored).not.toContain('300');
    expect(stored.startsWith('v1.')).toBe(true);
    expect(decrypt(stored)).toBe(phone);
  });

  it('dos cifrados del mismo dato dan resultados distintos (IV aleatorio)', () => {
    expect(encrypt('1234567890')).not.toBe(encrypt('1234567890'));
  });

  it('devuelve null si el dato fue manipulado (AES-GCM autentica)', () => {
    const stored = encrypt('dato sensible');
    const tampered = `${stored.slice(0, -4)}AAAA`;
    expect(decrypt(tampered)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });

  it('anonimiza la IP con sal y no la guarda en claro', () => {
    const hashed = hashIp('190.85.1.20');
    expect(hashed).not.toContain('190');
    expect(hashed).toHaveLength(32);
    expect(hashIp('190.85.1.20')).toBe(hashed);
  });

  it('compara tokens en tiempo constante', () => {
    expect(safeEqual(sha256('a'), sha256('a'))).toBe(true);
    expect(safeEqual(sha256('a'), sha256('b'))).toBe(false);
    expect(safeEqual('corto', 'muchomaslargo')).toBe(false);
  });
});
