import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { getTenantAggregates } from '@/lib/engines/tenant-aggregates';
import { getTenantSegmentAggregates, type SegmentFilters } from '@/lib/engines/tenant-segment-aggregates';
import type { CtxKey } from '@/lib/engines/social-comparison';
import { scoreToDimensionState, scoreToProgressTier } from '@/lib/engines/scoring';
import { getPlatformSettings } from '@/lib/settings/platform-settings';

// Opciones del filtro de segmentación (spec: "permitir filtrar/analizar
// por las mismas 5 variables" del Motor de Comparación Social) — mismas
// preguntas/estados del banco de contexto (CTX-01/02/04/08/09), reusando
// sus traducciones existentes en vez de duplicar el texto. DECLINED queda
// fuera a propósito: no tiene sentido filtrar por "prefirió no responder",
// y excluirlo reduce la superficie de un segmento accidentalmente chico.
const CTX_FILTER_DEFS: { key: CtxKey; questionCode: string; states: string[] }[] = [
  {
    key: 'age',
    questionCode: 'CTX-01',
    states: ['AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54', 'AGE_55_64', 'AGE_65_PLUS']
  },
  {
    key: 'income',
    questionCode: 'CTX-04',
    states: ['INC_LT_25K', 'INC_25_49K', 'INC_50_74K', 'INC_75_99K', 'INC_100_149K', 'INC_150_199K', 'INC_200K_PLUS']
  },
  { key: 'dependents', questionCode: 'CTX-02', states: ['DEP_0', 'DEP_1', 'DEP_2', 'DEP_3', 'DEP_4_PLUS'] },
  {
    key: 'employment',
    questionCode: 'CTX-09',
    states: [
      'PRIVATE_EMPLOYEE',
      'PUBLIC_EMPLOYEE',
      'SELF_EMPLOYED',
      'EMPLOYER',
      'UNEMPLOYED',
      'STUDENT',
      'RETIRED',
      'HOMEMAKER'
    ]
  },
  { key: 'sex', questionCode: 'CTX-08', states: ['FEMALE', 'MALE'] }
];

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
  backHref,
  searchParams
}: {
  tenantId: string;
  // Si viene, se muestra un aviso de "estás viendo como ADM" con un link
  // de vuelta — ausente cuando lo renderiza la propia RRHH. Tipado con
  // Route (no `string` plano) porque typedRoutes solo puede validar un
  // href literal en el JSX, no uno que llegue por prop.
  backHref?: Route;
  // Filtros de segmentación (spec §16), leídos de la URL — un <form
  // method="GET"> plano sin JS, no un componente cliente con estado: cada
  // combinación de filtros es una URL compartible/recargable, y el umbral
  // de anonimato se re-evalúa en cada request igual que el resto del
  // motor (nunca queda cacheado un resultado que ya no cumpliría el N).
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return runWithTenantContext({ kind: 'tenant', tenantId }, async () => {
    // Tenant es catálogo de plataforma (no lleva RLS), pero se lee dentro
    // del mismo contexto que el resto de la página por consistencia.
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) redirect('/admin');

    const t = await getTranslations('admin.empresa');
    const tSeg = await getTranslations('admin.empresa.segmentation');
    const tQ = await getTranslations('diagnostic.questions');
    const tDim = await getTranslations('diagnostic.dimensions');
    const tBand = await getTranslations('diagnostic.result.bands');
    const tTier = await getTranslations('admin.empresa.tiers');
    const tViewAs = await getTranslations('admin.viewAs');

    const segmentFilters: SegmentFilters = {};
    for (const def of CTX_FILTER_DEFS) {
      const raw = searchParams?.[def.key];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value && def.states.includes(value)) segmentFilters[def.key] = value;
    }
    const hasSegmentFilters = Object.keys(segmentFilters).length > 0;
    const segmentResult = hasSegmentFilters ? await getTenantSegmentAggregates(tenant.id, segmentFilters) : null;

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
          {/* max-w-sm en mobile, lg:max-w-2xl en escritorio (no max-w-sm
              fijo): este branch (tenant nuevo/chico, todavía sin
              suficientes empleados para el umbral de anonimato) se había
              quedado angosto cuando el resto del dashboard de RRHH, más
              abajo en este mismo archivo, ya tiene su propio ancho real
              — sobraba mucho espacio a los lados en cualquier monitor de
              escritorio. Texto más grande en lg+ por el mismo motivo.
              Las tarjetas de completionCard/licenseCard se quedan
              apiladas (no lado a lado): partidas en dos columnas dentro
              de este ancho quedaban chicas y apretadas — apiladas pero
              con más ancho disponible cada una se ve mejor. */}
          <div className="w-full max-w-sm lg:max-w-2xl text-center">
            {banner}
            <h1 className="text-lg lg:text-2xl font-medium text-quartz mb-6">{t('title', { tenantName: tenant.name })}</h1>
            {completionCard}
            {licenseCard}
            <h2 className="text-base lg:text-xl font-medium text-quartz mb-2">{t('insufficientTitle')}</h2>
            <p className="text-sm lg:text-base text-nickel">
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

          <div className="bg-white border border-silver/60 rounded-xl p-6 mt-4">
            <h2 className="text-sm font-medium text-quartz mb-1">{tSeg('title')}</h2>
            <p className="text-xs text-nickel mb-4">{tSeg('description')}</p>

            <form className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end mb-2">
              {CTX_FILTER_DEFS.map((def) => (
                <div key={def.key}>
                  <label htmlFor={`segment-${def.key}`} className="block text-[11px] text-nickel mb-1">
                    {tSeg(`${def.key}Label`)}
                  </label>
                  <select
                    id={`segment-${def.key}`}
                    name={def.key}
                    defaultValue={segmentFilters[def.key] ?? ''}
                    className="w-full border border-silver rounded-lg px-2.5 py-2 text-xs text-quartz focus:outline-none focus:border-cola"
                  >
                    <option value="">{tSeg('allOption')}</option>
                    {def.states.map((state) => (
                      <option key={state} value={state}>
                        {tQ(`${def.questionCode}.options.${state}`)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-yale text-white rounded-lg py-2 text-xs">
                  {tSeg('applyCta')}
                </button>
                {hasSegmentFilters ? (
                  <Link
                    href={(backHref ?? '/admin/empresa') as Route}
                    className="flex-1 flex items-center justify-center border border-silver rounded-lg py-2 text-xs text-nickel"
                  >
                    {tSeg('clearCta')}
                  </Link>
                ) : null}
              </div>
            </form>

            {segmentResult && segmentResult.status === 'INSUFFICIENT_ANONYMITY' ? (
              <div className="bg-picton/10 border border-cola/20 rounded-lg px-4 py-3 mt-2">
                <p className="text-xs font-medium text-quartz mb-1">{tSeg('insufficientTitle')}</p>
                <p className="text-[11px] text-nickel">
                  {tSeg('insufficientBody', { minRequired: segmentResult.minRequired, count: segmentResult.employeeCount })}
                </p>
              </div>
            ) : null}

            {segmentResult && segmentResult.status === 'OK' ? (
              <div className="mt-4 pt-4 border-t border-silver/40">
                <p className="text-xs text-nickel mb-3">{tSeg('resultTitle')}</p>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1">
                    <div className="bg-silver/10 rounded-lg p-4 text-center">
                      <p className="text-2xl font-medium text-yale leading-none mb-1.5">
                        {Math.round(segmentResult.averageCfhi)}
                      </p>
                      <p className="text-[11px] text-nickel mb-3">{t('averageCfhiLabel')}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {(['LOW', 'MID', 'HIGH'] as const).map((tier) => (
                          <div key={tier} className={`rounded-lg py-2 ${TIER_CLASS[tier]}`}>
                            <p className="text-sm font-semibold leading-none mb-1">
                              {segmentResult.cfhiTierDistribution[tier]}
                            </p>
                            <p className="text-[9px] opacity-80">{tTier(tier)}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-nickel mt-3">{segmentResult.employeeCount}</p>
                    </div>
                  </div>
                  <div className="lg:col-span-2 space-y-2">
                    {segmentResult.dimensions.map((dimension) => {
                      const score = dimension.averageScore !== null ? Math.round(dimension.averageScore) : null;
                      const band = score !== null ? scoreToDimensionState(score) : 'NA';
                      return (
                        <div key={dimension.code} className="border border-silver/50 rounded-lg p-2.5 bg-white">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-quartz">{tDim(dimension.code)}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg ${BAND_CLASS[band]}`}>
                              {score !== null ? `${score} · ${tBand(band)}` : tBand('NA')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    );
  });
}
