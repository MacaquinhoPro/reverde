/**
 * Documento OpenAPI 3.1 de la API de Reverde. Se sirve en /api/docs
 * (Swagger UI) y en /api/openapi.json.
 *
 * Está escrito a mano a propósito: describe el contrato público sin acoplarlo
 * a los esquemas internos de validación, y se puede leer completo de una vez.
 */
import { env } from './config/env.ts';

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
};

const wrapped = (schema: object) => ({
  description: 'OK',
  content: { 'application/json': { schema: { type: 'object', properties: { data: schema } } } },
});

const list = (schema: object) => ({
  description: 'OK',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: { type: 'array', items: schema },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
    },
  },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const pagination = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

const op = (
  tag: string,
  summary: string,
  extra: Record<string, unknown> = {},
) => ({
  tags: [tag],
  summary,
  responses: { 200: wrapped({ type: 'object' }), default: errorResponse },
  ...extra,
});

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'API de Reverde',
    version: '1.0.0',
    description: `
API de Reverde: inventario inteligente y marketplace de rescate de alimentos.

**Autenticación.** Cookie de sesión \`${env.SESSION_COOKIE_NAME}\` (HttpOnly). Toda
petición que modifique datos debe repetir el valor de la cookie
\`${env.CSRF_COOKIE_NAME}\` en el encabezado \`x-csrf-token\`.

**Aislamiento.** Los endpoints de establecimiento resuelven el establecimiento
desde la sesión. Solo el rol \`superadmin\` puede indicar \`establishmentId\`.

**Dinero.** Los precios van en pesos colombianos enteros. Los montos que viajan
a la pasarela van en centavos (\`amountInCents\`).

**Idempotencia.** \`POST /orders\` y \`POST /orders/{id}/checkout\` aceptan el
encabezado \`Idempotency-Key\`: repetir la clave devuelve la respuesta original.
`.trim(),
  },
  servers: [{ url: env.API_URL, description: env.NODE_ENV }],
  tags: [
    { name: 'Auth', description: 'Registro, sesión, verificación y contraseñas' },
    { name: 'Users', description: 'Perfil y administración de personas' },
    { name: 'Establishments', description: 'Establecimientos y sus administradores' },
    { name: 'Products', description: 'Catálogo de inventario por establecimiento' },
    { name: 'Inventory', description: 'Existencias, movimientos y vencimientos' },
    { name: 'Alerts', description: 'Alertas de vencimiento' },
    { name: 'Recommendations', description: 'Recomendaciones del motor de riesgo' },
    { name: 'Marketplace', description: 'Catálogo público y publicaciones' },
    { name: 'Cart', description: 'Carrito de compras' },
    { name: 'Orders', description: 'Pedidos' },
    { name: 'Payments', description: 'Checkout, estado y webhooks' },
    { name: 'Dashboard', description: 'Métricas e impacto' },
    { name: 'Admin', description: 'Administración de la plataforma' },
  ],
  components: {
    securitySchemes: {
      sessionCookie: { type: 'apiKey', in: 'cookie', name: env.SESSION_COOKIE_NAME },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['cliente', 'supermercado', 'restaurante', 'superadmin'] },
          status: { type: 'string', enum: ['activo', 'pendiente', 'suspendido'] },
          establishmentId: { type: 'string', format: 'uuid', nullable: true },
          avatarHue: { type: 'integer' },
          emailVerified: { type: 'boolean' },
        },
      },
      Risk: {
        type: 'object',
        description: 'Risk Score explicable del producto',
        properties: {
          score: { type: 'integer', minimum: 0, maximum: 100 },
          level: { type: 'string', enum: ['bajo', 'medio', 'alto'] },
          daysLeft: { type: 'integer' },
          wasteProbability: { type: 'integer' },
          coverageDays: { type: 'number' },
          factors: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, detail: { type: 'string' }, weight: { type: 'integer' } },
            },
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          emoji: { type: 'string' },
          photo: { type: 'string', nullable: true },
          quantity: { type: 'integer', description: 'Stock vendible (físico menos reservado)' },
          onHandQuantity: { type: 'integer' },
          reservedQuantity: { type: 'integer' },
          unit: { type: 'string', enum: ['unidad', 'kg', 'g', 'litro', 'bandeja', 'caja'] },
          weightPerUnitKg: { type: 'number' },
          entryDate: { type: 'string', format: 'date-time' },
          expiryDate: { type: 'string', format: 'date-time' },
          originalPrice: { type: 'integer' },
          price: { type: 'integer', description: 'Precio final tras descuento, calculado en el backend' },
          discountPercent: { type: 'integer' },
          establishmentId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['en_inventario', 'publicado', 'agotado', 'vencido', 'donado'] },
          risk: ref('Risk'),
        },
      },
      Establishment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['supermercado', 'restaurante'] },
          address: { type: 'string' },
          city: { type: 'string' },
          schedule: { type: 'string' },
          rating: { type: 'number' },
          distanceKm: { type: 'number' },
          latitude: { type: 'number', nullable: true },
          longitude: { type: 'number', nullable: true },
          status: { type: 'string', enum: ['activo', 'pendiente', 'suspendido'] },
        },
      },
      Cart: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          count: { type: 'integer' },
          subtotal: { type: 'integer' },
          savings: { type: 'integer' },
          wasteAvoidedKg: { type: 'number' },
          items: { type: 'array', items: { type: 'object' } },
          issues: { type: 'array', items: { type: 'object' } },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          mode: { type: 'string', enum: ['compra', 'reserva'] },
          payment: { type: 'string', enum: ['tarjeta', 'pse', 'nequi', 'bancolombia', 'establecimiento'] },
          status: { type: 'string', enum: ['confirmado', 'reservado', 'entregado'] },
          paymentStatus: {
            type: 'string',
            enum: ['PENDING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'],
          },
          total: { type: 'integer' },
          savings: { type: 'integer' },
          wasteAvoidedKg: { type: 'number' },
          pickupWindow: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } },
          checkout: { type: 'object', nullable: true },
        },
      },
      Alert: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          productId: { type: 'string', format: 'uuid' },
          level: { type: 'string', enum: ['bajo', 'medio', 'alto'] },
          title: { type: 'string' },
          body: { type: 'string' },
          status: { type: 'string', enum: ['abierta', 'silenciada', 'resuelta'] },
          riskScore: { type: 'integer' },
        },
      },
      Recommendation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          productId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          rationale: { type: 'string' },
          learningNote: { type: 'string', nullable: true },
          suggestedDiscount: { type: 'integer' },
          confidence: { type: 'integer' },
          actions: { type: 'array', items: { type: 'object' } },
        },
      },
      Sale: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date-time' },
          productName: { type: 'string' },
          customer: { type: 'string' },
          qty: { type: 'integer' },
          soldPrice: { type: 'integer' },
          recovered: { type: 'integer' },
          wasteAvoidedKg: { type: 'number' },
          channel: { type: 'string', enum: ['marketplace', 'tienda'] },
        },
      },
    },
  },
  security: [{ sessionCookie: [] }],
  paths: {
    '/api/health': {
      get: { tags: ['Admin'], summary: 'Estado del servicio y de la base de datos', security: [], responses: { 200: wrapped({ type: 'object' }), 503: errorResponse } },
    },

    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registro de una cuenta real',
        description:
          'Crea una cuenta de comprador. Con `accountType: establecimiento` además deja una solicitud pendiente de aprobación: el rol NO se otorga aquí.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 10, description: '10+ caracteres con mayúscula, minúscula y número' },
                  phone: { type: 'string' },
                  accountType: { type: 'string', enum: ['comprador', 'establecimiento'], default: 'comprador' },
                  establishment: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string', enum: ['supermercado', 'restaurante'] },
                      address: { type: 'string' },
                      city: { type: 'string' },
                      schedule: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: wrapped({ type: 'object', properties: { user: ref('User') } }), 409: errorResponse, default: errorResponse },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        description: 'Entrega las cookies de sesión y de CSRF. Bloquea la cuenta tras varios intentos fallidos.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: wrapped({ type: 'object', properties: { user: ref('User') } }), 401: errorResponse, 429: errorResponse },
      },
    },
    '/api/auth/logout': { post: op('Auth', 'Cerrar la sesión actual') },
    '/api/auth/session': { get: { ...op('Auth', 'Sesión vigente (y renovación deslizante)'), security: [] } },
    '/api/auth/sessions': { get: op('Auth', 'Sesiones activas de la cuenta') },
    '/api/auth/sessions/{id}': {
      delete: { ...op('Auth', 'Revocar una sesión'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/auth/verify-email': { post: { ...op('Auth', 'Confirmar el correo con el token del enlace'), security: [] } },
    '/api/auth/verify-email/resend': { post: op('Auth', 'Reenviar el enlace de confirmación') },
    '/api/auth/password/forgot': { post: { ...op('Auth', 'Pedir enlace de restablecimiento'), security: [] } },
    '/api/auth/password/reset': { post: { ...op('Auth', 'Restablecer la contraseña con el token'), security: [] } },
    '/api/auth/password/change': { post: op('Auth', 'Cambiar la contraseña estando autenticado') },
    '/api/auth/me': {
      get: { ...op('Auth', 'Mi perfil'), responses: { 200: wrapped(ref('User')), default: errorResponse } },
      patch: { ...op('Auth', 'Actualizar mi perfil'), responses: { 200: wrapped(ref('User')), default: errorResponse } },
    },
    '/api/auth/bootstrap-superadmin': {
      post: {
        ...op('Auth', 'Crear el primer superadministrador'),
        description:
          'Exige el token SUPERADMIN_BOOTSTRAP_TOKEN y solo funciona si no existe ningún superadministrador. Nunca es alcanzable desde el registro público.',
        security: [],
      },
    },

    '/api/users/{id}': {
      get: { ...op('Users', 'Ficha de una persona'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/users/me': { delete: op('Users', 'Eliminar mi cuenta (baja lógica con anonimización)') },

    '/api/establishments': {
      get: {
        ...op('Establishments', 'Directorio de establecimientos activos'),
        security: [],
        parameters: [
          ...pagination,
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['supermercado', 'restaurante'] } },
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: list(ref('Establishment')), default: errorResponse },
      },
      post: { ...op('Establishments', 'Crear un establecimiento (superadmin)') },
    },
    '/api/establishments/{id}': {
      get: { ...op('Establishments', 'Detalle de un establecimiento'), security: [], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
      patch: { ...op('Establishments', 'Editar un establecimiento propio'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/establishments/requests': { post: op('Establishments', 'Solicitar una cuenta de establecimiento') },
    '/api/establishments/requests/mine': { get: op('Establishments', 'Mis solicitudes') },
    '/api/establishments/{id}/members': {
      get: { ...op('Establishments', 'Administradores del establecimiento'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
      post: { ...op('Establishments', 'Asociar un administrador'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/establishments/{id}/members/{userId}': {
      delete: {
        ...op('Establishments', 'Retirar un administrador'),
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
      },
    },

    '/api/products': {
      get: {
        ...op('Products', 'Inventario del establecimiento'),
        parameters: [
          ...pagination,
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'risk', in: 'query', schema: { type: 'string', enum: ['bajo', 'medio', 'alto'] } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['riesgo', 'vencimiento', 'nombre', 'precio', 'reciente'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: list(ref('Product')), default: errorResponse },
      },
      post: { ...op('Products', 'Registrar un producto'), responses: { 201: wrapped(ref('Product')), default: errorResponse } },
    },
    '/api/products/{id}': {
      get: { ...op('Products', 'Detalle de un producto propio'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: wrapped(ref('Product')), 404: errorResponse } },
      patch: { ...op('Products', 'Editar un producto'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
      delete: { ...op('Products', 'Retirar un producto (baja lógica)'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/products/{id}/discount': {
      post: { ...op('Products', 'Aplicar un descuento'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },

    '/api/inventory/summary': { get: op('Inventory', 'Resumen de existencias y valor en riesgo') },
    '/api/inventory/expiring': {
      get: { ...op('Inventory', 'Productos próximos a vencer'), parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 3 } }] },
    },
    '/api/inventory/movements': {
      get: { ...op('Inventory', 'Kardex de movimientos'), parameters: [...pagination, { name: 'productId', in: 'query', schema: { type: 'string' } }, { name: 'type', in: 'query', schema: { type: 'string' } }] },
    },
    '/api/inventory/{productId}/adjust': {
      post: { ...op('Inventory', 'Ajustar existencias'), parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/inventory/{productId}/write-off': {
      post: { ...op('Inventory', 'Registrar merma'), parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }] },
    },

    '/api/alerts': {
      get: {
        ...op('Alerts', 'Alertas de vencimiento (recalcula el Risk Score)'),
        parameters: [...pagination, { name: 'level', in: 'query', schema: { type: 'string', enum: ['bajo', 'medio', 'alto'] } }, { name: 'status', in: 'query', schema: { type: 'string' } }],
        responses: { 200: list(ref('Alert')), default: errorResponse },
      },
    },
    '/api/alerts/counts': { get: op('Alerts', 'Conteo de alertas abiertas por nivel') },
    '/api/alerts/{id}/snooze': {
      post: { ...op('Alerts', 'Silenciar una alerta'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/alerts/{id}/resolve': {
      post: { ...op('Alerts', 'Resolver una alerta'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },

    '/api/recommendations': {
      get: { ...op('Recommendations', 'Recomendaciones por riesgo de desperdicio'), parameters: pagination, responses: { 200: list(ref('Recommendation')), default: errorResponse } },
    },
    '/api/recommendations/{productId}': {
      get: { ...op('Recommendations', 'Detalle con explicabilidad e histórico'), parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/recommendations/{productId}/apply': {
      post: {
        ...op('Recommendations', 'Ejecutar la acción recomendada'),
        description: 'Acciones: descuento, combo, publicar, caja_rescate, destacar, donar, venta_presencial.',
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },

    '/api/marketplace': {
      get: {
        ...op('Marketplace', 'Catálogo público de productos publicados'),
        security: [],
        parameters: [
          ...pagination,
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'establishmentType', in: 'query', schema: { type: 'string', enum: ['todos', 'supermercado', 'restaurante'] } },
          { name: 'maxDistance', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'integer' } },
          { name: 'minDiscount', in: 'query', schema: { type: 'integer' } },
          { name: 'expiringSoon', in: 'query', schema: { type: 'boolean' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['relevancia', 'descuento', 'precio', 'distancia', 'vencimiento'] } },
        ],
        responses: { 200: list(ref('Product')), default: errorResponse },
      },
    },
    '/api/marketplace/products/{id}': {
      get: { ...op('Marketplace', 'Ficha pública de un producto'), security: [], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/marketplace/facets': { get: { ...op('Marketplace', 'Conteos para los filtros'), security: [] } },
    '/api/marketplace/listings/{productId}/publish': {
      post: { ...op('Marketplace', 'Publicar un producto'), parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/marketplace/listings/{productId}/unpublish': {
      post: { ...op('Marketplace', 'Despublicar un producto'), parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }] },
    },

    '/api/cart': {
      get: { ...op('Cart', 'Mi carrito con precios recalculados'), responses: { 200: wrapped(ref('Cart')), default: errorResponse } },
      delete: { ...op('Cart', 'Vaciar el carrito'), responses: { 200: wrapped(ref('Cart')), default: errorResponse } },
    },
    '/api/cart/items': {
      post: { ...op('Cart', 'Agregar un producto'), responses: { 200: wrapped(ref('Cart')), default: errorResponse } },
    },
    '/api/cart/items/{productId}': {
      patch: { ...op('Cart', 'Cambiar la cantidad'), parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }] },
      delete: { ...op('Cart', 'Quitar un producto'), parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }] },
    },

    '/api/orders': {
      post: {
        ...op('Orders', 'Crear el pedido desde el carrito'),
        description:
          'Calcula los totales desde la base de datos y reserva el inventario de forma atómica. Acepta `Idempotency-Key`.',
        parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }],
        responses: { 201: wrapped(ref('Order')), 409: errorResponse, default: errorResponse },
      },
      get: { ...op('Orders', 'Mis pedidos'), parameters: pagination, responses: { 200: list(ref('Order')), default: errorResponse } },
    },
    '/api/orders/establishment': {
      get: { ...op('Orders', 'Pedidos que llegan a mi establecimiento'), parameters: pagination, responses: { 200: list(ref('Order')), default: errorResponse } },
    },
    '/api/orders/admin/all': { get: { ...op('Orders', 'Todos los pedidos (superadmin)'), parameters: pagination } },
    '/api/orders/{id}': {
      get: { ...op('Orders', 'Detalle de un pedido'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: wrapped(ref('Order')), 404: errorResponse } },
    },
    '/api/orders/{id}/checkout': {
      post: {
        ...op('Orders', 'Iniciar el checkout alojado de la pasarela'),
        description: 'Devuelve `checkoutUrl`. Reverde nunca recibe datos de tarjeta.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } },
        ],
      },
    },
    '/api/orders/{id}/cancel': {
      post: { ...op('Orders', 'Cancelar un pedido pendiente y liberar el stock'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/orders/{id}/deliver': {
      post: { ...op('Orders', 'Marcar el pedido como entregado'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },

    '/api/payments/config': { get: { ...op('Payments', 'Configuración pública de la pasarela'), security: [] } },
    '/api/payments/status/{orderId}': {
      get: {
        ...op('Payments', 'Estado del pago de un pedido'),
        description: 'Lo consulta el frontend tras volver de la pasarela. La redirección por sí sola no confirma nada.',
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },
    '/api/payments/webhook/{provider}': {
      post: {
        tags: ['Payments'],
        summary: 'Webhook de la pasarela',
        description:
          'Valida la firma del evento, lo guarda con un id único (idempotencia), compara el monto y recién entonces confirma la orden. Responde 200 incluso al descartar, para no provocar reintentos infinitos.',
        security: [],
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['wompi', 'mock'] } }],
        responses: { 200: { description: 'Evento recibido' } },
      },
    },
    '/api/payments/{paymentId}/events': {
      get: { ...op('Payments', 'Eventos recibidos para un pago'), parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } }] },
    },

    '/api/dashboard/overview': { get: op('Dashboard', 'KPIs, comparativa y series del establecimiento') },
    '/api/dashboard/priority': { get: op('Dashboard', 'Productos priorizados por riesgo') },
    '/api/dashboard/sales': { get: { ...op('Dashboard', 'Historial de ventas'), parameters: pagination, responses: { 200: list(ref('Sale')), default: errorResponse } } },
    '/api/dashboard/me': { get: op('Dashboard', 'Mi ahorro e impacto como compradora') },

    '/api/admin/overview': { get: op('Admin', 'Resumen global de la plataforma') },
    '/api/admin/establishments': { get: { ...op('Admin', 'Establecimientos con métricas'), parameters: pagination } },
    '/api/admin/listings': { get: { ...op('Admin', 'Publicaciones de toda la plataforma'), parameters: pagination } },
    '/api/admin/requests': { get: { ...op('Admin', 'Solicitudes de cuenta de establecimiento'), parameters: pagination } },
    '/api/admin/requests/{id}/approve': {
      post: {
        ...op('Admin', 'Aprobar una solicitud'),
        description: 'Crea el establecimiento, asocia a la persona como propietaria y le cambia el rol.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },
    '/api/admin/requests/{id}/reject': {
      post: { ...op('Admin', 'Rechazar una solicitud'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/admin/users': { get: { ...op('Admin', 'Usuarios de la plataforma'), parameters: pagination } },
    '/api/admin/users/{id}': {
      patch: { ...op('Admin', 'Cambiar rol o estado de una cuenta'), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/admin/audit': { get: { ...op('Admin', 'Bitácora de auditoría'), parameters: pagination } },
    '/api/admin/payment-events': { get: { ...op('Admin', 'Eventos de pasarela recientes'), parameters: pagination } },

    '/api/notifications': { get: { ...op('Admin', 'Mis notificaciones'), parameters: pagination } },
    '/api/notifications/read-all': { post: op('Admin', 'Marcar todas como leídas') },
  },
} as const;
