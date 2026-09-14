// Un solo lugar para los dos tamaños de logo que debería tener el
// producto — antes cada pantalla traía su propio className copiado a
// mano (h-5, h-7, h-8, h-16/lg:h-20 según el archivo), así que terminaban
// desalineados entre sí sin que nadie lo decidiera a propósito (Reynoso:
// "no hemos logrado estandarizar el tamaño del logo en admin y en las
// otras partes"). Con esto, todas las barras de navegación persistentes
// comparten el mismo tamaño, y todas las pantallas de entrada (login,
// acceso de empleado) comparten el mismo tamaño grande — un solo lugar
// para ajustarlo si hace falta, en vez de siete.
export type BrandLogoVariant = 'nav' | 'hero';

const VARIANT_CLASS: Record<BrandLogoVariant, string> = {
  // Barras de navegación persistentes: topbar del empleado, header
  // público, sidebar/nav móvil de admin. El mismo tamaño en las cuatro,
  // para que ninguna se vea "más chica" que las demás sin motivo.
  nav: 'h-7 w-auto',
  // Pantallas de entrada (login de admin, acceso de empleado, panel de
  // marca de escritorio) — el logo es el anclaje visual principal de la
  // pantalla, no un elemento de apoyo como en una barra de navegación.
  // max-w-full: sin esto, un teléfono angosto (~375px, con el p-6 del
  // <main>) podría desbordar el ancho disponible a esta altura —
  // max-w-full fuerza al navegador a encoger manteniendo proporción en
  // vez de recortar o causar scroll horizontal (verificado con
  // Playwright en 375/390/430px, sin overflow en ninguno).
  hero: 'h-16 lg:h-20 max-w-full'
};

export function BrandLogo({
  variant,
  src = '/brand/caudall-logo-color.png',
  alt = 'Caudall',
  className = ''
}: {
  variant: BrandLogoVariant;
  src?: string;
  alt?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- logo estático del bundle o de un endpoint propio, no un dominio externo optimizable
    <img src={src} alt={alt} className={`${VARIANT_CLASS[variant]} ${className}`.trim()} />
  );
}
