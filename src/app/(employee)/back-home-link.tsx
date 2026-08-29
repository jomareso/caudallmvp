import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireEmployee } from '@/lib/auth/employee-context';
import { getEmployeePostLoginDestination } from '@/lib/auth/post-login-destination';

// Compartido entre todas las pantallas del diagnóstico (pregunta,
// contexto, resultado, acción) para que ninguna sea un callejón sin
// salida. Mismo criterio en todas: getEmployeePostLoginDestination — para
// quien ya completó el diagnóstico, "volver" es /inicio; para quien
// todavía no, es /bienvenida (donde arranca el diagnóstico). Nunca un
// destino fijo por pantalla, así se mantiene consistente si ese criterio
// cambia en un solo lugar.
export async function BackHomeLink() {
  const employee = await requireEmployee();
  const destination = await getEmployeePostLoginDestination(employee.id, employee.tenantId);
  const t = await getTranslations('diagnostic');

  return (
    <Link href={destination} className="inline-block text-xs text-nickel underline mb-3">
      ← {t('backHome')}
    </Link>
  );
}
