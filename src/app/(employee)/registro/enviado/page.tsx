import { getTranslations } from 'next-intl/server';
import { BrandPanel } from '../../acceso/brand-panel';

export default async function EnviadoPage({
  searchParams
}: {
  searchParams: { existente?: string };
}) {
  const t = await getTranslations('employee.confirmation');
  // Nunca se le dice "correo inválido" ni "ya existe una cuenta" como
  // error — requestMagicLink ((employee)/actions.ts) trata registro y
  // login como la misma acción y siempre manda el link. Esto solo cambia
  // el aviso para que quien ya tenía cuenta entienda que es un login, no
  // un registro nuevo que se perdió.
  const isExisting = searchParams.existente === '1';

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col items-center p-6 pt-16 lg:justify-center">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-picton/15 text-yale flex items-center justify-center text-2xl mx-auto mb-4">
            ✉️
          </div>
          <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
          <p className="text-sm text-nickel">{t('subtitle')}</p>
          {isExisting ? (
            <p className="text-xs text-yale bg-picton/10 rounded-lg px-3 py-2.5 mt-4 text-left">
              {t('existingNotice')}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
