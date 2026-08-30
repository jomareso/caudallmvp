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
        // hsl(210, 70%, 16%): mismo tono (210°) que 'yale' (#0F5499 ≈
        // hsl(210, 82%, 33%)), solo oscurecido — no un navy genérico sin
        // relación con la marca (el valor original, #14213A, tomado tal
        // cual del mockup, se veía negro/gris en vez de "azul Caudall
        // oscuro").
        'sidebar': '#0C2945'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
