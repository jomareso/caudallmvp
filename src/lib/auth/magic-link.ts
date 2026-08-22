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

export type MagicLinkPayload = {
  type: 'employee';
  tenantId: string;
  employeeId: string;
  email: string;
};

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
