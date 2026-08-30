import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // ADR-003: 'yale' es el color primario, y es el que cada tenant
        // puede sobreescribir (co-branding). rgb(var(...) / <alpha-value>)
        // en vez de un var() directo es lo que le permite a Tailwind seguir
        // soportando modificadores de opacidad (bg-yale/10, text-yale/90,
        // etc.) sobre un color que viene de una CSS variable — ver
        // src/lib/theme/tenant-color.ts, que arma "R G B" desde
        // Tenant.primaryColor, y src/app/(employee)/layout.tsx, que fija
        // la variable por request. 'cola'/'picton' NO son overridables:
        // ADR-003 dice "color primario" (singular) — el resto de la
        // identidad visual de Caudall se conserva igual para todos los
        // tenants.
        'yale': 'rgb(var(--tenant-primary-rgb, 15 84 153) / <alpha-value>)',
        'cola': '#0783D9',
        'picton': '#34C1EE',
        'quartz': '#4B4C4C',
        'nickel': '#737373',
        'silver': '#B8B8B8',
        // Estados semánticos (éxito/alerta/error), tomados del prototipo visual
        'ok': '#3B6D11',
        'warn': '#854F0B',
        'bad': '#791F1F',
        // Fondo del sidebar de /admin (ver admin-sidebar.tsx) — no
        // overridable por tenant (a diferencia de 'yale'): es el panel
        // interno de Caudall/RRHH, no una pantalla de marca del empleado.
        // Mismo azul que 'yale' (#0F5499), fijo en vez de la variable CSS
        // de 'yale' — es el azul real de marca (ver el degradé
        // from-yale-to-cola de brand-panel.tsx/página de acceso), no un
        // navy oscurecido sin relación visual con el resto del producto
        // (el valor anterior, #0C2945, se veía casi negro).
        'sidebar': '#0F5499'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
