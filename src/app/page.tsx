export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-medium text-yale mb-3">caudall</h1>
        <p className="text-nickel text-sm mb-6">
          Bienestar financiero, como beneficio de tu empresa.
        </p>
        <div className="border border-silver rounded-lg p-6 bg-white">
          <p className="text-quartz text-sm">
            Proyecto inicial. Este placeholder debe reemplazarse por el flujo
            del empleado — landing con código de empresa (ver docs/prototype/).
          </p>
          <p className="text-nickel text-xs mt-3">
            Ver <code>CLAUDE.md</code> y <code>docs/</code> para arrancar.
          </p>
        </div>
      </div>
    </main>
  );
}
