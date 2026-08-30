'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTenant, type AdminEmailOutcome } from './actions';

export function CreateTenantForm({
  durationOptions,
  labels
}: {
  durationOptions: { value: number; label: string }[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [licenseCount, setLicenseCount] = useState('20');
  // Preselecciona la duración más larga (mismo default de siempre: con
  // [3, 6, 12] cae en 12) — ver durationOptions, viene ordenado desde
  // PlatformSettings.licenseDurationsMonths.
  const [durationMonths, setDurationMonths] = useState(
    String(durationOptions[durationOptions.length - 1]?.value ?? '')
  );
  const [adminEmails, setAdminEmails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adminResults, setAdminResults] = useState<AdminEmailOutcome[] | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createTenant({ name, employeeCount, licenseCount, durationMonths, adminEmails });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Si no se ingresaron correos, no hay nada que mostrar — seguimos
      // directo al detalle de la empresa como antes.
      if (result.adminResults.length === 0) {
        router.push(`/admin/empresas/${result.tenantId}`);
        return;
      }
      setAdminResults(result.adminResults);
      setTenantId(result.tenantId);
    });
  }

  if (adminResults && tenantId) {
    const statusLabel: Record<AdminEmailOutcome['status'], string> = {
      created: labels.adminCreated,
      welcomeEmailFailed: labels.adminWelcomeEmailFailed,
      duplicate: labels.adminDuplicate,
      invalidFormat: labels.adminInvalidFormat
    };
    return (
      <div className="bg-white border border-silver/60 rounded-xl p-6 text-left">
        <p className="text-sm font-medium text-quartz mb-3">{labels.adminResultsTitle}</p>
        <ul className="space-y-1.5 mb-4">
          {adminResults.map((r) => (
            <li key={r.email} className="text-xs text-nickel">
              <span className="text-quartz">{r.email}</span> — {statusLabel[r.status]}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => router.push(`/admin/empresas/${tenantId}`)}
          className="w-full bg-yale text-white rounded-lg py-2.5 text-sm"
        >
          {labels.continueCta}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
      {/* 2 columnas en escritorio, agrupando por tema (identidad de la
          empresa | parámetros de licencia) en vez de una sola columna
          angosta con mucho espacio en blanco a la derecha — cada campo
          en su propio div para que el grid los trate como celdas. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        <div>
          <label htmlFor="name" className="block text-xs text-nickel mb-1">
            {labels.nameLabel}
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={labels.namePlaceholder}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
          />
        </div>

        <div>
          <label htmlFor="employeeCount" className="block text-xs text-nickel mb-1">
            {labels.employeeCountLabel}
          </label>
          <input
            id="employeeCount"
            type="number"
            min={1}
            max={1000000}
            value={employeeCount}
            onChange={(event) => setEmployeeCount(event.target.value)}
            placeholder={labels.employeeCountPlaceholder}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
          />
          <p className="text-[11px] text-nickel mb-3">{labels.employeeCountHelp}</p>
        </div>

        <div>
          <label htmlFor="licenseCount" className="block text-xs text-nickel mb-1">
            {labels.licenseCountLabel}
          </label>
          <input
            id="licenseCount"
            type="number"
            min={1}
            max={500}
            value={licenseCount}
            onChange={(event) => setLicenseCount(event.target.value)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
          />
        </div>

        <div>
          <label htmlFor="durationMonths" className="block text-xs text-nickel mb-1">
            {labels.durationLabel}
          </label>
          <select
            id="durationMonths"
            value={durationMonths}
            onChange={(event) => setDurationMonths(event.target.value)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
          >
            {durationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="adminEmails" className="block text-xs text-nickel mb-1">
            {labels.adminEmailsLabel}
          </label>
          <textarea
            id="adminEmails"
            value={adminEmails}
            onChange={(event) => setAdminEmails(event.target.value)}
            placeholder={labels.adminEmailsPlaceholder}
            rows={3}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
          />
          <p className="text-[11px] text-nickel mb-3">{labels.adminEmailsHelp}</p>
        </div>
      </div>

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full lg:w-auto lg:px-8 bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
      >
        {isPending ? labels.creating : labels.cta}
      </button>
    </form>
  );
}
