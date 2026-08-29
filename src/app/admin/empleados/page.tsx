import { getTranslations } from 'next-intl/server';
import { requireAdm } from '@/lib/auth/admin-context';
import { EmployeeSearch } from './employee-search';

// Herramienta de soporte/pruebas, ADM-only: busca un empleado por correo y
// permite reiniciarlo por completo (ver actions.ts) — para volver a probar
// el flujo desde cero con el mismo código de licencia, sin tener que crear
// un tenant/licencia nueva cada vez.
export default async function EmpleadosPage() {
  await requireAdm();
  const t = await getTranslations('admin.empleados');

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-lg font-medium text-quartz mb-1">{t('title')}</h1>
        <p className="text-xs text-nickel mb-6">{t('subtitle')}</p>

        <EmployeeSearch
          labels={{
            emailLabel: t('emailLabel'),
            emailPlaceholder: t('emailPlaceholder'),
            searchCta: t('searchCta'),
            searching: t('searching'),
            noResults: t('noResults'),
            tenantLabel: t('tenantLabel'),
            createdAtLabel: t('createdAtLabel'),
            licenseLabel: t('licenseLabel'),
            noLicense: t('noLicense'),
            resetCta: t('resetCta'),
            resetting: t('resetting'),
            resetConfirm: t('resetConfirm'),
            resetSuccess: t('resetSuccess'),
            errorGeneric: t('errorNotFound')
          }}
        />
      </div>
    </main>
  );
}
