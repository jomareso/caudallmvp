import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { BrandPanel } from '@/app/(employee)/acceso/brand-panel';
import { LogoutButton } from '@/app/(employee)/perfil/logout-button';

export default async function LicenciaVencidaPage({
  searchParams
}: {
  searchParams: { motivo?: string };
}) {
  const t = await getTranslations('employee.licenseExpired');
  const suspended = searchParams.motivo === 'suspendida';

  // El JWT sigue siendo válido acá (lo que venció es la licencia, no la
  // sesión) — se puede resolver el empleado igual que en EmployeeLayout,
  // que es justo quien redirige acá. Sin fecha para el caso "suspendida":
  // ahí no hay una licencia individual que vencer, es la empresa entera.
  const session = await auth();
  const sessionUser = session?.user as { id?: string; tenantId?: string } | undefined;
  const expiresAt =
    !suspended && sessionUser?.id && sessionUser?.tenantId
      ? await runWithTenantContext({ kind: 'tenant', tenantId: sessionUser.tenantId }, async () => {
          const employee = await prisma.employee.findUnique({
            where: { id: sessionUser.id! },
            include: { license: true }
          });
          return employee?.license?.expiresAt ?? null;
        })
      : null;
  const dateLabel = expiresAt
    ? new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long', year: 'numeric' }).format(expiresAt)
    : null;

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col items-center p-6 pt-16 lg:justify-center">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-bad/10 text-bad flex items-center justify-center text-2xl mx-auto mb-4">
            !
          </div>
          <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
          <p className="text-sm text-nickel">
            {dateLabel ? t('subtitleWithDate', { date: dateLabel }) : t(suspended ? 'subtitleSuspended' : 'subtitle')}
          </p>
          <div className="mt-6">
            <LogoutButton label={t('logout')} />
          </div>
        </div>
      </div>
    </main>
  );
}
