'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAdminUser } from './actions';

type ProfileType = 'ADM' | 'EMPRESA' | 'FUNCIONAL';
type FunctionalRole = 'METHODOLOGIST' | 'PRODUCT_ADMIN' | 'ANALYST' | 'VIEWER';

export function CreateAdminForm({
  tenants,
  labels
}: {
  tenants: { id: string; name: string }[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [profileType, setProfileType] = useState<ProfileType>('EMPRESA');
  const [tenantId, setTenantId] = useState('');
  const [functionalRole, setFunctionalRole] = useState<FunctionalRole>('VIEWER');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await createAdminUser({
        email,
        profileType,
        tenantId: profileType === 'EMPRESA' ? tenantId : undefined,
        functionalRole: profileType === 'FUNCIONAL' ? functionalRole : undefined
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      setEmail('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
      <label htmlFor="email" className="block text-xs text-nickel mb-1">
        {labels.emailLabel}
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={labels.emailPlaceholder}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      <label htmlFor="profileType" className="block text-xs text-nickel mb-1">
        {labels.profileTypeLabel}
      </label>
      <select
        id="profileType"
        value={profileType}
        onChange={(event) => setProfileType(event.target.value as ProfileType)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      >
        <option value="ADM">{labels.profileTypeAdm}</option>
        <option value="EMPRESA">{labels.profileTypeEmpresa}</option>
        <option value="FUNCIONAL">{labels.profileTypeFuncional}</option>
      </select>

      {profileType === 'EMPRESA' ? (
        <>
          <label htmlFor="tenantId" className="block text-xs text-nickel mb-1">
            {labels.tenantLabel}
          </label>
          <select
            id="tenantId"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
          >
            <option value="">{labels.tenantPlaceholder}</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {profileType === 'FUNCIONAL' ? (
        <>
          <label htmlFor="functionalRole" className="block text-xs text-nickel mb-1">
            {labels.functionalRoleLabel}
          </label>
          <select
            id="functionalRole"
            value={functionalRole}
            onChange={(event) => setFunctionalRole(event.target.value as FunctionalRole)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
          >
            <option value="METHODOLOGIST">{labels.functionalRoleMethodologist}</option>
            <option value="PRODUCT_ADMIN">{labels.functionalRoleProductAdmin}</option>
            <option value="ANALYST">{labels.functionalRoleAnalyst}</option>
            <option value="VIEWER">{labels.functionalRoleViewer}</option>
          </select>
        </>
      ) : null}

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}
      {success ? <p className="text-xs text-ok mb-3">{labels.success}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
      >
        {isPending ? labels.creating : labels.cta}
      </button>
    </form>
  );
}
