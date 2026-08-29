import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { scoreToProgressTier } from '@/lib/engines/scoring';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { getActionSuggestion } from '../diagnostico/accion/actions';
import { EmployeeTopBar } from '../employee-topbar';

export default async function InicioPage() {
  const baseEmployee = await requireEmployee();
  // Reynoso (auditoría UX, revisión 2): sin importar cuánto tiempo pase
  // desde que completó el diagnóstico, el destino de login sigue siendo
  // Inicio (ver post-login-destination.ts) — lo único que cambia con el
  // tiempo es esta invitación a actualizarlo. Editable desde
  // /admin/configuracion (PlatformSettings.followupInviteAfterDays).
  const settings = await getPlatformSettings();

  const financialState = await runWithTenantContext(employeeTenantContext(baseEmployee), () =>
    prisma.financialState.findUnique({ where: { employeeId: baseEmployee.id } })
  );

  // Nadie debería aterrizar aquí sin haber completado el diagnóstico
  // (post-login-destination.ts ya lo garantiza), pero un link directo a
  // /inicio guardado de una sesión vieja es posible — sin esto, la
  // pantalla intentaría mostrar un índice que no existe.
  if (!financialState?.lastDiagnosticCompletedAt) {
    redirect('/bienvenida');
  }

  const actionResult = await getActionSuggestion();

  const t = await getTranslations('employee.inicio');
  const tLevel = await getTranslations('diagnostic.result.levels');
  const tAll = await getTranslations();

  const cfhiRounded = Math.round(financialState.cfhiScore);
  const cfhiLevel = scoreToProgressTier(cfhiRounded, {
    mid: settings.progressTierMidCutoff,
    high: settings.progressTierHighCutoff
  });

  const daysSinceCompleted = Math.floor(
    (Date.now() - financialState.lastDiagnosticCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const showFollowupInvite = daysSinceCompleted >= settings.followupInviteAfterDays;

  return (
    <div className="min-h-screen flex flex-col">
      <EmployeeTopBar />
      <main className="flex-1 flex flex-col items-center p-6 pt-10">
        <div className="w-full max-w-sm">
          <p className="text-xs text-nickel mb-4">{t('greeting')}</p>

          {showFollowupInvite ? (
            <div className="bg-picton/10 border border-cola/30 rounded-lg p-4 mb-3.5 text-left">
              <p className="text-xs font-medium text-quartz mb-1">{t('followup.title')}</p>
              <p className="text-xs text-nickel mb-3">{t('followup.body')}</p>
              <Link href="/diagnostico" className="text-xs text-yale underline">
                {t('followup.cta')}
              </Link>
            </div>
          ) : null}

          <div className="bg-white border border-silver/60 rounded-xl p-4.5 mb-3.5 flex items-center gap-4">
            <span className="text-3xl font-semibold text-yale leading-none">{cfhiRounded}</span>
            <div>
              <p className="text-xs font-semibold text-quartz">
                {tLevel('prefix')}: {tLevel(cfhiLevel)}
              </p>
              <p className="text-[11px] text-nickel">{t('scoreLabel')}</p>
            </div>
          </div>

          {actionResult.kind === 'suggestion' ? (
            <div className="bg-white border border-silver/60 rounded-xl p-4.5 mb-3.5">
              <p className="text-xs font-semibold text-quartz mb-1">
                {actionResult.suggestion.status === 'COMMITTED' ? t('commitment.title') : t('nextStep.title')}
              </p>
              <p className="text-xs text-nickel mb-3 leading-relaxed">
                {tAll(actionResult.suggestion.titleI18nKey)}
              </p>
              <Link href="/diagnostico/accion" className="text-xs text-yale underline">
                {actionResult.suggestion.status === 'COMMITTED' ? t('commitment.cta') : t('nextStep.cta')}
              </Link>
            </div>
          ) : null}

          <Link
            href="/diagnostico/resultado"
            className="block text-center bg-yale text-white rounded-lg py-2.5 px-6 text-sm"
          >
            {t('ctaResult')}
          </Link>
        </div>
      </main>
    </div>
  );
}
