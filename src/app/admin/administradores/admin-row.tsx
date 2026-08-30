'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAdminUser, setAdminUserActive } from './actions';

type ProfileType = 'ADM' | 'EMPRESA' | 'FUNCIONAL';
type FunctionalRole = 'METHODOLOGIST' | 'PRODUCT_ADMIN' | 'ANALYST' | 'VIEWER';

export function AdminRow({
  admin,
  tenants,
  isSelf,
  labels
}: {
  admin: {
    id: string;
    email: string;
    profileType: ProfileType;
    functionalRole: FunctionalRole | null;
    tenantId: string | null;
    active: boolean;
    tenantName: string | null;
    profileLabel: string;
  };
  tenants: { id: string; name: string }[];
  isSelf: boolean;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [profileType, setProfileType] = useState<ProfileType>(admin.profileType);
  const [tenantId, setTenantId] = useState(admin.tenantId ?? '');
  const [functionalRole, setFunctionalRole] = useState<FunctionalRole>(admin.functionalRole ?? 'VIEWER');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAdminUser({
        adminUserId: admin.id,
        profileType,
        tenantId: profileType === 'EMPRESA' ? tenantId : undefined,
        functionalRole: profileType === 'FUNCIONAL' ? functionalRole : undefined
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await setAdminUserActive({ adminUserId: admin.id, active: !admin.active });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      // flex-wrap en una fila (no space-y-2 apilado): en escritorio, con
      // más ancho disponible que una tarjeta de max-w-sm, los selects no
      // necesitan estirarse a lo ancho ni apilarse uno bajo otro — caben
      // junto al correo en la misma línea, y se envuelven solos en
      // pantallas chicas.
      <form onSubmit={handleSave} className="bg-white border border-cola rounded-lg p-3 text-xs flex flex-wrap items-center gap-2">
        <p className="text-quartz font-medium">{admin.email}</p>

        <select
          value={profileType}
          onChange={(event) => setProfileType(event.target.value as ProfileType)}
          className="border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
        >
          <option value="ADM">{labels.profileTypeAdm}</option>
          <option value="EMPRESA">{labels.profileTypeEmpresa}</option>
          <option value="FUNCIONAL">{labels.profileTypeFuncional}</option>
        </select>

        {profileType === 'EMPRESA' ? (
          <select
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            className="border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
          >
            <option value="">{labels.tenantPlaceholder}</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        ) : null}

        {profileType === 'FUNCIONAL' ? (
          <select
            value={functionalRole}
            onChange={(event) => setFunctionalRole(event.target.value as FunctionalRole)}
            className="border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
          >
            <option value="METHODOLOGIST">{labels.functionalRoleMethodologist}</option>
            <option value="PRODUCT_ADMIN">{labels.functionalRoleProductAdmin}</option>
            <option value="ANALYST">{labels.functionalRoleAnalyst}</option>
            <option value="VIEWER">{labels.functionalRoleViewer}</option>
          </select>
        ) : null}

        <div className="flex gap-2 ml-auto">
          <button type="submit" disabled={isPending} className="bg-yale text-white rounded-lg px-3 py-1.5 disabled:opacity-60">
            {isPending ? labels.saving : labels.saveCta}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-nickel px-3 py-1.5">
            {labels.cancelCta}
          </button>
        </div>

        {error ? <p className="basis-full text-bad">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="bg-white border border-silver/60 rounded-lg p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-quartz font-medium">
            {admin.email}
            {!admin.active ? (
              <span className="ml-2 text-[10px] bg-silver/40 text-nickel rounded px-1.5 py-0.5 align-middle">
                {labels.inactiveBadge}
              </span>
            ) : null}
          </p>
          <p className="text-nickel">
            {admin.profileLabel}
            {admin.tenantName ? ` · ${admin.tenantName}` : ''}
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="text-cola">
            {labels.editCta}
          </button>
          {!isSelf ? (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isPending}
              className={admin.active ? 'text-bad disabled:opacity-60' : 'text-ok disabled:opacity-60'}
            >
              {admin.active ? labels.deactivateCta : labels.activateCta}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-bad mt-1">{error}</p> : null}
    </div>
  );
}
