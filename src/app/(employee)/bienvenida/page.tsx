import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { getPlatformDiagnosticStats } from '@/lib/engines/diagnostic-stats';

export default async function BienvenidaPage() {
  const baseEmployee = await requireEmployee();
  const [employee, stats] = await Promise.all([
    runWithTenantContext(employeeTenantContext(baseEmployee), () =>
      prisma.employee.findUniqueOrThrow({ where: { id: baseEmployee.id }, include: { tenant: true } })
    ),
    getPlatformDiagnosticStats()
  ]);

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

        <div className="bg-picton/10 border border-cola/30 rounded-lg p-4 text-left mb-6">
          <p className="text-xs font-medium text-quartz mb-1">{t('beforeStart.title')}</p>
          <p className="text-xs text-nickel">
            {stats
              ? t('beforeStart.bodyWithStats', { minutes: stats.averageMinutes, questions: stats.averageQuestions })
              : t('beforeStart.body')}
          </p>
        </div>

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
