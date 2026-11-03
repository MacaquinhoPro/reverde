import { env } from '../../config/env.ts';
import { mockAdapter } from './mock.ts';
import { wompiAdapter } from './wompi.ts';
import type { PaymentProviderAdapter } from './provider.ts';

/** Pasarela activa según la configuración del ambiente. */
export const gateway = (): PaymentProviderAdapter =>
  env.PAYMENTS_PROVIDER === 'wompi' ? wompiAdapter : mockAdapter;
