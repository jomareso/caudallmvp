'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './logout-button';
import type { AdminNavGroup } from './admin-sidebar';
import { AdminNavIcon } from './admin-nav-icons';

type AdminMobileNavProps = {
  homeHref: Route;
  navGroups: AdminNavGroup[];
  logoutLabel: string;
  openLabel: string;
  closeLabel: string;
};

// Contraparte móvil de AdminSidebar (ver ADR-007: admin desktop-first,
// pero funcional en móvil, no bloqueado). Antes, en pantallas chicas, todo
// /admin mostraba la misma barra lateral y contenido de escritorio
// achicados a la fuerza — esto le da a móvil su propio patrón (topbar +
// menú desplegable), como cualquier app real.
export function AdminMobileNav({ homeHref, navGroups, logoutLabel, openLabel, closeLabel }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // El layout que envuelve esto no se remonta entre navegaciones (así
  // funcionan los layouts de App Router) — sin este efecto, el menú se
  // quedaría abierto después de tocar un link.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden border-b border-silver/60">
      <div className="px-4 py-3 flex items-center justify-between">
        <Link href={homeHref} className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable */}
          <img src="/api/branding/logo" alt="Caudall" className="h-8 mix-blend-multiply" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? closeLabel : openLabel}
          className="w-9 h-9 rounded-lg bg-picton/10 text-yale flex items-center justify-center text-base"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open ? (
        <nav className="px-4 pb-4 flex flex-col gap-0.5 border-t border-silver/40 pt-3">
          {navGroups.map((group) => (
            <div key={group.label ?? 'default'}>
              {group.label ? (
                <p className="text-[10px] tracking-wide uppercase text-nickel font-bold mt-3 mb-1.5 px-2.5 first:mt-0">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-sm ${
                      active ? 'bg-picton/10 text-yale font-medium' : 'text-quartz'
                    }`}
                  >
                    <AdminNavIcon name={item.icon} className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="border-t border-silver/40 mt-2 pt-3 px-2.5 flex items-center gap-2">
            <AdminNavIcon name="logout" className="w-4 h-4 shrink-0 text-nickel" />
            <LogoutButton label={logoutLabel} className="text-sm text-nickel hover:text-yale disabled:opacity-60" />
          </div>
        </nav>
      ) : null}
    </div>
  );
}
