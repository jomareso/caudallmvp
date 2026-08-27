import { getTranslations } from 'next-intl/server';
import { requireAdm } from '@/lib/auth/admin-context';
import { SendTestForm } from './send-test-form';

// Herramienta de verificación de la infraestructura de push (Decisión 9),
// no una función de producto — ver comentario en ./actions.ts.
export default async function AdminNotificacionesPage() {
  await requireAdm();

  const t = await getTranslations('admin.notifications');

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-1">{t('title')}</h1>
        <p className="text-xs text-nickel mb-6">{t('description')}</p>

        <div className="bg-white border border-silver/60 rounded-xl p-6">
          <SendTestForm
            labels={{
              emailLabel: t('emailLabel'),
              titleLabel: t('titleLabel'),
              bodyLabel: t('bodyLabel'),
              send: t('send'),
              sending: t('sending'),
              success: t('success')
            }}
          />
        </div>
      </div>
    </main>
  );
}
