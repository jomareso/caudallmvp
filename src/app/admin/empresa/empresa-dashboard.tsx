import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { getTenantAggregates } from '@/lib/engines/tenant-aggregates';
import { scoreToDimensionState, scoreToProgressTier } from '@/lib/engines/scoring';
import { getPlatformSettings } from '@/lib/settings/platform-settings';

const BAND_CLASS: Record<string, string> = {
  CRITICAL: 'bg-bad/10 text-bad',
  UNMET: 'bg-warn/10 text-warn',
  PARTIAL: 'bg-warn/10 text-warn',
  MET: 'bg-ok/10 text-ok',
  NA: 'bg-silver/20 text-nickel'
};

// Metodología v1.5 §6: el dashboard de RRHH resume la condición general con
// Vulnerables/Sobreviviendo/Saludables (3 niveles), distinto de las 4
// bandas que usa el detalle por dimensión más abajo en esta misma página.
const TIER_CLASS: Record<string, string> = {
  LOW: 'bg-bad/10 text-bad',
  MID: 'bg-warn/10 text-warn',
  HIGH: 'bg-ok/10 text-ok'
};

// Extraído de admin/empresa/page.tsx para reusarlo también desde la vista
// "Ver como RRHH" de ADM (admin/empresas/[id]/dashboard) — mismo cálculo,
// mismo diseño, sin duplicar lógica. Corre bajo contexto 'tenant' sin
// importar quién llama: el aislamiento real lo da RLS a nivel de
// PostgreSQL, no quién invoca esta función (Decisión 1).
export async function EmpresaDashboard({
  tenantId,
  backHref
}: {
  tenantId: string;
  // Si viene, se muestra un aviso de "estás viendo como ADM" con un link
  // de vuelta — ausente cuando lo renderiza la propia RRHH. Tipado con
  // Route (no `string` plano) porque typedRoutes solo puede validar un
  // href literal en el JSX, no uno que llegue por prop.
  backHref?: Route;
}) {
  return runWithTenantContext({ kind: 'tenant', tenantId }, async () => {
    // Tenant es catálogo de plataforma (no lleva RLS), pero se lee dentro
    // del mismo contexto que el resto de la página por consistencia.
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) redirect('/admin');

    const t = await getTranslations('admin.empresa');
    const tDim = await getTranslations('diagnostic.dimensions');
    const tBand = await getTranslations('diagnostic.result.bands');
    const tTier = await getTranslations('admin.empresa.tiers');
    const tViewAs = await getTranslations('admin.viewAs');

    const [aggregates, licenseCounts, settings] = await Promise.all([
      getTenantAggregates(tenant.id),
      prisma.license.groupBy({ by: ['status'], where: { tenantId: tenant.id }, _count: true }),
      getPlatformSettings()
    ]);

    const countByStatus = Object.fromEntries(licenseCounts.map((c) => [c.status, c._count])) as Record<
      'UNUSED' | 'ACTIVE' | 'EXPIRED',
      number
    >;
    const licenseSummary = {
      total: licenseCounts.reduce((sum, c) => sum + c._count, 0),
      unused: countByStatus.UNUSED ?? 0,
      active: countByStatus.ACTIVE ?? 0,
      expired: countByStatus.EXPIRED ?? 0
    };

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = await prisma.license.count({
      where: {
        tenantId: tenant.id,
        status: 'ACTIVE',
        expiresAt: { gte: new Date(), lte: thirtyDaysFromNow }
      }
    });

    const banner = backHref ? (
      <div className="bg-picton/10 border border-cola/30 rounded-lg px-4 py-2.5 mb-6 flex items-center justify-between gap-3 text-xs">
        <span className="text-quartz">{tViewAs('banner', { tenantName: tenant.name })}</span>
        <Link href={backHref} className="text-yale font-medium shrink-0 hover:underline">
          {tViewAs('exit')}
        </Link>
      </div>
    ) : null;

    // La tasa de finalización es participación (cuántos se registraron,
    // cuántos terminaron), no resultado del diagnóstico — se muestra igual
    // que las licencias, sin esperar al umbral de anonimato.
    const completionCard = (
      <div className="bg-white border border-silver/60 rounded-xl p-4 mb-6">
        <p className="text-xs text-nickel mb-1">{t('completionTitle')}</p>
        <p className="text-2xl font-medium text-quartz leading-none mb-1">
          {Math.round(aggregates.completionRate * 100)}%
        </p>
        <p className="text-[11px] text-nickel">
          {t('completionDetail', { completed: aggregates.employeeCount, registered: aggregates.registeredCount })}
        </p>
      </div>
    );

    // Las licencias son visibles aunque todavía no haya suficientes
    // empleados con diagnóstico completo para el umbral de anonimato — no
    // son datos de un empleado en particular (Decisión 1), y RRHH necesita
    // saber cuántas le quedan disponibles desde el primer día.
    const licenseCard = (
      <div className="bg-white border border-silver/60 rounded-xl p-4 mb-6">
        <p className="text-xs text-nickel mb-2">{t('licensesTitle')}</p>
        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <div>
            <p className="text-xl font-medium text-quartz">{licenseSummary.unused}</p>
            <p className="text-[11px] text-nickel">{t('licensesUnused')}</p>
          </div>
          <div>
            <p className="text-xl font-medium text-quartz">{licenseSummary.active}</p>
            <p className="text-[11px] text-nickel">{t('licensesActive')}</p>
          </div>
          <div>
            <p className="text-xl font-medium text-quartz">{licenseSummary.expired}</p>
            <p className="text-[11px] text-nickel">{t('licensesExpired')}</p>
          </div>
        </div>
        <p className="text-[11px] text-nickel text-center">{t('licensesTotal', { total: licenseSummary.total })}</p>
        {expiringSoon > 0 ? (
          <p className="text-[11px] text-warn text-center mt-1">{t('licensesExpiringSoon', { count: expiringSoon })}</p>
        ) : null}
      </div>
    );

    if (aggregates.status === 'INSUFFICIENT_ANONYMITY') {
      return (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center">
            {banner}
            <h1 className="text-lg font-medium text-quartz mb-6">{t('title', { tenantName: tenant.name })}</h1>
            {completionCard}
            {licenseCard}
            <h2 className="text-base font-medium text-quartz mb-2">{t('insufficientTitle')}</h2>
            <p className="text-sm text-nickel">
              {t('insufficientBody', { minRequired: aggregates.minRequired, count: aggregates.employeeCount })}
            </p>
          </div>
        </main>
      );
    }

    const cfhiRounded = Math.round(aggregates.averageCfhi);
    const cfhiTier = scoreToProgressTier(cfhiRounded, {
      mid: settings.progressTierMidCutoff,
      high: settings.progressTierHighCutoff
    });

    // averageCfhiCard: mismo formato de card que completionCard/licenseCard/
    // actionCommitmentCard (título + valor grande), no la variante suelta
    // sin borde de antes — así las 4 caben en una sola fila en escritorio
    // (stat-grid del mockup de rediseño, task #47) sin que una desentone.
    const averageCfhiCard = (
      <div className="bg-white border border-silver/60 rounded-xl p-4">
        <p className="text-xs text-nickel mb-1">{t('averageCfhiLabel')}</p>
        <p className="text-3xl font-medium text-yale leading-none mb-1.5">{cfhiRounded}</p>
        <span className={`inline-block text-[11px] px-2.5 py-1 rounded-lg ${TIER_CLASS[cfhiTier]}`}>
          {tTier(cfhiTier)}
        </span>
      </div>
    );

    const actionCommitmentCard = (
      <div className="bg-white border border-silver/60 rounded-xl p-4">
        <p className="text-xs text-nickel mb-1">{t('actionCommitmentTitle')}</p>
        <p className="text-2xl font-medium text-quartz leading-none mb-1">
          {Math.round(aggregates.actionCommitmentRate * 100)}%
        </p>
        <p className="text-[11px] text-nickel">{t('actionCommitmentDetail')}</p>
      </div>
    );

    return (
      <main className="flex-1 p-6 lg:p-8">
        <div className="max-w-sm mx-auto lg:max-w-none">
          {banner}
          <header className="mb-6 lg:mb-8 text-center lg:text-left">
            <h1 className="text-lg lg:text-xl font-medium text-quartz mb-1">{t('title', { tenantName: tenant.name })}</h1>
            <p className="text-xs text-nickel">{t('employeeCount', { count: aggregates.employeeCount })}</p>
          </header>

          {/* En escritorio, las 4 métricas de nivel superior van en una
              fila (mockup: .stat-grid) en vez de apiladas usando el ancho
              real — en móvil siguen apiladas, mismo orden. */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6 lg:mb-8">
            {completionCard}
            {licenseCard}
            {averageCfhiCard}
            {actionCommitmentCard}
          </div>

          {/* Condición general (3 cajas cortas) es bastante más corto que
              Por dimensión (5 filas) — un 50/50 con la misma altura
              forzada (comportamiento por default de CSS grid) dejaba a
              Condición general con un bloque vacío grande abajo, real
              incluso con datos reales de verdad (no solo un artefacto de
              prueba local sin metodología). En vez de forzar la misma
              altura, se le da a Condición general una columna angosta
              (1 de 3) con la nota de privacidad debajo — usa el espacio
              en vez de dejarlo en blanco — y a Por dimensión el resto
              del ancho (2 de 3), donde su contenido sí lo necesita. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
            <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="bg-white border border-silver/60 rounded-xl p-6">
                <h2 className="text-sm font-medium text-quartz mb-3">{t('conditionOverviewTitle')}</h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(['LOW', 'MID', 'HIGH'] as const).map((tier) => (
                    // TIER_CLASS (rojo/ámbar/verde): antes esta grilla no
                    // tenía ningún color, a diferencia del resto de la
                    // página (el pill de CFHI promedio y los badges de
                    // "Por dimensión" sí usan semáforo).
                    <div key={tier} className={`rounded-lg py-2.5 ${TIER_CLASS[tier]}`}>
                      <p className="text-base font-semibold leading-none mb-1">{aggregates.cfhiTierDistribution[tier]}</p>
                      <p className="text-[10px] opacity-80">{tTier(tier)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-picton/10 border border-cola/20 rounded-lg px-4 py-3">
                <p className="text-[11px] text-nickel">{t('privacyNote')}</p>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white border border-silver/60 rounded-xl p-6">
              <h2 className="text-sm font-medium text-quartz mb-3">{t('dimensionsTitle')}</h2>
              <div className="space-y-2">
                {aggregates.dimensions.map((dimension) => {
                  const score = dimension.averageScore !== null ? Math.round(dimension.averageScore) : null;
                  const band = score !== null ? scoreToDimensionState(score) : 'NA';
                  return (
                    <div key={dimension.code} className="border border-silver/50 rounded-lg p-3 bg-white">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-quartz">{tDim(dimension.code)}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg ${BAND_CLASS[band]}`}>
                          {score !== null ? `${score} · ${tBand(band)}` : tBand('NA')}
                        </span>
                      </div>
                      {score !== null ? (
                        <div className="h-1.5 bg-silver/30 rounded-full overflow-hidden">
                          <div className="h-full bg-cola" style={{ width: `${score}%` }} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  });
}
