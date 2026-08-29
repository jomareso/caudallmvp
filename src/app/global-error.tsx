'use client';

// Solo se dispara si layout.tsx (el layout raíz) mismo tira una excepción
// — ahí NextIntlClientProvider nunca llegó a montarse, así que a
// diferencia de error.tsx, este no puede usar useTranslations(). Debe
// traer su propio <html>/<body> (reemplaza el layout raíz entero) — es
// una restricción de Next.js, no una decisión de diseño.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '384px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 500, color: '#0F5499', marginBottom: '4px' }}>caudall</h1>
            <p style={{ fontSize: '18px', fontWeight: 500, color: '#333333', marginTop: '24px', marginBottom: '8px' }}>
              Algo no salió bien
            </p>
            <p style={{ fontSize: '14px', color: '#737373', marginBottom: '24px' }}>
              Puede haber sido tu conexión — intenta de nuevo en un momento.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                width: '100%',
                background: '#0F5499',
                color: '#fff',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Reintentar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
