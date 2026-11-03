import { describe, expect, it } from 'vitest';
import { homeForRole } from '../../src/lib/routes';
import { USERS } from '../../src/data/users';

describe('homeForRole', () => {
  it('lleva a cada rol a su área', () => {
    expect(homeForRole('cliente')).toBe('/tienda');
    expect(homeForRole('superadmin')).toBe('/admin/inicio');
    expect(homeForRole('supermercado')).toBe('/app/inicio');
    expect(homeForRole('restaurante')).toBe('/app/inicio');
  });

  it('todos los roles de las cuentas demo tienen destino', () => {
    for (const u of USERS) expect(homeForRole(u.role)).toMatch(/^\/(tienda|app|admin)/);
  });
});
