import Link from 'next/link';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { BrandLogo } from '@/lib/brand/logo';

// Opción C del mockup de marca (28 ago, aprobada por el founder): barra
// delgada con el logo, igual en móvil y escritorio — para las pantallas del
// diagnóstico en sí (pregunta, contexto, resultado, acción), que antes no
// tenían ninguna marca visible. /acceso y /bienvenida ya tienen su propio
// panel de dos columnas (BrandPanel) y no cambian.
//
// Grid de 3 columnas (no flex space-between), igual que en el mockup: así
// el logo queda matemáticamente centrado con o sin el ícono de perfil, en
// vez de desplazarse cuando showProfile es false.
//
// Async porque resuelve su propio logo de tenant (ADR-003, co-branding) —
// cada page.tsx que la usa ya llama requireEmployee() antes de renderizarla,
// así que esto es una segunda resolución barata, no una nueva ruta de auth;
// se evita así tener que pasar tenant como prop desde los 6 call sites.
export async function EmployeeTopBar({ showProfile = true }: { showProfile?: boolean }) {
  const employee = await requireEmployee();
  const tenant = await runWithTenantContext(employeeTenantContext(employee), () =>
    prisma.tenant.findUnique({ where: { id: employee.tenantId }, select: { logoUrl: true, name: true } })
  );

  return (
    <div className="w-full border-b border-silver/40 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-3 grid grid-cols-3 items-center">
        <span />
        {/* ADR-003: "el header siempre muestra caudall + [logo empresa],
            nunca solo la marca de la empresa" — el logo del tenant se
            agrega junto al de Caudall, nunca lo reemplaza. */}
        <div className="justify-self-center flex items-center gap-2">
          {/* variant="nav": mismo tamaño que el logo en el resto de las
              barras de navegación persistentes del producto (ver
              src/lib/brand/logo.tsx). El logo del tenant sube junto con
              el de Caudall (misma altura, lado a lado) — no queda uno
              más chico que el otro. */}
          <BrandLogo variant="nav" />
          {tenant?.logoUrl ? (
            <>
              <span className="text-silver text-xs" aria-hidden="true">
                ·
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL externa configurada por el tenant, no un asset del bundle */}
              <img src={tenant.logoUrl} alt={tenant.name} className="h-7 w-auto max-w-[96px] object-contain" />
            </>
          ) : null}
        </div>
        {showProfile ? (
          <Link
            href="/perfil"
            title="Configuración"
            className="justify-self-end w-7 h-7 rounded-full bg-yale/10 text-yale flex items-center justify-center text-sm"
          >
            ⚙️
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
