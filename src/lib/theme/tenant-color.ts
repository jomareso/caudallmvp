// ADR-003 (co-branding pleno): el color primario de Tenant sobreescribe el
// primary de Tailwind ('yale') vía una CSS variable — ver tailwind.config.ts
// ('yale': 'rgb(var(--tenant-primary-rgb) / <alpha-value>)') y el uso de
// esta función en src/app/(employee)/layout.tsx. Formato "R G B" separado
// por espacios (no "#hex" ni "rgb(...)") porque así es como Tailwind espera
// el valor cuando lo envuelve en rgb(var(...) / <alpha-value>) para poder
// aplicar modificadores de opacidad (bg-yale/10, text-yale/90, etc.) —
// nada de esto funciona si el valor de la variable es un string "#hex".
const DEFAULT_PRIMARY_RGB = '15 84 153'; // #0F5499, el azul Caudall por defecto

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

export function hexToTailwindRgbTriplet(hex: string | null | undefined): string {
  if (!hex) return DEFAULT_PRIMARY_RGB;

  const match = HEX_COLOR_PATTERN.exec(hex.trim());
  if (!match) return DEFAULT_PRIMARY_RGB;

  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}
