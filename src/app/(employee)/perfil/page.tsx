import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireEmployeeWithContext } from '@/lib/auth/employee-context';
import { getOrCreateNotificationPreference, type NotificationKey } from './actions';
import { EmployeeTopBar } from '../employee-topbar';
import { BackLink } from './back-link';
import { LogoutButton } from './logout-button';
import { EmailEditor } from './email-editor';
import { NotificationToggle } from './notification-toggle';

const NOTIFICATION_KEYS: NotificationKey[] = ['commitment', 'incomplete', 'resultUpdated', 'newStep', 'licenseExpiring'];

export default async function PerfilPage() {
  const { employee, preference } = await requireEmployeeWithContext(async (baseEmployee) => {
    const [employeeWithRelations, notificationPreference] = await Promise.all([
      prisma.employee.findUniqueOrThrow({
        where: { id: baseEmployee.id },
        include: { tenant: true, license: true }
      }),
      getOrCreateNotificationPreference(baseEmployee.id)
    ]);
    return { employee: employeeWithRelations, preference: notificationPreference };
  });

  const t = await getTranslations('employee.profile');
  const tAccount = await getTranslations('employee.profile.account');
  const tEmail = await getTranslations('employee.profile.email');
  const tNotif = await getTranslations('employee.profile.notifications');

  const dateFormat = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen flex flex-col">
      <EmployeeTopBar />
      <main className="flex-1 flex flex-col items-center p-6 pt-10">
        <div className="w-full max-w-sm lg:max-w-md">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-semibold text-quartz">{t('title')}</p>
            <BackLink label={t('back')} />
          </div>

          {/* Cuenta */}
          <section className="bg-white border border-silver/60 rounded-xl p-4.5 mb-3.5">
            <h2 className="text-sm font-semibold text-quartz mb-3">{tAccount('title')}</h2>
            <div className="flex justify-between text-xs py-2 border-t border-silver/20 first:border-t-0 first:pt-0">
              <span className="text-nickel">{tAccount('companyLabel')}</span>
              <span className="text-quartz font-medium">{employee.tenant.name}</span>
            </div>
            {employee.license?.expiresAt ? (
              <div className="flex justify-between text-xs py-2 border-t border-silver/20">
                <span className="text-nickel">{tAccount('licenseExpiresLabel')}</span>
                <span className="text-quartz font-medium">{dateFormat.format(employee.license.expiresAt)}</span>
              </div>
            ) : null}
            <div className="mt-2.5">
              <LogoutButton label={tAccount('logout')} />
            </div>
          </section>

          {/* Correo */}
          <section className="bg-white border border-silver/60 rounded-xl p-4.5 mb-3.5">
            <h2 className="text-sm font-semibold text-quartz mb-1">{tEmail('title')}</h2>
            <p className="text-[11px] text-nickel mb-3 leading-relaxed">{tEmail('subtitle')}</p>

            <div className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className="text-xs font-medium text-quartz">{tEmail('channelLabel')}</p>
                <p className="text-[11px] text-nickel">{tEmail('channelDesc')}</p>
              </div>
              <NotificationToggle target={{ channel: true }} initialOn={preference.emailChannelEnabled} />
            </div>

            <div className="mt-3">
              <p className="text-[11px] text-nickel mb-1">{tEmail('currentLabel')}</p>
              <EmailEditor
                currentEmail={employee.personalEmail}
                labels={{
                  currentLabel: tEmail('currentLabel'),
                  change: tEmail('change'),
                  newEmailLabel: tEmail('newEmailLabel'),
                  changeNotice: tEmail('changeNotice'),
                  save: tEmail('save'),
                  cancel: tEmail('cancel'),
                  changeRequested: tEmail('changeRequested')
                }}
              />
            </div>
          </section>

          {/* Notificaciones */}
          <section className="bg-white border border-silver/60 rounded-xl p-4.5">
            <h2 className="text-sm font-semibold text-quartz mb-1">{tNotif('title')}</h2>
            <p className="text-[11px] text-nickel mb-3 leading-relaxed">{tNotif('subtitle')}</p>

            {NOTIFICATION_KEYS.map((key, i) => (
              <div
                key={key}
                className={`flex items-start justify-between gap-4 py-2.5 ${i > 0 ? 'border-t border-silver/20' : ''}`}
              >
                <div>
                  <p className="text-xs font-medium text-quartz">{tNotif(`types.${key}.name`)}</p>
                  <p className="text-[11px] text-nickel leading-relaxed">{tNotif(`types.${key}.desc`)}</p>
                </div>
                <NotificationToggle target={{ channel: false, key }} initialOn={preference[key]} />
              </div>
            ))}

            <p className="text-[10px] text-nickel bg-white border border-dashed border-silver rounded-lg px-3 py-2.5 mt-3.5 leading-relaxed">
              {tNotif('criteriaNote')}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
