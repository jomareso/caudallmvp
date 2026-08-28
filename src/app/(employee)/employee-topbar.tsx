import Link from 'next/link';

// Opción C del mockup de marca (28 ago, aprobada por el founder): barra
// delgada con el logo, igual en móvil y escritorio — para las pantallas del
// diagnóstico en sí (pregunta, contexto, resultado, acción), que antes no
// tenían ninguna marca visible. /acceso y /bienvenida ya tienen su propio
// panel de dos columnas (BrandPanel) y no cambian.
//
// Grid de 3 columnas (no flex space-between), igual que en el mockup: así
// el logo queda matemáticamente centrado con o sin el ícono de perfil, en
// vez de desplazarse cuando showProfile es false.
export function EmployeeTopBar({ showProfile = true }: { showProfile?: boolean }) {
  return (
    <div className="w-full border-b border-silver/40 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-3 grid grid-cols-3 items-center">
        <span />
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático propio del bundle, no necesita el optimizador de next/image */}
        <img src="/brand/caudall-logo-color.png" alt="Caudall" className="h-5 w-auto justify-self-center" />
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
