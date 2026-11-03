/**
 * Envío de correo. En desarrollo el transporte `log` imprime el enlace en la
 * consola (no se envía nada); en producción se exige SMTP.
 *
 * Los enlaces llevan el token en claro porque es su único destino legítimo:
 * el correo del titular. El token nunca se escribe en los logs de producción.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.ts';
import { logger } from './logger.ts';

let transporter: Transporter | null = null;

function smtp(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Último correo "enviado" con el transporte log: lo usan las pruebas. */
export const sentMails: Mail[] = [];

export async function sendMail(mail: Mail): Promise<void> {
  if (env.MAIL_TRANSPORT === 'smtp') {
    await smtp().sendMail({ from: env.MAIL_FROM, ...mail });
    logger.info({ to: mail.to, subject: mail.subject }, 'correo enviado');
    return;
  }
  sentMails.push(mail);
  if (sentMails.length > 50) sentMails.shift();
  // Solo fuera de producción: aquí el enlace con token sí se imprime a propósito.
  if (!env.isProd && !env.isTest) {
    logger.info(`\n──── correo simulado ────\nPara: ${mail.to}\nAsunto: ${mail.subject}\n${mail.text}\n─────────────────────────\n`);
  }
}

export const verificationEmail = (name: string, link: string): Mail => ({
  to: '',
  subject: 'Confirma tu correo en Reverde',
  text: `Hola ${name}:\n\nConfirma tu correo para activar tu cuenta de Reverde:\n${link}\n\nEl enlace vence en 24 horas.`,
});

export const resetEmail = (name: string, link: string): Mail => ({
  to: '',
  subject: 'Restablece tu contraseña de Reverde',
  text: `Hola ${name}:\n\nAlguien pidió restablecer la contraseña de esta cuenta.\n${link}\n\nEl enlace vence en 1 hora. Si no fuiste tú, ignora este correo.`,
});
