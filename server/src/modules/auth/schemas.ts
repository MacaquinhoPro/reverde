import { z } from 'zod';

/**
 * Política de contraseñas: 10 caracteres y tres clases distintas. Es más
 * exigente que el mínimo de 8 porque el único factor es la contraseña.
 */
export const passwordSchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres.')
  .max(128, 'La contraseña no puede superar 128 caracteres.')
  .refine((v) => /[a-záéíóúñ]/.test(v), 'Incluye al menos una letra minúscula.')
  .refine((v) => /[A-ZÁÉÍÓÚÑ]/.test(v), 'Incluye al menos una letra mayúscula.')
  .refine((v) => /\d/.test(v), 'Incluye al menos un número.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(180)
  .email('Escribe un correo electrónico válido.');

const nameSchema = z.string().trim().min(2, 'Escribe tu nombre.').max(120);

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{6,19}$/, 'Escribe un teléfono válido.')
  .optional();

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    phone: phoneSchema,
    /**
     * Tipo de cuenta solicitada. `establecimiento` NO otorga el rol: crea una
     * solicitud que debe aprobar un superadministrador. El rol de
     * superadministrador nunca se puede pedir desde aquí.
     */
    accountType: z.enum(['comprador', 'establecimiento']).default('comprador'),
    establishment: z
      .object({
        name: z.string().trim().min(2).max(140),
        type: z.enum(['supermercado', 'restaurante']),
        address: z.string().trim().min(5).max(200),
        city: z.string().trim().min(2).max(80),
        schedule: z.string().trim().max(120).optional(),
      })
      .optional(),
    /**
     * Autorización de tratamiento de datos (Ley 1581 de 2012, art. 9).
     *
     * Es **obligatoria**: sin autorización previa, expresa e informada no se
     * puede crear la cuenta, así que el campo no es opcional y `accepted`
     * tiene que valer exactamente `true` (un `"true"` o un `1` no sirven: la
     * autorización debe ser un acto afirmativo inequívoco).
     *
     * `version` es la versión del texto legal que se le mostró
     * (`LEGAL_VERSION` en src/data/legal.ts). Sin ella no se podría demostrar
     * **qué** autorizó la persona. El momento lo pone el servidor, nunca el
     * cliente.
     *
     * `marketing` es la única finalidad opcional y por eso va aparte: no
     * condiciona el servicio.
     */
    consent: z.object({
      accepted: z
        .boolean()
        .refine((v) => v === true, 'Debes autorizar el tratamiento de tus datos para crear la cuenta.'),
      version: z.string().trim().min(1, 'Falta la versión del texto legal autorizado.').max(20),
      marketing: z.boolean().default(false),
    }),
  })
  .refine((v) => v.accountType !== 'establecimiento' || v.establishment !== undefined, {
    message: 'Para una cuenta de establecimiento debes enviar los datos del local.',
    path: ['establishment'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Escribe tu contraseña.').max(128),
});

export const verifyEmailSchema = z.object({ token: z.string().min(10).max(200) });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
  avatarHue: z.coerce.number().int().min(0).max(360).optional(),
});

export const bootstrapSuperadminSchema = z.object({
  token: z.string().min(8),
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
