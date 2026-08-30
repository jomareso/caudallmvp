import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { findTenantByCode } from '@/lib/licenses';
import { runWithTenantContext } from '@/lib/db/prisma';
import { EmailForm } from './email-form';
import { BrandPanel } from '../acceso/brand-panel';

// Mismas 5 claves que ya usa requestMagicLink ((employee)/actions.ts) —
// el callback signIn() de src/lib/auth/auth.ts redirige acá con
// ?googleError=<clave> cuando "Continuar con Google" falla por una de
// estas mismas reglas de negocio (código/licencia/correo corporativo),
// para no decir cosas distintas según el método de entrada.
const GOOGLE_ERROR_KEYS = ['invalidCode', 'licenseExpired', 'useCorporateEmail', 'codeAlreadyAssigned', 'googleUnknown'] as const;

export default async function RegistroPage({
  searchParams
}: {
  searchParams: { code?: string; googleError?: string };
}) {
  const code = searchParams.code?.trim().toUpperCase();
  if (!code) redirect('/acceso');

  // Antes de cualquier sesión, sin tenant conocido todavía — mismo
  // contexto que validateEnrollmentCode/requestMagicLink en
  // (employee)/actions.ts (ver comentario ahí): el WHERE siempre filtra
  // por un código único, así que platform-admin es seguro acá.
  const found = await runWithTenantContext({ kind: 'platform-admin' }, () => findTenantByCode(code));
  if (!found || found.tenant.status === 'SUSPENDED') redirect('/acceso');
  if (found.license?.status === 'EXPIRED' || (found.license?.expiresAt && found.license.expiresAt < new Date())) {
    redirect('/acceso');
  }

  const tErrors = await getTranslations('employee.access.errors');
  const googleErrorMessage = GOOGLE_ERROR_KEYS.includes(searchParams.googleError as (typeof GOOGLE_ERROR_KEYS)[number])
    ? tErrors(searchParams.googleError as (typeof GOOGLE_ERROR_KEYS)[number])
    : null;

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <BrandPanel />
      <EmailForm enrollmentCode={code} tenantName={found.tenant.name} googleErrorMessage={googleErrorMessage} />
    </main>
  );
}
