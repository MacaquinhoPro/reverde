import { describe, expect, it, vi } from 'vitest';
import { RetryableHttpError, withRetry } from '../lib/retry.ts';

/** Esperas de 1 ms: la prueba verifica la política, no el reloj. */
const fast = { baseDelayMs: 1, maxDelayMs: 2 };

describe('reintentos con retroceso exponencial', () => {
  it('no reintenta cuando la operación funciona al primer intento', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { operation: 'prueba', ...fast })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta un fallo de red y devuelve el resultado del reintento', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue('ok a la segunda');
    await expect(withRetry(fn, { operation: 'prueba', ...fast })).resolves.toBe('ok a la segunda');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reintenta un 5xx del proveedor', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableHttpError('502', 502))
      .mockResolvedValue('recuperado');
    await expect(withRetry(fn, { operation: 'prueba', ...fast })).resolves.toBe('recuperado');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reintenta un 429 (límite de peticiones del proveedor)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new RetryableHttpError('429', 429)).mockResolvedValue('ok');
    await expect(withRetry(fn, { operation: 'prueba', ...fast })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('NO reintenta un 4xx: la petición está mal y repetirla no la arregla', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableHttpError('404', 404));
    await expect(withRetry(fn, { operation: 'prueba', ...fast })).rejects.toThrow('404');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('NO reintenta un error de programación', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('x is not a function'));
    await expect(withRetry(fn, { operation: 'prueba', ...fast })).rejects.toThrow(TypeError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta un timeout', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    const fn = vi.fn().mockRejectedValueOnce(timeout).mockResolvedValue('ok');
    await expect(withRetry(fn, { operation: 'prueba', ...fast })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respeta el número de intentos y propaga el último error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(withRetry(fn, { operation: 'prueba', attempts: 4, ...fast })).rejects.toThrow('ECONNRESET');
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('pasa el número de intento a la función, para poder registrarlo', async () => {
    const seen: number[] = [];
    const fn = vi.fn(async (attempt: number) => {
      seen.push(attempt);
      if (attempt < 3) throw new Error('ETIMEDOUT');
      return 'ok';
    });
    await expect(withRetry(fn, { operation: 'prueba', ...fast })).resolves.toBe('ok');
    expect(seen).toEqual([1, 2, 3]);
  });

  it('admite una política de reintento propia', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('error de negocio'));
    await expect(
      withRetry(fn, { operation: 'prueba', attempts: 3, ...fast, isRetryable: () => true }),
    ).rejects.toThrow('error de negocio');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
