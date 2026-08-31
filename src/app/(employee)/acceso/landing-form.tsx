'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { resolveAccessByEmail, validateEnrollmentCode } from '../actions';

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
  mobileHook: { line1: string; line2: string } | null;
}) {
  const t = useTranslations('employee.landing');
  const router = useRouter();

  // 'email' primero: si ya existe una cuenta activa con ese correo (en
  // cualquier empresa — personalEmail es único por tenant, no global), el
  // magic link sale directo, sin pedir código — el código (Decisión 6)
  // solo hace falta para saber a qué empresa pertenece un registro NUEVO,
  // no en cada login (ver resolveAccessByEmail en ../actions.ts). 'code'
  // es el paso de respaldo cuando el correo no matchea ninguna cuenta —
  // desde ahí sigue el flujo de registro de siempre (/registro), sin
  // ningún cambio.
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await resolveAccessByEmail(email);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.found) {
        router.push('/registro/enviado?existente=1');
        return;
      }
      setStep('code');
    });
  }

  function handleCodeSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await validateEnrollmentCode(code);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Reynoso: no tiene sentido pedir el correo dos veces — ya se
      // escribió en el paso anterior (el que reveló este campo de código,
      // ver handleEmailSubmit) para averiguar que esta cuenta era nueva.
      // Se lleva como query param a /registro, que lo usa solo para
      // precargar el campo (editable, no de solo lectura) — sigue siendo
      // el mismo formulario/validación de siempre.
      const params = new URLSearchParams({ code: code.trim().toUpperCase() });
      if (email) params.set('email', email);
      router.push(`/registro?${params.toString()}`);
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
            a la izquierda, repetirlo acá se vería duplicado. Reemplaza al
            título/subtítulo genérico de abajo en mobile (ver su
            `hidden lg:block` más abajo) — no se apila con él: con los dos a
            la vez, el mensaje salía casi repetido dos veces seguidas antes
            del formulario. Cada línea es su propio bloque (no un solo <p>
            con las dos concatenadas) — así cada componente de la promesa
            de valor queda en su propia línea, igual que BrandPanel en
            escritorio; text-balance evita que una sola línea larga se
            corte a media palabra en pantallas angostas. */}
        {mobileHook ? (
          <p className="text-sm text-nickel mb-4 lg:hidden text-balance">
            <span className="block">{mobileHook.line1}</span>
            <span className="block">{mobileHook.line2}</span>
          </p>
        ) : null}
        {content ? (
          <div className={mobileHook ? 'hidden lg:block' : undefined}>
            <p className="text-2xl font-semibold mb-2 leading-snug bg-gradient-to-r from-yale to-cola bg-clip-text text-transparent">
              {content.formTitle}
            </p>
            <p className="text-nickel text-base mb-10">{content.formSubtitle}</p>
          </div>
        ) : null}

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
            <label htmlFor="employeeEmail" className="block text-xs text-nickel mb-1">
              {t('emailLabel')}
            </label>
            <input
              id="employeeEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
            />

            {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
            >
              {isPending ? t('validating') : t('ctaContinue')}
            </button>
            {content ? <p className="text-[11px] text-nickel text-center mt-3">{content.timeEstimate}</p> : null}
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
            <p className="text-xs text-nickel mb-3">{t('noAccountFound')}</p>
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
          </form>
        )}

        {step === 'code' ? (
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setError(null);
            }}
            className="block mx-auto mt-4 text-xs text-nickel underline"
          >
            {t('ctaBackToEmail')}
          </button>
        ) : null}

        {/* En lg+ el panel de marca (brand-panel.tsx) ya muestra esta misma garantía — repetirla acá se vería duplicado */}
        {content ? <p className="text-[11px] text-nickel mt-4 lg:hidden">{content.privacyGuarantee}</p> : null}
      </div>
    </div>
  );
}
