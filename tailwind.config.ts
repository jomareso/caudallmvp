import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // Colores de marca Caudall — pueden ser sobreescritos por tenant via CSS vars (ADR-003)
        'yale': '#0F5499',
        'cola': '#0783D9',
        'picton': '#34C1EE',
        'quartz': '#4B4C4C',
        'nickel': '#737373',
        'silver': '#B8B8B8',
        // Referencia al color primario del tenant activo
        'tenant-primary': 'var(--tenant-primary-color, #0F5499)',
        // Estados semánticos (éxito/alerta/error), tomados del prototipo visual
        'ok': '#3B6D11',
        'warn': '#854F0B',
        'bad': '#791F1F'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
