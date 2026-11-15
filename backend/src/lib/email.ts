import { env } from '../config/env.js';
import { logger } from './logger.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_FROM = 'TemTrend <nao-responda@temtrend.com>';

export interface VerificationCodeEmailInput {
  to: string;
  code: string;
  nome?: string | null;
}

type EmailVariant = "signup" | "password_reset";

const EMAIL_COPY: Record<EmailVariant, { label: string; subject: string; heading: string; intro: string; text: string }> = {
  signup: {
    label: "Confirmação de e-mail",
    subject: "Seu código TemTrend",
    heading: "seu código chegou.",
    intro: "Use o código abaixo para confirmar seu e-mail e liberar o onboarding da sua conta.",
    text: "para confirmar seu e-mail na TemTrend",
  },
  password_reset: {
    label: "Redefinição de senha",
    subject: "Código para redefinir sua senha TemTrend",
    heading: "vamos criar sua nova senha.",
    intro: "Use o código abaixo para redefinir sua senha. Sua sessão atual continua ativa até você concluir.",
    text: "para redefinir sua senha na TemTrend",
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(nome?: string | null): string {
  const first = nome?.trim().split(/\s+/)[0];
  return first ? escapeHtml(first) : '';
}

function buildHtml(code: string, nome?: string | null, variant: EmailVariant = "signup"): string {
  const greeting = firstName(nome);
  const safeCode = escapeHtml(code);
  const copy = EMAIL_COPY[variant];
  const heading = greeting ? `${greeting}, ${copy.heading}` : copy.heading.charAt(0).toUpperCase() + copy.heading.slice(1);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Seu código TemTrend</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f3fe;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f3fe" style="background-color:#f6f3fe;">
    <tr>
      <td align="center" style="padding-top:40px;padding-bottom:40px;padding-left:16px;padding-right:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="left" style="padding-bottom:20px;">
              <span style="font-family:'Bricolage Grotesque','Segoe UI',Arial,sans-serif;font-size:19px;font-weight:700;letter-spacing:-0.3px;color:#14101f;">TemTrend</span>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #e7dff6;border-radius:20px;padding-top:38px;padding-bottom:38px;padding-left:32px;padding-right:32px;">
              <p style="margin:0 0 8px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#6d28d9;">${copy.label}</p>
              <h1 style="margin:0 0 14px 0;font-family:'Bricolage Grotesque','Segoe UI',Arial,sans-serif;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.5px;color:#14101f;">${heading}</h1>
              <p style="margin:0 0 26px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#45556c;">${copy.intro}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#f3eefb" style="background-color:#f3eefb;border:1px solid #e7dff6;border-radius:14px;padding-top:22px;padding-bottom:22px;padding-left:12px;padding-right:12px;">
                    <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:36px;line-height:1;font-weight:700;letter-spacing:10px;color:#14101f;">${safeCode}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.6;color:#45556c;">O código expira em <strong style="color:#14101f;">10 minutos</strong> e pode ser usado uma única vez. Se você não pediu este código, ignore este e-mail.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:22px;">
              <p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;line-height:1.6;color:#6e6486;">TemTrend · Sua produção de conteúdo começa aqui.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(code: string, nome?: string | null, variant: EmailVariant = "signup"): string {
  const greeting = nome?.trim().split(/\s+/)[0];
  const copy = EMAIL_COPY[variant];
  return [
    greeting ? `${greeting}, ${copy.heading}` : copy.heading.charAt(0).toUpperCase() + copy.heading.slice(1),
    '',
    `Use o código ${code} ${copy.text}.`,
    '',
    'O código expira em 10 minutos e pode ser usado uma única vez.',
    'Se você não pediu este código, ignore este e-mail.',
  ].join('\n');
}

/**
 * Envia o código pelo Resend. Nunca lança exceção: devolve `false` para o
 * chamador desfazer a operação e avisar o usuário.
 */
export async function sendVerificationCodeEmail(
  input: VerificationCodeEmailInput,
  variant: EmailVariant = "signup",
): Promise<boolean> {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) {
    logger.warn('RESEND_API_KEY ausente: código de verificação não enviado');
    return false;
  }

  const copy = EMAIL_COPY[variant];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [input.to],
        subject: `${copy.subject}: ${input.code}`,
        html: buildHtml(input.code, input.nome, variant),
        text: buildText(input.code, input.nome, variant),
      }),
      signal: controller.signal,
    });

    if (res.status < 200 || res.status >= 300) {
      const body = await res.text().catch(() => '');
      logger.error(
        { status: res.status, body: body.slice(0, 400) },
        'Resend rejected verification email',
      );
      return false;
    }

    logger.info('Verification email sent');
    return true;
  } catch (err) {
    logger.error({ err }, 'Verification email failed');
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
