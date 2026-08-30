import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EmployeeTopBar } from '../../employee-topbar';

export default async function CorreoActualizadoPage() {
  const t = await getTranslations('employee.profile.emailChangeConfirm');

  return (
    <div className="min-h-screen flex flex-col">
      <EmployeeTopBar />
      {/* max-w-md, ícono/texto más grandes (no max-w-sm, w-14/text-lg/text-sm):
          después del topbar, esta pantalla es un solo mensaje centrado sin
          nada más al lado — a diferencia de las pantallas de confirmación
          con BrandPanel (registro/enviado y afines), acá no hay una
          segunda columna que absorba el espacio en blanco de un monitor
          de escritorio. */}
      <main className="flex-1 flex flex-col items-center p-6 pt-16">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-ok/10 text-ok flex items-center justify-center text-3xl mx-auto mb-4">
            ✓
          </div>
          <h1 className="text-2xl font-medium text-quartz mb-3">{t('title')}</h1>
          <p className="text-base text-nickel mb-6">{t('subtitle')}</p>
          <Link href="/perfil" className="inline-block bg-yale text-white rounded-lg py-2.5 px-6 text-sm">
            {t('ctaBack')}
          </Link>
        </div>
      </main>
    </div>
  );
}
