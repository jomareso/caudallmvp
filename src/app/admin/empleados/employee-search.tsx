'use client';

import { useState, useTransition } from 'react';
import { searchEmployeesByEmail, resetEmployee, type EmployeeSearchResult } from './actions';

type Labels = {
  emailLabel: string;
  emailPlaceholder: string;
  searchCta: string;
  searching: string;
  noResults: string;
  tenantLabel: string;
  createdAtLabel: string;
  licenseLabel: string;
  noLicense: string;
  resetCta: string;
  resetting: string;
  resetConfirm: string;
  resetSuccess: string;
  errorGeneric: string;
};

export function EmployeeSearch({ labels }: { labels: Labels }) {
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<EmployeeSearchResult[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const found = await searchEmployeesByEmail(email);
      setResults(found);
      setSearched(true);
    });
  }

  function handleReset(employeeId: string) {
    if (!window.confirm(labels.resetConfirm)) return;
    setResettingId(employeeId);
    setMessage(null);
    startTransition(async () => {
      const result = await resetEmployee(employeeId);
      setResettingId(null);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(labels.resetSuccess);
      setResults((prev) => prev?.filter((r) => r.id !== employeeId) ?? null);
    });
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={labels.emailPlaceholder}
          className="flex-1 border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz focus:outline-none focus:border-cola"
        />
        <button
          type="submit"
          disabled={isPending || !email}
          className="bg-yale text-white rounded-lg px-4 text-sm disabled:opacity-60"
        >
          {isPending && !resettingId ? labels.searching : labels.searchCta}
        </button>
      </form>

      {message ? <p className="text-xs text-nickel mb-3">{message}</p> : null}

      {searched && results?.length === 0 ? <p className="text-xs text-nickel">{labels.noResults}</p> : null}

      {results && results.length > 0 ? (
        <div className="space-y-2">
          {results.map((employee) => (
            <div key={employee.id} className="bg-white border border-silver/60 rounded-lg p-4 text-sm">
              <p className="text-quartz font-medium">{employee.personalEmail}</p>
              <p className="text-xs text-nickel mt-1">
                {labels.tenantLabel}: {employee.tenantName}
              </p>
              <p className="text-xs text-nickel">
                {labels.createdAtLabel}: {new Date(employee.createdAt).toLocaleString('es-DO')}
              </p>
              <p className="text-xs text-nickel mb-3">
                {labels.licenseLabel}: {employee.licenseCode ? `${employee.licenseCode} (${employee.licenseStatus})` : labels.noLicense}
              </p>
              <button
                type="button"
                onClick={() => handleReset(employee.id)}
                disabled={isPending}
                className="text-xs text-bad border border-bad/40 rounded-lg px-3 py-1.5 disabled:opacity-60"
              >
                {resettingId === employee.id ? labels.resetting : labels.resetCta}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
