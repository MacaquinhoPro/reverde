import type { Category, Unit } from '../types';

export interface CatalogItem {
  key: string;
  name: string;
  category: Category;
  emoji: string;
  /** Gradiente de la ficha visual del producto (clases Tailwind). */
  image: string;
  unit: Unit;
  weightPerUnitKg: number;
  price: number;
  description: string;
  isRescueBox?: boolean;
}

export const CATALOG: Record<string, CatalogItem> = {
  yogur: {
    key: 'yogur', name: 'Yogur natural', category: 'Lácteos', emoji: '🥛',
    image: 'from-[#F4F7FF] to-[#DCE6FA]', unit: 'unidad', weightPerUnitKg: 0.2, price: 4500,
    description: 'Yogur natural entero sin azúcar añadida, en vaso de 200 g. Ideal para desayunos, granolas y smoothies.',
  },
  yogurGriego: {
    key: 'yogurGriego', name: 'Yogur griego', category: 'Lácteos', emoji: '🍶',
    image: 'from-[#F7F5FF] to-[#E3DDF8]', unit: 'unidad', weightPerUnitKg: 0.25, price: 5900,
    description: 'Yogur griego cremoso alto en proteína, 250 g. Textura densa y sabor suave.',
  },
  leche: {
    key: 'leche', name: 'Leche deslactosada', category: 'Lácteos', emoji: '🥛',
    image: 'from-[#F6FAFF] to-[#DDEAF7]', unit: 'litro', weightPerUnitKg: 1, price: 4800,
    description: 'Leche deslactosada UHT de 1 litro. Fácil digestión, mismo sabor.',
  },
  queso: {
    key: 'queso', name: 'Queso campesino', category: 'Lácteos', emoji: '🧀',
    image: 'from-[#FFFBEE] to-[#F7EAC6]', unit: 'unidad', weightPerUnitKg: 0.45, price: 12900,
    description: 'Queso campesino fresco artesanal de 450 g, bajo en sal.',
  },
  aguacate: {
    key: 'aguacate', name: 'Aguacate Hass', category: 'Frutas y verduras', emoji: '🥑',
    image: 'from-[#EFF8EE] to-[#D3E9CE]', unit: 'unidad', weightPerUnitKg: 0.25, price: 3200,
    description: 'Aguacate Hass en punto de maduración, listo para consumir en 1 o 2 días.',
  },
  banano: {
    key: 'banano', name: 'Banano criollo', category: 'Frutas y verduras', emoji: '🍌',
    image: 'from-[#FFFCE8] to-[#F7EEB8]', unit: 'kg', weightPerUnitKg: 1, price: 3800,
    description: 'Banano criollo maduro por kilo. Perfecto para batidos, postres y loncheras.',
  },
  fresas: {
    key: 'fresas', name: 'Fresas frescas', category: 'Frutas y verduras', emoji: '🍓',
    image: 'from-[#FFF1F2] to-[#FAD9DC]', unit: 'bandeja', weightPerUnitKg: 0.5, price: 7500,
    description: 'Bandeja de fresas de 500 g cultivadas en la sabana de Bogotá.',
  },
  lechuga: {
    key: 'lechuga', name: 'Lechuga crespa', category: 'Frutas y verduras', emoji: '🥬',
    image: 'from-[#F0F9F0] to-[#D4EBD2]', unit: 'unidad', weightPerUnitKg: 0.35, price: 3500,
    description: 'Lechuga crespa hidropónica, hojas firmes y limpias.',
  },
  tomate: {
    key: 'tomate', name: 'Tomate chonto', category: 'Frutas y verduras', emoji: '🍅',
    image: 'from-[#FFF3F0] to-[#F8D8CF]', unit: 'kg', weightPerUnitKg: 1, price: 4200,
    description: 'Tomate chonto maduro por kilo, ideal para salsas y guisos.',
  },
  pan: {
    key: 'pan', name: 'Pan artesanal de masa madre', category: 'Panadería', emoji: '🍞',
    image: 'from-[#FDF4E6] to-[#F1DCBC]', unit: 'unidad', weightPerUnitKg: 0.6, price: 9500,
    description: 'Hogaza de masa madre horneada hoy, corteza crujiente y miga alveolada.',
  },
  croissant: {
    key: 'croissant', name: 'Croissants de mantequilla', category: 'Panadería', emoji: '🥐',
    image: 'from-[#FFF6E5] to-[#F6E2BE]', unit: 'unidad', weightPerUnitKg: 0.09, price: 4200,
    description: 'Croissant hojaldrado con mantequilla, horneado en el día.',
  },
  ensalada: {
    key: 'ensalada', name: 'Ensalada preparada César', category: 'Preparados', emoji: '🥗',
    image: 'from-[#F1F9F3] to-[#D6EBDC]', unit: 'unidad', weightPerUnitKg: 0.35, price: 15900,
    description: 'Ensalada César lista para consumir con pollo, crotones y aderezo aparte.',
  },
  sandwich: {
    key: 'sandwich', name: 'Sándwich de pollo', category: 'Preparados', emoji: '🥪',
    image: 'from-[#FDF7EC] to-[#EFE0C6]', unit: 'unidad', weightPerUnitKg: 0.28, price: 13500,
    description: 'Sándwich en pan brioche con pollo desmechado, rúgula y alioli.',
  },
  pollo: {
    key: 'pollo', name: 'Pollo preparado al horno', category: 'Carnes', emoji: '🍗',
    image: 'from-[#FFF4EE] to-[#F4DDCC]', unit: 'bandeja', weightPerUnitKg: 0.75, price: 24900,
    description: 'Bandeja de pollo al horno con hierbas, porción para dos personas.',
  },
  bowl: {
    key: 'bowl', name: 'Bowl de quinua y vegetales', category: 'Preparados', emoji: '🍲',
    image: 'from-[#F2F8F0] to-[#DCEAD2]', unit: 'unidad', weightPerUnitKg: 0.4, price: 18900,
    description: 'Bowl de quinua, vegetales asados, garbanzo crocante y vinagreta de cilantro.',
  },
  jugo: {
    key: 'jugo', name: 'Jugo natural de naranja', category: 'Bebidas', emoji: '🧃',
    image: 'from-[#FFF7E8] to-[#FBE4BD]', unit: 'litro', weightPerUnitKg: 1, price: 8900,
    description: 'Jugo de naranja exprimido el mismo día, sin azúcar añadida.',
  },
  cajaPan: {
    key: 'cajaPan', name: 'Caja sorpresa de panadería', category: 'Cajas de rescate', emoji: '🧺',
    image: 'from-[#FDF1DF] to-[#EED9B4]', unit: 'caja', weightPerUnitKg: 1.4, price: 28000,
    description: 'Selección sorpresa del horno del día: panes, croissants y bollería. El contenido varía según lo que quede al cierre.',
    isRescueBox: true,
  },
  cajaFrutas: {
    key: 'cajaFrutas', name: 'Caja de frutas y verduras', category: 'Cajas de rescate', emoji: '🥕',
    image: 'from-[#F0F8EC] to-[#D6E9C6]', unit: 'caja', weightPerUnitKg: 3.5, price: 32000,
    description: 'Caja de 3,5 kg con frutas y verduras de cosecha con imperfecciones estéticas, perfectas para consumir.',
    isRescueBox: true,
  },
};

/** Gradiente y emoji por defecto para productos creados desde el formulario. */
export const CATEGORY_STYLE: Record<Category, { image: string; emoji: string }> = {
  'Lácteos': { image: 'from-[#F4F7FF] to-[#DCE6FA]', emoji: '🥛' },
  'Frutas y verduras': { image: 'from-[#EFF8EE] to-[#D3E9CE]', emoji: '🥬' },
  'Panadería': { image: 'from-[#FDF4E6] to-[#F1DCBC]', emoji: '🥐' },
  'Preparados': { image: 'from-[#F1F9F3] to-[#D6EBDC]', emoji: '🥗' },
  'Carnes': { image: 'from-[#FFF4EE] to-[#F4DDCC]', emoji: '🍗' },
  'Cajas de rescate': { image: 'from-[#FDF1DF] to-[#EED9B4]', emoji: '🧺' },
  'Bebidas': { image: 'from-[#FFF7E8] to-[#FBE4BD]', emoji: '🧃' },
};

export const CATEGORIES: Category[] = Object.keys(CATEGORY_STYLE) as Category[];

export const UNITS: Unit[] = ['unidad', 'kg', 'g', 'litro', 'bandeja', 'caja'];

/** Emojis sugeridos al crear un producto. */
export const EMOJI_OPTIONS = [
  '🥛','🧀','🍶','🥑','🍌','🍓','🥬','🍅','🥕','🍞','🥐','🥗','🥪','🍲','🍗','🧃','🧺','🍎','🥦','🍇','🍰','☕️',
];
