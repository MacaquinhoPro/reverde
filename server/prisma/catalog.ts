/**
 * Catálogo semilla. Es el mismo contenido que el frontend traía en
 * `src/data/catalog.ts`, trasladado al seed para que los productos de
 * demostración existan en la base de datos y no en el navegador.
 */
export interface CatalogItem {
  key: string;
  name: string;
  category: string;
  emoji: string;
  image: string;
  photo: string;
  unit: 'unidad' | 'kg' | 'g' | 'litro' | 'bandeja' | 'caja';
  weightPerUnitKg: number;
  price: number;
  description: string;
  isRescueBox?: boolean;
}

export const CATALOG: Record<string, CatalogItem> = {
  yogur: { key: 'yogur', name: 'Yogur natural', category: 'Lácteos', emoji: '🥛', image: 'from-[#F4F7FF] to-[#DCE6FA]', photo: '/img/productos/yogur.jpg', unit: 'unidad', weightPerUnitKg: 0.2, price: 4500, description: 'Yogur natural entero sin azúcar añadida, en vaso de 200 g. Ideal para desayunos, granolas y smoothies.' },
  yogurGriego: { key: 'yogurGriego', name: 'Yogur griego', category: 'Lácteos', emoji: '🍶', image: 'from-[#F7F5FF] to-[#E3DDF8]', photo: '/img/productos/yogurGriego.jpg', unit: 'unidad', weightPerUnitKg: 0.25, price: 5900, description: 'Yogur griego cremoso alto en proteína, 250 g. Textura densa y sabor suave.' },
  leche: { key: 'leche', name: 'Leche deslactosada', category: 'Lácteos', emoji: '🥛', image: 'from-[#F6FAFF] to-[#DDEAF7]', photo: '/img/productos/leche.jpg', unit: 'litro', weightPerUnitKg: 1, price: 4800, description: 'Leche deslactosada UHT de 1 litro. Fácil digestión, mismo sabor.' },
  queso: { key: 'queso', name: 'Queso campesino', category: 'Lácteos', emoji: '🧀', image: 'from-[#FFFBEE] to-[#F7EAC6]', photo: '/img/productos/queso.jpg', unit: 'unidad', weightPerUnitKg: 0.45, price: 12900, description: 'Queso campesino fresco artesanal de 450 g, bajo en sal.' },
  aguacate: { key: 'aguacate', name: 'Aguacate Hass', category: 'Frutas y verduras', emoji: '🥑', image: 'from-[#EFF8EE] to-[#D3E9CE]', photo: '/img/productos/aguacate.jpg', unit: 'unidad', weightPerUnitKg: 0.25, price: 3200, description: 'Aguacate Hass en punto de maduración, listo para consumir en 1 o 2 días.' },
  banano: { key: 'banano', name: 'Banano criollo', category: 'Frutas y verduras', emoji: '🍌', image: 'from-[#FFFCE8] to-[#F7EEB8]', photo: '/img/productos/banano.jpg', unit: 'kg', weightPerUnitKg: 1, price: 3800, description: 'Banano criollo maduro por kilo. Perfecto para batidos, postres y loncheras.' },
  fresas: { key: 'fresas', name: 'Fresas frescas', category: 'Frutas y verduras', emoji: '🍓', image: 'from-[#FFF1F2] to-[#FAD9DC]', photo: '/img/productos/fresas.jpg', unit: 'bandeja', weightPerUnitKg: 0.5, price: 7500, description: 'Bandeja de fresas de 500 g cultivadas en la sabana de Bogotá.' },
  lechuga: { key: 'lechuga', name: 'Lechuga crespa', category: 'Frutas y verduras', emoji: '🥬', image: 'from-[#F0F9F0] to-[#D4EBD2]', photo: '/img/productos/lechuga.jpg', unit: 'unidad', weightPerUnitKg: 0.35, price: 3500, description: 'Lechuga crespa hidropónica, hojas firmes y limpias.' },
  tomate: { key: 'tomate', name: 'Tomate chonto', category: 'Frutas y verduras', emoji: '🍅', image: 'from-[#FFF3F0] to-[#F8D8CF]', photo: '/img/productos/tomate.jpg', unit: 'kg', weightPerUnitKg: 1, price: 4200, description: 'Tomate chonto maduro por kilo, ideal para salsas y guisos.' },
  pan: { key: 'pan', name: 'Pan artesanal de masa madre', category: 'Panadería', emoji: '🍞', image: 'from-[#FDF4E6] to-[#F1DCBC]', photo: '/img/productos/pan.jpg', unit: 'unidad', weightPerUnitKg: 0.6, price: 9500, description: 'Hogaza de masa madre horneada hoy, corteza crujiente y miga alveolada.' },
  croissant: { key: 'croissant', name: 'Croissants de mantequilla', category: 'Panadería', emoji: '🥐', image: 'from-[#FFF6E5] to-[#F6E2BE]', photo: '/img/productos/croissant.jpg', unit: 'unidad', weightPerUnitKg: 0.09, price: 4200, description: 'Croissant hojaldrado con mantequilla, horneado en el día.' },
  ensalada: { key: 'ensalada', name: 'Ensalada preparada César', category: 'Preparados', emoji: '🥗', image: 'from-[#F1F9F3] to-[#D6EBDC]', photo: '/img/productos/ensalada.jpg', unit: 'unidad', weightPerUnitKg: 0.35, price: 15900, description: 'Ensalada César lista para consumir con pollo, crotones y aderezo aparte.' },
  sandwich: { key: 'sandwich', name: 'Sándwich de pollo', category: 'Preparados', emoji: '🥪', image: 'from-[#FDF7EC] to-[#EFE0C6]', photo: '/img/productos/sandwich.jpg', unit: 'unidad', weightPerUnitKg: 0.28, price: 13500, description: 'Sándwich en pan brioche con pollo desmechado, rúgula y alioli.' },
  pollo: { key: 'pollo', name: 'Pollo preparado al horno', category: 'Carnes', emoji: '🍗', image: 'from-[#FFF4EE] to-[#F4DDCC]', photo: '/img/productos/pollo.jpg', unit: 'bandeja', weightPerUnitKg: 0.75, price: 24900, description: 'Bandeja de pollo al horno con hierbas, porción para dos personas.' },
  bowl: { key: 'bowl', name: 'Bowl de quinua y vegetales', category: 'Preparados', emoji: '🍲', image: 'from-[#F2F8F0] to-[#DCEAD2]', photo: '/img/productos/bowl.jpg', unit: 'unidad', weightPerUnitKg: 0.4, price: 18900, description: 'Bowl de quinua, vegetales asados, garbanzo crocante y vinagreta de cilantro.' },
  jugo: { key: 'jugo', name: 'Jugo natural de naranja', category: 'Bebidas', emoji: '🧃', image: 'from-[#FFF7E8] to-[#FBE4BD]', photo: '/img/productos/jugo.jpg', unit: 'litro', weightPerUnitKg: 1, price: 8900, description: 'Jugo de naranja exprimido el mismo día, sin azúcar añadida.' },
  cajaPan: { key: 'cajaPan', name: 'Caja sorpresa de panadería', category: 'Cajas de rescate', emoji: '🧺', image: 'from-[#FDF1DF] to-[#EED9B4]', photo: '/img/productos/cajaPan.jpg', unit: 'caja', weightPerUnitKg: 1.4, price: 28000, description: 'Selección sorpresa del horno del día: panes, croissants y bollería. El contenido varía según lo que quede al cierre.', isRescueBox: true },
  cajaFrutas: { key: 'cajaFrutas', name: 'Caja de frutas y verduras', category: 'Cajas de rescate', emoji: '🥕', image: 'from-[#F0F8EC] to-[#D6E9C6]', photo: '/img/productos/cajaFrutas.jpg', unit: 'caja', weightPerUnitKg: 3.5, price: 32000, description: 'Caja de 3,5 kg con frutas y verduras de cosecha con imperfecciones estéticas, perfectas para consumir.', isRescueBox: true },
};

/** [establecimiento, item, cantidad, días para vencer, días desde ingreso, ventas/día, tendencia, % descuento, publicado] */
export type InventoryRow = [string, string, number, number, number, number, number, number, boolean];

export const INVENTORY_ROWS: InventoryRow[] = [
  ['sup-1', 'yogur', 24, 2, 12, 6, -0.25, 0, false],
  ['sup-1', 'yogurGriego', 18, 3, 9, 4.5, -0.1, 35, true],
  ['sup-1', 'leche', 40, 5, 14, 12, 0.05, 0, false],
  ['sup-1', 'aguacate', 15, 4, 6, 1.6, -0.3, 0, false],
  ['sup-1', 'banano', 22, 3, 5, 7, 0.1, 25, true],
  ['sup-1', 'fresas', 12, 2, 4, 3, -0.15, 40, true],
  ['sup-1', 'lechuga', 19, 3, 3, 4, -0.2, 0, false],
  ['sup-1', 'tomate', 28, 6, 4, 9, 0.12, 0, false],
  ['sup-1', 'pan', 9, 1, 1, 5, -0.05, 45, true],
  ['sup-1', 'queso', 11, 9, 10, 2.5, 0.02, 0, false],
  ['sup-1', 'jugo', 16, 4, 2, 6, 0.2, 20, true],
  ['sup-1', 'cajaFrutas', 8, 3, 1, 3, 0.3, 30, true],

  ['sup-2', 'leche', 34, 3, 16, 8, -0.22, 0, false],
  ['sup-2', 'yogur', 16, 6, 8, 5, 0.08, 0, false],
  ['sup-2', 'tomate', 31, 2, 6, 6, -0.28, 30, true],
  ['sup-2', 'lechuga', 14, 2, 4, 2.4, -0.35, 35, true],
  ['sup-2', 'banano', 26, 5, 3, 9, 0.15, 0, false],
  ['sup-2', 'queso', 8, 4, 12, 1.2, -0.18, 25, true],
  ['sup-2', 'jugo', 12, 7, 2, 4, 0.05, 0, false],
  ['sup-2', 'cajaFrutas', 6, 2, 1, 2.5, 0.25, 35, true],
  ['sup-2', 'fresas', 9, 4, 3, 2.8, 0.1, 0, false],

  ['sup-3', 'yogurGriego', 21, 4, 7, 5.5, -0.12, 0, false],
  ['sup-3', 'aguacate', 24, 2, 7, 2.2, -0.4, 40, true],
  ['sup-3', 'pollo', 7, 2, 1, 3, -0.08, 30, true],
  ['sup-3', 'ensalada', 13, 1, 1, 6, 0.1, 40, true],
  ['sup-3', 'leche', 44, 8, 10, 14, 0.1, 0, false],
  ['sup-3', 'pan', 12, 2, 1, 6, 0.05, 0, false],
  ['sup-3', 'tomate', 18, 7, 3, 7, 0.08, 0, false],
  ['sup-3', 'cajaFrutas', 5, 3, 1, 2, 0.2, 30, true],

  ['res-1', 'bowl', 14, 1, 1, 7, -0.15, 35, true],
  ['res-1', 'ensalada', 11, 1, 1, 5, -0.2, 0, false],
  ['res-1', 'pollo', 9, 2, 1, 4, 0.05, 25, true],
  ['res-1', 'sandwich', 16, 1, 1, 8, 0.1, 30, true],
  ['res-1', 'aguacate', 18, 3, 4, 3, -0.25, 0, false],
  ['res-1', 'lechuga', 12, 2, 2, 3.5, -0.1, 0, false],
  ['res-1', 'jugo', 10, 3, 1, 5, 0.18, 20, true],

  ['res-2', 'croissant', 32, 1, 1, 14, -0.1, 40, true],
  ['res-2', 'pan', 18, 1, 1, 9, -0.05, 35, true],
  ['res-2', 'cajaPan', 10, 1, 1, 4, 0.35, 45, true],
  ['res-2', 'sandwich', 12, 1, 1, 6, 0.05, 0, false],
  ['res-2', 'jugo', 14, 4, 1, 5, 0.1, 0, false],
  ['res-2', 'queso', 6, 6, 8, 1.5, -0.05, 0, false],

  ['res-3', 'bowl', 17, 1, 1, 6, -0.3, 0, false],
  ['res-3', 'ensalada', 15, 2, 1, 5.5, -0.18, 30, true],
  ['res-3', 'sandwich', 10, 1, 1, 4.5, 0.02, 0, false],
  ['res-3', 'aguacate', 20, 3, 5, 2.8, -0.22, 25, true],
  ['res-3', 'fresas', 8, 2, 2, 2.5, 0.05, 0, false],
  ['res-3', 'jugo', 11, 5, 1, 4, 0.12, 0, false],
];

export const ESTABLISHMENT_SEEDS = [
  { slug: 'sup-1', name: 'Supermercado Verde', type: 'supermercado' as const, address: 'Cra. 15 #93-47, Chapinero', city: 'Bogotá', logoHue: 152, rating: 4.8, mapX: 30, mapY: 38, distanceKm: 1.2, status: 'activo' as const, joinedAt: '2025-11-04T10:00:00.000Z', schedule: 'Lun a Dom · 7:00 – 21:00', latitude: 4.6767, longitude: -74.0483 },
  { slug: 'sup-2', name: 'Mercado La Colina', type: 'supermercado' as const, address: 'Av. Suba #116-20, Suba', city: 'Bogotá', logoHue: 168, rating: 4.6, mapX: 64, mapY: 22, distanceKm: 2.6, status: 'activo' as const, joinedAt: '2026-01-18T10:00:00.000Z', schedule: 'Lun a Sáb · 8:00 – 20:00', latitude: 4.6961, longitude: -74.0736 },
  { slug: 'sup-3', name: 'Fresco Market Usaquén', type: 'supermercado' as const, address: 'Cl. 120 #7-40, Usaquén', city: 'Bogotá', logoHue: 140, rating: 4.7, mapX: 47, mapY: 66, distanceKm: 3.4, status: 'activo' as const, joinedAt: '2026-03-02T10:00:00.000Z', schedule: 'Lun a Dom · 7:30 – 22:00', latitude: 4.6983, longitude: -74.0309 },
  { slug: 'res-1', name: 'Cocina Raíz', type: 'restaurante' as const, address: 'Cl. 70 #10-15, Chapinero Alto', city: 'Bogotá', logoHue: 96, rating: 4.9, mapX: 20, mapY: 72, distanceKm: 0.8, status: 'activo' as const, joinedAt: '2025-12-12T10:00:00.000Z', schedule: 'Mar a Dom · 12:00 – 22:00', latitude: 4.6499, longitude: -74.0573 },
  { slug: 'res-2', name: 'Panadería El Trigal', type: 'restaurante' as const, address: 'Cra. 7 #45-12, Teusaquillo', city: 'Bogotá', logoHue: 40, rating: 4.7, mapX: 76, mapY: 54, distanceKm: 1.9, status: 'activo' as const, joinedAt: '2026-02-09T10:00:00.000Z', schedule: 'Lun a Sáb · 6:00 – 19:00', latitude: 4.6319, longitude: -74.0666 },
  { slug: 'res-3', name: 'Bowl & Green', type: 'restaurante' as const, address: 'Cl. 85 #12-30, Zona Rosa', city: 'Bogotá', logoHue: 120, rating: 4.5, mapX: 58, mapY: 44, distanceKm: 2.1, status: 'pendiente' as const, joinedAt: '2026-08-21T10:00:00.000Z', schedule: 'Lun a Dom · 11:00 – 21:00', latitude: 4.6672, longitude: -74.0535 },
];

export const PROMO_SEEDS = [
  { category: 'Lácteos', discountPercent: 30, sellThrough: 82, daysToSell: 2, slug: 'sup-1' },
  { category: 'Lácteos', discountPercent: 30, sellThrough: 79, daysToSell: 2, slug: 'sup-2' },
  { category: 'Lácteos', discountPercent: 15, sellThrough: 41, daysToSell: 4, slug: 'sup-1' },
  { category: 'Lácteos', discountPercent: 45, sellThrough: 94, daysToSell: 1, slug: 'sup-3' },
  { category: 'Frutas y verduras', discountPercent: 25, sellThrough: 74, daysToSell: 2, slug: 'sup-1' },
  { category: 'Frutas y verduras', discountPercent: 40, sellThrough: 91, daysToSell: 1, slug: 'sup-3' },
  { category: 'Frutas y verduras', discountPercent: 25, sellThrough: 69, daysToSell: 3, slug: 'sup-2' },
  { category: 'Panadería', discountPercent: 40, sellThrough: 96, daysToSell: 1, slug: 'res-2' },
  { category: 'Panadería', discountPercent: 20, sellThrough: 52, daysToSell: 2, slug: 'res-2' },
  { category: 'Panadería', discountPercent: 35, sellThrough: 88, daysToSell: 1, slug: 'sup-1' },
  { category: 'Preparados', discountPercent: 35, sellThrough: 90, daysToSell: 1, slug: 'res-1' },
  { category: 'Preparados', discountPercent: 20, sellThrough: 48, daysToSell: 2, slug: 'res-3' },
  { category: 'Preparados', discountPercent: 30, sellThrough: 81, daysToSell: 1, slug: 'res-1' },
  { category: 'Carnes', discountPercent: 30, sellThrough: 86, daysToSell: 1, slug: 'sup-3' },
  { category: 'Carnes', discountPercent: 15, sellThrough: 39, daysToSell: 3, slug: 'res-1' },
  { category: 'Cajas de rescate', discountPercent: 35, sellThrough: 93, daysToSell: 1, slug: 'res-2' },
  { category: 'Cajas de rescate', discountPercent: 30, sellThrough: 88, daysToSell: 1, slug: 'sup-1' },
  { category: 'Bebidas', discountPercent: 20, sellThrough: 72, daysToSell: 2, slug: 'sup-1' },
  { category: 'Bebidas', discountPercent: 35, sellThrough: 85, daysToSell: 1, slug: 'res-2' },
];

export const DEMO_USERS = [
  { email: 'supermercado1@reverde.com', name: 'Laura Mendoza', role: 'supermercado' as const, slug: 'sup-1', avatarHue: 152 },
  { email: 'supermercado2@reverde.com', name: 'Andrés Ortega', role: 'supermercado' as const, slug: 'sup-2', avatarHue: 168 },
  { email: 'supermercado3@reverde.com', name: 'Daniela Ruiz', role: 'supermercado' as const, slug: 'sup-3', avatarHue: 140 },
  { email: 'restaurante1@reverde.com', name: 'Camilo Prieto', role: 'restaurante' as const, slug: 'res-1', avatarHue: 96 },
  { email: 'restaurante2@reverde.com', name: 'Marcela Ríos', role: 'restaurante' as const, slug: 'res-2', avatarHue: 40 },
  { email: 'restaurante3@reverde.com', name: 'Julián Vega', role: 'restaurante' as const, slug: 'res-3', avatarHue: 120 },
  { email: 'cliente1@reverde.com', name: 'Sofía Herrera', role: 'cliente' as const, slug: null, avatarHue: 200 },
  { email: 'cliente2@reverde.com', name: 'Mateo Cárdenas', role: 'cliente' as const, slug: null, avatarHue: 260 },
  { email: 'cliente3@reverde.com', name: 'Valentina Gómez', role: 'cliente' as const, slug: null, avatarHue: 320 },
  { email: 'admin1@reverde.com', name: 'Equipo Reverde', role: 'superadmin' as const, slug: null, avatarHue: 152 },
  { email: 'admin2@reverde.com', name: 'Paula Estrada', role: 'superadmin' as const, slug: null, avatarHue: 176 },
  { email: 'admin3@reverde.com', name: 'Ricardo Salas', role: 'superadmin' as const, slug: null, avatarHue: 188 },
];

export const CUSTOMER_NAMES = [
  'Sofía Herrera', 'Mateo Cárdenas', 'Valentina Gómez', 'Juan Pablo Niño',
  'Carolina Duarte', 'Esteban Lara', 'Natalia Pardo', 'Felipe Acosta',
  'Ana María Rojas', 'Sebastián Vargas', 'Laura Jiménez', 'Tomás Beltrán',
];
