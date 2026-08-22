import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

export default async function BienvenidaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: { tenant: true }
  });
  if (!employee) redirect('/');

  const t = await getTranslations('employee.welcome');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-ok/10 text-ok flex items-center justify-center text-2xl mx-auto mb-4">
          ✓
        </div>
        <h1 className="text-lg font-medium text-quartz mb-2">
          {t('title', { tenantName: employee.tenant.name })}
        </h1>
        <p className="text-sm text-nickel mb-6">{t('subtitle')}</p>
        <Link
          href="/diagnostico"
          className="inline-block bg-yale text-white rounded-lg py-2.5 px-6 text-sm"
        >
          {t('ctaStart')}
        </Link>
      </div>
    </main>
  );
}
