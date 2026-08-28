// Opción C del mockup de marca (28 ago, aprobada por el founder): barra
// delgada con el logo, igual en móvil y escritorio — para las pantallas del
// diagnóstico en sí (pregunta, contexto, resultado, acción), que antes no
// tenían ninguna marca visible. /acceso y /bienvenida ya tienen su propio
// panel de dos columnas (BrandPanel) y no cambian.
export function EmployeeTopBar() {
  return (
    <div className="w-full border-b border-silver/40 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático propio del bundle, no necesita el optimizador de next/image */}
        <img src="/brand/caudall-logo-color.png" alt="Caudall" className="h-5 w-auto" />
      </div>
    </div>
  );
}
