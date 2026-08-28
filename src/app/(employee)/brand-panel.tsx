import { getTranslations } from 'next-intl/server';

// Panel de marca para el lado izquierdo de las pantallas cortas del
// empleado en escritorio (Decisión 7: "se diseña primero para móvil y se
// adapta a pantallas más grandes" — esta es esa adaptación). Oculto por
// completo debajo de `lg`, así que no cambia nada del layout mobile-first
// ya existente. Reutiliza copy ya aprobado (employee.landing.title/
// subtitle, hoy sin usar en ningún lado; employee.trust.privacyGuarantee,
// ya usado en varias pantallas) en vez de inventar texto nuevo.
export async function BrandPanel() {
  const t = await getTranslations('employee.landing');
  const tTrust = await getTranslations('employee.trust');

  return (
    <div className="hidden lg:flex lg:flex-col lg:justify-center bg-gradient-to-br from-yale to-cola text-white px-16 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo estático propio del bundle, no necesita el optimizador de next/image */}
      <img src="/brand/caudall-logo-white.png" alt="Caudall" className="h-8 w-auto self-start mb-8" />
      <h2 className="text-4xl font-medium leading-snug mb-4 max-w-md">
        <span className="block text-white">{t('titleLine1')}</span>
        <span className="block text-picton">{t('titleLine2')}</span>
      </h2>
      <p className="text-white/80 text-lg max-w-lg leading-relaxed mb-8">
        {t.rich('subtitle', { em: (chunks) => <span className="text-picton font-semibold">{chunks}</span> })}
      </p>
      <p className="text-white/70 text-sm max-w-lg leading-relaxed flex items-start gap-2">
        <span aria-hidden>🔒</span>
        <span>{tTrust('privacyGuarantee')}</span>
      </p>
    </div>
  );
}
