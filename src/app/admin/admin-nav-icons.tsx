// Reynoso: los emoji de colores en el sidebar (⚙️📄🧭🏢🛡️👤🔔) no eran
// consistentes con la marca — cada uno trae su propio set de colores fijo
// (el compás sale rosa/dorado, la campana amarilla, etc.), sin relación
// con la paleta de Caudall ni con el estado activo/inactivo del link. Se
// reemplazan por este set de íconos de línea propios, en `currentColor`:
// heredan el mismo color que el texto del link a su lado (blanco/70,
// blanco en el link activo, quartz en el menú móvil), así que siempre
// calzan con la marca sin importar dónde se usen.
//
// Trazos simples, sin depender de ninguna librería de íconos (no había
// ninguna instalada — agregar una solo para este sidebar hubiera sido una
// dependencia nueva sin necesidad real).
export type AdminNavIconName = 'settings' | 'content' | 'methodology' | 'companies' | 'admins' | 'employees' | 'notifications' | 'logout';

const PATHS: Record<AdminNavIconName, JSX.Element> = {
  settings: (
    <>
      <line x1="3" y1="5.5" x2="17" y2="5.5" />
      <circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <circle cx="7" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <line x1="3" y1="14.5" x2="17" y2="14.5" />
      <circle cx="13" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  content: (
    <>
      <path d="M6 2.5h5l3 3v11.2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13.2a1 1 0 0 1 1-1z" />
      <path d="M11 2.5v3h3" />
      <line x1="7" y1="11.2" x2="13" y2="11.2" />
      <line x1="7" y1="14" x2="13" y2="14" />
    </>
  ),
  methodology: (
    <>
      <circle cx="10" cy="10" r="7.3" />
      <path d="M12.7 7.3 11 11l-3.7 1.7L9 9z" fill="currentColor" stroke="none" />
    </>
  ),
  companies: (
    <>
      <rect x="4" y="3" width="8.5" height="14" rx="0.5" />
      <path d="M12.5 9h3.5v8h-3.5" />
      <line x1="6.3" y1="6" x2="6.3" y2="6.01" strokeWidth="2" />
      <line x1="10" y1="6" x2="10" y2="6.01" strokeWidth="2" />
      <line x1="6.3" y1="9.5" x2="6.3" y2="9.51" strokeWidth="2" />
      <line x1="10" y1="9.5" x2="10" y2="9.51" strokeWidth="2" />
      <line x1="6.3" y1="13" x2="6.3" y2="13.01" strokeWidth="2" />
      <line x1="10" y1="13" x2="10" y2="13.01" strokeWidth="2" />
    </>
  ),
  admins: <path d="M10 2.5 16 4.7v4.8c0 4.2-2.6 7.6-6 8.5-3.4-.9-6-4.3-6-8.5V4.7z" />,
  employees: (
    <>
      <circle cx="10" cy="6.7" r="3" />
      <path d="M3.5 17c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" />
    </>
  ),
  notifications: (
    <>
      <path d="M10 2.7c-2.3 0-4 2-4 4.6v2.8l-1.5 3h11l-1.5-3V7.3c0-2.6-1.7-4.6-4-4.6z" />
      <path d="M8.3 15.8a1.7 1.7 0 0 0 3.4 0" />
    </>
  ),
  logout: (
    <>
      <path d="M8.2 4H4.7a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3.5" />
      <path d="M12 10h5.3M14.8 7.2l3 2.8-3 2.8" />
    </>
  )
};

export function AdminNavIcon({ name, className }: { name: AdminNavIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
