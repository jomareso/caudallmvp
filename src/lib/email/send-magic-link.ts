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

// Un <div style="max-width:420px;margin:0 auto"> suelto no se centra de forma
// confiable en clientes de correo reales — sin un <table> envolvente que
// ocupe el 100% del ancho disponible, Gmail/Outlook lo renderizan pegado a
// la izquierda del panel de lectura en vez de centrado (encontrado con una
// captura real: mucho espacio en blanco a la derecha, nada a la izquierda).
// Este es el patrón "bulletproof" estándar de HTML email: tabla exterior al
// 100% con align="center", tabla interior con el ancho fijo real.
function wrapEmailBody(innerHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7">
      <tr>
        <td align="center" style="padding:40px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px">
            <tr>
              <td style="font-family:Helvetica,Arial,sans-serif;color:#4B4C4C">
                ${innerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
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
    html: wrapEmailBody(`
      <h1 style="color:#0F5499;font-size:20px;font-weight:500;margin:0 0 16px">caudall</h1>
      <p style="font-size:14px;line-height:1.5;margin:0 0 24px">
        Hola, usa este link para entrar a tu cuenta de bienestar financiero
        de <b>${tenantName}</b>. El link vence en 15 minutos y solo funciona una vez.
      </p>
      <p style="margin:0 0 24px">
        <a href="${verifyUrl}"
           style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                  text-decoration:none;font-size:14px;display:inline-block">
          Entrar a Caudall
        </a>
      </p>
      <p style="font-size:12px;color:#737373;line-height:1.5;margin:0">
        Si no pediste este link, puedes ignorar este correo. Tu empresa nunca
        verá esta actividad ni tus respuestas individuales.
      </p>
    `)
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}

// A diferencia del magic link (vence en 15 min), este correo no lleva token
// — solo avisa que ya tiene acceso. El admin pide su propio link de entrada
// cuando lo vaya a usar, consistente con la Decisión 8 (sin contraseñas, sin
// links de larga duración flotando en un correo).
export async function sendAdminWelcomeEmail(params: { to: string; tenantName: string; panelUrl: string }): Promise<void> {
  const { to, tenantName, panelUrl } = params;
  const from = process.env.EMAIL_FROM ?? 'Caudall <no-reply@caudall.com>';

  const { error } = await getResendClient().emails.send({
    from,
    to,
    subject: 'Ya tienes acceso al panel de Caudall',
    html: wrapEmailBody(`
      <h1 style="color:#0F5499;font-size:20px;font-weight:500;margin:0 0 16px">caudall</h1>
      <p style="font-size:14px;line-height:1.5;margin:0 0 24px">
        Ya tienes acceso al panel administrativo de Caudall para <b>${tenantName}</b>.
      </p>
      <p style="margin:0 0 24px">
        <a href="${panelUrl}"
           style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                  text-decoration:none;font-size:14px;display:inline-block">
          Entrar al panel
        </a>
      </p>
      <p style="font-size:12px;color:#737373;line-height:1.5;margin:0">
        Entra con este correo (${to}) y te enviaremos un link de acceso válido por 15 minutos.
      </p>
    `)
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}

// Va a la dirección NUEVA, no a la actual — es justamente lo que confirma
// que el empleado controla esa bandeja antes de aplicar el cambio (ver
// requestEmailChange en (employee)/perfil/actions.ts).
export async function sendEmailChangeConfirmation(params: { to: string; verifyUrl: string }): Promise<void> {
  const { to, verifyUrl } = params;
  const from = process.env.EMAIL_FROM ?? 'Caudall <no-reply@caudall.com>';

  const { error } = await getResendClient().emails.send({
    from,
    to,
    subject: 'Confirma tu nuevo correo en Caudall',
    html: wrapEmailBody(`
      <h1 style="color:#0F5499;font-size:20px;font-weight:500;margin:0 0 16px">caudall</h1>
      <p style="font-size:14px;line-height:1.5;margin:0 0 24px">
        Pediste cambiar el correo de tu cuenta de Caudall a esta dirección.
        Confirma para completar el cambio. El link vence en 15 minutos.
      </p>
      <p style="margin:0 0 24px">
        <a href="${verifyUrl}"
           style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                  text-decoration:none;font-size:14px;display:inline-block">
          Confirmar mi correo nuevo
        </a>
      </p>
      <p style="font-size:12px;color:#737373;line-height:1.5;margin:0">
        Si no pediste este cambio, ignora este correo — tu cuenta sigue igual.
      </p>
    `)
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
    html: wrapEmailBody(`
      <h1 style="color:#0F5499;font-size:20px;font-weight:500;margin:0 0 16px">caudall</h1>
      <p style="font-size:14px;line-height:1.5;margin:0 0 24px">
        Usa este link para entrar al panel administrativo. Vence en 15 minutos
        y solo funciona una vez.
      </p>
      <p style="margin:0 0 24px">
        <a href="${verifyUrl}"
           style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                  text-decoration:none;font-size:14px;display:inline-block">
          Entrar al panel
        </a>
      </p>
      <p style="font-size:12px;color:#737373;line-height:1.5;margin:0">
        Si no pediste este link, puedes ignorar este correo.
      </p>
    `)
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}
