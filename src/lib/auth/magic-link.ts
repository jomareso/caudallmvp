import { SignJWT, jwtVerify } from 'jose';

// Vida corta del link: si alguien lo intercepta, expira rápido.
const MAGIC_LINK_TTL_SECONDS = 15 * 60;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET no está configurado. Ver .env.example.');
  }
  return new TextEncoder().encode(secret);
}

export type MagicLinkPayload =
  | { type: 'employee'; tenantId: string; employeeId: string; email: string }
  | { type: 'admin'; adminUserId: string; email: string }
  // No es login — confirma un cambio de correo personal (panel de
  // Configuración) antes de aplicarlo. Mismo mecanismo (JWT firmado, un
  // solo uso por vencer a los 15 min) porque la garantía que necesita es
  // idéntica: que el link llegó a quien de verdad controla esa bandeja.
  | { type: 'email-change'; tenantId: string; employeeId: string; newEmail: string };

export async function createMagicLinkToken(payload: MagicLinkPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAGIC_LINK_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyMagicLinkToken(token: string): Promise<MagicLinkPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    if (payload.type === 'admin') {
      if (typeof payload.adminUserId !== 'string' || typeof payload.email !== 'string') return null;
      return { type: 'admin', adminUserId: payload.adminUserId, email: payload.email };
    }

    if (payload.type === 'email-change') {
      if (
        typeof payload.tenantId !== 'string' ||
        typeof payload.employeeId !== 'string' ||
        typeof payload.newEmail !== 'string'
      ) {
        return null;
      }
      return {
        type: 'email-change',
        tenantId: payload.tenantId,
        employeeId: payload.employeeId,
        newEmail: payload.newEmail
      };
    }

    if (
      payload.type !== 'employee' ||
      typeof payload.tenantId !== 'string' ||
      typeof payload.employeeId !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return null;
    }
    return {
      type: 'employee',
      tenantId: payload.tenantId,
      employeeId: payload.employeeId,
      email: payload.email
    };
  } catch {
    // Token vencido, mal formado o firmado con otro secreto.
    return null;
  }
}
