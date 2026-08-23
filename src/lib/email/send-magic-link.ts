import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY no está configurado. Ver .env.example.');
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendMagicLinkEmail(params: {
  to: string;
  verifyUrl: string;
  tenantName: string;
}): Promise<void> {
  const { to, verifyUrl, tenantName } = params;
  const from = process.env.EMAIL_FROM ?? 'Caudall <no-reply@caudall.com>';

  const { error } = await getResendClient().emails.send({
    from,
    to,
    subject: 'Tu link para entrar a Caudall',
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;color:#4B4C4C">
        <h1 style="color:#0F5499;font-size:20px;font-weight:500">caudall</h1>
        <p style="font-size:14px;line-height:1.5">
          Hola, usa este link para entrar a tu cuenta de bienestar financiero
          de <b>${tenantName}</b>. El link vence en 15 minutos y solo funciona una vez.
        </p>
        <p style="margin:24px 0">
          <a href="${verifyUrl}"
             style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;font-size:14px;display:inline-block">
            Entrar a Caudall
          </a>
        </p>
        <p style="font-size:12px;color:#737373;line-height:1.5">
          Si no pediste este link, puedes ignorar este correo. Tu empresa nunca
          verá esta actividad ni tus respuestas individuales.
        </p>
      </div>
    `
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}

export async function sendAdminMagicLinkEmail(params: { to: string; verifyUrl: string }): Promise<void> {
  const { to, verifyUrl } = params;
  const from = process.env.EMAIL_FROM ?? 'Caudall <no-reply@caudall.com>';

  const { error } = await getResendClient().emails.send({
    from,
    to,
    subject: 'Tu link para entrar al panel de Caudall',
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;color:#4B4C4C">
        <h1 style="color:#0F5499;font-size:20px;font-weight:500">caudall</h1>
        <p style="font-size:14px;line-height:1.5">
          Usa este link para entrar al panel administrativo. Vence en 15 minutos
          y solo funciona una vez.
        </p>
        <p style="margin:24px 0">
          <a href="${verifyUrl}"
             style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;font-size:14px;display:inline-block">
            Entrar al panel
          </a>
        </p>
        <p style="font-size:12px;color:#737373;line-height:1.5">
          Si no pediste este link, puedes ignorar este correo.
        </p>
      </div>
    `
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}
