'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './logout-button';
import { AdminNavIcon, type AdminNavIconName } from './admin-nav-icons';

export type AdminNavGroup = {
  label: string | null;
  items: { href: Route; label: string; icon: AdminNavIconName }[];
};

type AdminSidebarProps = {
  hasLogo: boolean;
  homeHref: Route;
  roleLabel: string;
  tenantLabel: string;
  navGroups: AdminNavGroup[];
  logoutLabel: string;
};

// Barra lateral de escritorio (ver ADR-007: admin es desktop-first, pero
// funcional en móvil — AdminMobileNav.tsx es la contraparte para pantallas
// chicas). Reemplaza la fila de links de un solo nivel que ya no cabía con
// 7 ítems para ADM (ver comentario que tenía AdminLayout antes de este
// cambio). 'use client' porque necesita usePathname() para el estado
// activo del link actual — no hay forma de saberlo en un Server Component
// sin pasar la ruta actual a mano desde cada página.
export function AdminSidebar({ hasLogo, homeHref, roleLabel, tenantLabel, navGroups, logoutLabel }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    // sticky + h-screen + overflow-y-auto: sin esto, en una página larga
    // (ej. Configuración, con muchos parámetros) el sidebar se iba scrolleando
    // junto con el contenido y para volver a la navegación había que subir
    // hasta el principio — un panel de escritorio de verdad mantiene la
    // navegación siempre alcanzable.
    <aside className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col bg-sidebar text-white px-3.5 py-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <Link href={homeHref} className="flex items-center gap-2 px-1.5 pb-5">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
          <img src="/api/branding/logo" alt="Caudall" className="h-7 brightness-0 invert" />
        ) : (
          <span className="text-lg font-semibold">caudall</span>
        )}
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span className="text-[11px] text-white/55">{roleLabel}</span>
      </Link>
      <p className="text-xs text-white/55 px-1.5 pb-4">{tenantLabel}</p>

      <nav className="flex flex-col gap-0.5 flex-1">
        {navGroups.map((group) => (
          <div key={group.label ?? 'default'}>
            {group.label ? (
              <p className="text-[9.5px] tracking-wide uppercase text-white/35 font-bold mt-3.5 mb-1.5 px-2.5 first:mt-0">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm relative ${
                    active ? 'bg-picton/15 text-white font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {active ? (
                    <span className="absolute -left-3.5 top-2 bottom-2 w-[3px] bg-picton rounded-r" aria-hidden />
                  ) : null}
                  <AdminNavIcon name={item.icon} className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 pt-3 mt-2">
        <div className="flex items-center gap-2 px-2.5 py-2">
          <AdminNavIcon name="logout" className="w-4 h-4 shrink-0 text-white/55" />
          <LogoutButton label={logoutLabel} className="text-sm text-white/70 hover:text-white disabled:opacity-60" />
        </div>
      </div>
    </aside>
  );
}
