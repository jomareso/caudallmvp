// Tamaño de muestra estadísticamente representativo para una empresa, a
// partir de su cantidad total de empleados (Tenant.employeeCount) y los
// parámetros globales de nivel de confianza / margen de error
// (PlatformSettings.sampleConfidenceLevel/sampleMarginOfError, editables
// desde /admin/configuracion). Puramente informativo (decisión de
// Reynoso): no cambia cuántas licencias se pueden generar ni ningún otro
// comportamiento — es un dato que se muestra en el detalle de la empresa.
//
// Fórmula estándar de muestra para población finita:
//   n0 = z² · p · (1-p) / e²
//   n  = n0 / (1 + (n0-1)/N)
// con p=0.5 (proporción esperada desconocida — maximiza n0, la elección
// conservadora estándar cuando no hay un estimado previo) y z derivado del
// nivel de confianza vía la inversa de la CDF normal estándar.

// Aproximación racional de Acklam para la inversa de la CDF normal estándar
// (precisión ~1.15e-9) — necesaria para convertir un nivel de confianza
// arbitrario (0.90, 0.95, 0.99, o cualquier otro que se configure) en su
// z-score correspondiente, sin depender de una tabla fija de valores
// comunes.
function inverseNormalCDF(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function zScoreForConfidenceLevel(confidenceLevel: number): number {
  return inverseNormalCDF((1 + confidenceLevel) / 2);
}

export function calculateSampleSize({
  populationSize,
  confidenceLevel,
  marginOfError,
  proportion = 0.5
}: {
  populationSize: number | null | undefined;
  confidenceLevel: number;
  marginOfError: number;
  proportion?: number;
}): number | null {
  if (!populationSize || populationSize <= 0) return null;

  const z = zScoreForConfidenceLevel(confidenceLevel);
  const n0 = (z * z * proportion * (1 - proportion)) / (marginOfError * marginOfError);
  // Corrección por población finita: sin esto, n0 (que asume una población
  // infinita) sobreestima cuánta gente hace falta para empresas chicas —
  // una empresa de 30 empleados no necesita una muestra de 384.
  const n = n0 / (1 + (n0 - 1) / populationSize);

  return Math.min(populationSize, Math.ceil(n));
}
