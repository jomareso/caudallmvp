import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY no está configurado. Ver .env.example.');
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Encuentro real (auditoría visual, 29 ago): el correo mostraba el nombre
// "caudall" como texto — nunca el logo real — y un <div style="max-width:
// 420px;margin:0 auto"> suelto no se centra de forma confiable en clientes
// de correo reales (Gmail lo pegaba a la izquierda del panel de lectura,
// dejando todo el resto en blanco). Este shell resuelve ambas cosas con el
// patrón "bulletproof" estándar de HTML email:
//   - tabla exterior al 100% de ancho + align="center" → centra de forma
//     confiable entre clientes, con el fondo ocupando todo el panel.
//   - una "tarjeta" blanca con borde/radio, igual al lenguaje visual del
//     resto de la app (.card), en vez de texto plano flotando.
//   - <style> con @media para reducir el padding de la tarjeta y hacer el
//     botón ancho completo en pantallas chicas — Gmail/Apple Mail lo
//     aplican; en clientes que lo ignoran (Outlook desktop viejo), la
//     tarjeta fluida ya se ve razonable sin el ajuste.
// El logo necesita una URL absoluta (los clientes de correo no resuelven
// rutas relativas) — se deriva del origin de la URL que cada función ya
// recibe (verifyUrl/panelUrl), que ya es request-aware (ver
// src/lib/http/request-origin.ts) y por lo tanto correcta también en
// Deploy Previews, no solo en producción.
export function renderEmailShell(origin: string, innerHtml: string): string {
  const logoUrl = `${origin}/brand/caudall-logo-color.png`;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          @media only screen and (max-width: 480px) {
            .cd-card { padding: 24px 20px !important; }
            .cd-btn { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box; }
          }
        </style>
      </head>
      <body style="margin:0;background:#F4F5F7">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7">
          <tr>
            <td align="center" style="padding:40px 16px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
                <tr>
                  <td class="cd-card" style="background:#ffffff;border:1px solid #E1E3E7;border-radius:12px;padding:36px 32px;font-family:Helvetica,Arial,sans-serif;color:#4B4C4C">
                    <img src="${logoUrl}" alt="Caudall" width="112" style="height:26px;width:auto;display:block;margin:0 0 24px">
                    ${innerHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
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
    html: renderEmailShell(
      new URL(verifyUrl).origin,
      `
        <p style="font-size:14px;line-height:1.5;margin:0 0 24px">
          Hola, usa este link para entrar a tu cuenta de bienestar financiero
          de <b>${tenantName}</b>. El link vence en 15 minutos y solo funciona una vez.
        </p>
        <p style="margin:0 0 24px">
          <a href="${verifyUrl}" class="cd-btn"
             style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;font-size:14px;display:inline-block">
            Entrar a Caudall
          </a>
        </p>
        <p style="font-size:12px;color:#737373;line-height:1.5;margin:0">
          Si no pediste este link, puedes ignorar este correo. Tu empresa nunca
          verá esta actividad ni tus respuestas individuales.
        </p>
      `
    )
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
    html: renderEmailShell(
      new URL(panelUrl).origin,
      `
        <p style="font-size:14px;line-height:1.5;margin:0 0 24px">
          Ya tienes acceso al panel administrativo de Caudall para <b>${tenantName}</b>.
        </p>
        <p style="margin:0 0 24px">
          <a href="${panelUrl}" class="cd-btn"
             style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;font-size:14px;display:inline-block">
            Entrar al panel
          </a>
        </p>
        <p style="font-size:12px;color:#737373;line-height:1.5;margin:0">
          Entra con este correo (${to}) y te enviaremos un link de acceso válido por 15 minutos.
        </p>
      `
    )
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
    html: renderEmailShell(
      new URL(verifyUrl).origin,
      `
        <p style="font-size:14px;line-height:1.5;margin:0 0 24px">
          Pediste cambiar el correo de tu cuenta de Caudall a esta dirección.
          Confirma para completar el cambio. El link vence en 15 minutos.
        </p>
        <p style="margin:0 0 24px">
          <a href="${verifyUrl}" class="cd-btn"
             style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;font-size:14px;display:inline-block">
            Confirmar mi correo nuevo
          </a>
        </p>
        <p style="font-size:12px;color:#737373;line-height:1.5;margin:0">
          Si no pediste este cambio, ignora este correo — tu cuenta sigue igual.
        </p>
      `
    )
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
    html: renderEmailShell(
      new URL(verifyUrl).origin,
      `
        <p style="font-size:14px;line-height:1.5;margin:0 0 24px">
          Usa este link para entrar al panel administrativo. Vence en 15 minutos
          y solo funciona una vez.
        </p>
        <p style="margin:0 0 24px">
          <a href="${verifyUrl}" class="cd-btn"
             style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;font-size:14px;display:inline-block">
            Entrar al panel
          </a>
        </p>
        <p style="font-size:12px;color:#737373;line-height:1.5;margin:0">
          Si no pediste este link, puedes ignorar este correo.
        </p>
      `
    )
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}
