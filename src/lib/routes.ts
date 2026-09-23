import type { Role } from '../types';

export const homeForRole = (role: Role): string =>
  role === 'cliente' ? '/tienda' : role === 'superadmin' ? '/admin/inicio' : '/app/inicio';
