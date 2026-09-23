import type { User } from '../types';

export const DEMO_PASSWORD = 'Demo1234';

export const USERS: User[] = [
  // Supermercados
  { id: 'u-sup-1', email: 'supermercado1@reverde.com', name: 'Laura Mendoza', role: 'supermercado', establishmentId: 'sup-1', avatarHue: 152 },
  { id: 'u-sup-2', email: 'supermercado2@reverde.com', name: 'Andrés Ortega', role: 'supermercado', establishmentId: 'sup-2', avatarHue: 168 },
  { id: 'u-sup-3', email: 'supermercado3@reverde.com', name: 'Daniela Ruiz', role: 'supermercado', establishmentId: 'sup-3', avatarHue: 140 },
  // Restaurantes
  { id: 'u-res-1', email: 'restaurante1@reverde.com', name: 'Camilo Prieto', role: 'restaurante', establishmentId: 'res-1', avatarHue: 96 },
  { id: 'u-res-2', email: 'restaurante2@reverde.com', name: 'Marcela Ríos', role: 'restaurante', establishmentId: 'res-2', avatarHue: 40 },
  { id: 'u-res-3', email: 'restaurante3@reverde.com', name: 'Julián Vega', role: 'restaurante', establishmentId: 'res-3', avatarHue: 120 },
  // Clientes
  { id: 'u-cli-1', email: 'cliente1@reverde.com', name: 'Sofía Herrera', role: 'cliente', avatarHue: 200 },
  { id: 'u-cli-2', email: 'cliente2@reverde.com', name: 'Mateo Cárdenas', role: 'cliente', avatarHue: 260 },
  { id: 'u-cli-3', email: 'cliente3@reverde.com', name: 'Valentina Gómez', role: 'cliente', avatarHue: 320 },
  // Superadmins
  { id: 'u-adm-1', email: 'admin1@reverde.com', name: 'Equipo Reverde', role: 'superadmin', avatarHue: 152 },
  { id: 'u-adm-2', email: 'admin2@reverde.com', name: 'Paula Estrada', role: 'superadmin', avatarHue: 176 },
  { id: 'u-adm-3', email: 'admin3@reverde.com', name: 'Ricardo Salas', role: 'superadmin', avatarHue: 188 },
];

export const QUICK_ACCESS: { role: User['role']; label: string; email: string; hint: string }[] = [
  { role: 'supermercado', label: 'Entrar como supermercado', email: 'supermercado1@reverde.com', hint: 'Supermercado Verde' },
  { role: 'restaurante', label: 'Entrar como restaurante', email: 'restaurante1@reverde.com', hint: 'Cocina Raíz' },
  { role: 'cliente', label: 'Entrar como cliente', email: 'cliente1@reverde.com', hint: 'Sofía Herrera' },
  { role: 'superadmin', label: 'Entrar como superadmin', email: 'admin1@reverde.com', hint: 'Panel global' },
];

export const findUserByEmail = (email: string) =>
  USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
