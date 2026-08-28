'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { validateEnrollmentCode } from '../actions';

// formTitle/formSubtitle/timeEstimate/privacyGuarantee vienen del panel de
// contenido (LandingBlock colaborador_form_intro/colaborador_trust) — este
// es un Client Component y no puede leer la base de datos directo, así
// que page.tsx los resuelve del lado del servidor y los pasa como props.
// El resto (labels funcionales, botones) se queda en next-intl.
export function LandingForm({
  content,
  mobileHook
}: {
  content: { formTitle: string; formSubtitle: string; timeEstimate: string; privacyGuarantee: string } | null;
  mobileHook: string | null;
}) {
  const t = useTranslations('employee.landing');
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await validateEnrollmentCode(code);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/registro?code=${encodeURIComponent(code.trim().toUpperCase())}`);
    });
  }

  return (
    <div className="flex flex-col items-center p-6 pt-16 lg:justify-center">
      <div className="w-full max-w-md text-center">
        {/* Logo real y estático, igual que brand-panel.tsx — no depende del
            logo que se pueda subir en /admin/configuracion (ese mecanismo
            era un reemplazo manual de antes de tener el archivo real; hoy
            solo generaría inconsistencia de tamaño entre los dos lados). */}
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático propio del bundle, no necesita el optimizador de next/image */}
        <img src="/brand/caudall-logo-color.png" alt="Caudall" className="h-8 mx-auto mb-6" />
        {/* Solo en mobile — en lg+ el mismo mensaje ya lo muestra BrandPanel
            a la izquierda, repetirlo acá se vería duplicado. */}
        {mobileHook ? <p className="text-sm text-nickel mb-4 lg:hidden">{mobileHook}</p> : null}
        {content ? (
          <>
            <p className="text-2xl font-semibold mb-2 leading-snug bg-gradient-to-r from-yale to-cola bg-clip-text text-transparent">
              {content.formTitle}
            </p>
            <p className="text-nickel text-base mb-10">{content.formSubtitle}</p>
          </>
        ) : null}

        <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
          <label htmlFor="enrollmentCode" className="block text-xs text-nickel mb-1">
            {t('enrollmentCodeLabel')}
          </label>
          <input
            id="enrollmentCode"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t('enrollmentCodePlaceholder')}
            autoCapitalize="characters"
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz text-center uppercase tracking-wide mb-3 focus:outline-none focus:border-cola"
          />

          {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
          >
            {isPending ? t('validating') : error ? t('ctaRetry') : t('ctaContinue')}
          </button>
          {content ? <p className="text-[11px] text-nickel text-center mt-3">{content.timeEstimate}</p> : null}
        </form>

        {/* En lg+ el panel de marca (brand-panel.tsx) ya muestra esta misma garantía — repetirla acá se vería duplicado */}
        {content ? <p className="text-[11px] text-nickel mt-4 lg:hidden">{content.privacyGuarantee}</p> : null}
      </div>
    </div>
  );
}
