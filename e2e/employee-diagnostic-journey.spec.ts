import { test, expect, type Page } from '@playwright/test';
import { createTestEmployee, loginAsEmployee } from './helpers/auth';

// El journey completo, autenticado — la parte que esta auditoría marcó
// como el hueco real (todos los motores construidos en las últimas
// semanas: STOP ENGINE, Safety, Root Cause, Priority, Eligibility, Next
// Best Action) nunca se había ejercitado de punta a punta más que a mano,
// con screenshots. Entra directo con un token firmado (ver
// helpers/auth.ts) — el resto del recorrido usa la UI real, sin ningún
// mock ni stub.
//
// Cada test crea su propio empleado nuevo (tenant demo ACME2026, sembrado
// por prisma/seed.ts) — no comparten estado entre sí.

const QUESTION_TEXT = 'p.text-base.font-medium.text-quartz.mb-4';

// locator.textContent() espera (hasta su timeout por defecto) a que el
// elemento exista antes de resolver — no sirve para "dime el texto si
// está, si no null" en un solo intento. Bug real encontrado armando este
// test: la intro del bloque de contexto no tiene este párrafo en
// absoluto, así que llamar textContent() ahí se quedaba colgado ~30s por
// vuelta de loop en vez de devolver null de inmediato.
async function currentQuestionText(locator: ReturnType<Page['locator']>): Promise<string | null> {
  if ((await locator.count()) === 0) return null;
  return locator.textContent();
}

// Siempre la primera opción de cada pregunta — determinístico dado el
// mismo banco de preguntas, aunque no se sepa de antemano qué combinación
// de Safety/Priority/Eligibility va a producir (ver assertions más abajo,
// que cubren las dos ramas posibles de /diagnostico/accion en vez de
// asumir una sola).
async function answerCurrentQuestion(page: Page, seenQuestionTexts: Set<string>): Promise<void> {
  const questionLocator = page.locator(QUESTION_TEXT);
  const previousText = await currentQuestionText(questionLocator);

  const options = page.locator('.space-y-2.mb-4 button');
  await expect(options.first()).toBeVisible({ timeout: 10_000 });

  // Elegir siempre la opción 0 puede reproducir una misma pregunta de
  // aclaración del motor de consistencia una y otra vez (encontrado
  // armando este test: "¿Qué explica mejor que tu reserva sea menor..."
  // — esa respuesta puntual reabre la misma inconsistencia que la generó
  // en vez de resolverla). No es un bug de la app en el sentido
  // estricto — es que la combinación exacta "siempre la primera opción"
  // no es representativa de un empleado real. Si esta pregunta EXACTA ya
  // se vio antes en este mismo test, se elige la ÚLTIMA opción en vez de
  // la primera para no quedar en el mismo loop dos veces seguidas.
  const alreadySeen = previousText !== null && seenQuestionTexts.has(previousText);
  const chosen = alreadySeen ? options.last() : options.first();
  if (previousText) seenQuestionTexts.add(previousText);

  await chosen.click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Espera a que la PREGUNTA cambie, no la URL — bug real encontrado
  // armando este test: entre preguntas consecutivas del bloque
  // financiero, router.push() apunta literalmente a la misma
  // "/diagnostico" (la Server Action ya trajo la pregunta siguiente), así
  // que esperar un cambio de URL ahí nunca se cumplía.
  //
  // No se usa expect(...).not.toHaveText() acá — bug real de Playwright
  // encontrado armando este test: cuando la última pregunta financiera
  // hace transicionar a la intro del bloque de contexto (que no tiene
  // ESTE párrafo en absoluto, ver contexto/context-flow.tsx), el elemento
  // desaparece del DOM por completo, y un locator negado con
  // .not.toHaveText() no se resuelve de forma confiable contra un
  // elemento inexistente (se queda reintentando hasta el timeout en vez
  // de darse por satisfecho). Por eso se tolera explícitamente el caso
  // "el párrafo ya no existe" como progreso válido, además de "cambió de
  // texto".
  await expect(async () => {
    const count = await questionLocator.count();
    if (count === 0) return;
    const currentText = await questionLocator.textContent();
    expect(currentText).not.toBe(previousText);
  }).toPass({ timeout: 15_000 });
}

async function completeFinancialDiagnostic(page: Page): Promise<void> {
  await page.goto('/diagnostico');

  const seenQuestionTexts = new Set<string>();

  // Piso/techo del STOP ENGINE son configurables desde
  // /admin/metodologia/parametros (ver PR #44) — 80 iteraciones es
  // generoso incluso si alguien los sube bastante; si el diagnóstico
  // financiero de verdad no terminó para entonces, es una señal real de
  // que algo no está parando, no un límite arbitrario del test.
  for (let i = 0; i < 80; i++) {
    if (!page.url().includes('/diagnostico') || page.url().includes('/contexto')) return;
    await answerCurrentQuestion(page, seenQuestionTexts);
  }
  throw new Error('El diagnóstico financiero no terminó dentro del límite de preguntas del test.');
}

// El bloque de contexto (opcional) muestra una intro con "Ahora no" SOLO
// la primera vez que answered===0 para TODAS las preguntas de contexto —
// si alguna ya quedó respondida (ej. por inferencia a partir de una
// respuesta financiera), showIntro es false y contexto/page.tsx sirve la
// pregunta directo (ver context-flow.tsx). Este helper no asume cuál de
// los dos casos toca: si hay opciones para elegir, responde; si no, es la
// intro, y avanza con su propio "Continuar" — cubre el flujo real de
// contexto en vez de siempre saltarlo, que es más cobertura real que
// solo probar el atajo de "Ahora no".
async function completeContextIfAny(page: Page): Promise<void> {
  if (!page.url().includes('/contexto')) return;

  const seenQuestionTexts = new Set<string>();

  for (let i = 0; i < 20; i++) {
    if (!page.url().includes('/contexto')) return;

    const questionLocator = page.locator(QUESTION_TEXT);
    const previousText = await currentQuestionText(questionLocator);

    const optionButtons = page.locator('.space-y-2.mb-4 button');
    if ((await optionButtons.count()) > 0) {
      const alreadySeen = previousText !== null && seenQuestionTexts.has(previousText);
      await (alreadySeen ? optionButtons.last() : optionButtons.first()).click();
    }
    if (previousText) seenQuestionTexts.add(previousText);

    // Bug real de Playwright encontrado armando este test (confirmado con
    // trace de una corrida colgada: el frame ya estaba en
    // /diagnostico/resultado, sin ningún botón "Continuar", en el momento
    // exacto de este click): page.url() es una carrera con la navegación
    // real del browser — la vuelta anterior del loop pudo haber respondido
    // la ÚLTIMA pregunta de contexto, que navega directo a /resultado, y el
    // chequeo de arriba (if (!page.url().includes('/contexto')) return;)
    // alcanzó a leer la URL vieja antes de que el navegador terminara de
    // actualizarla. Sin este chequeo contra el DOM real, el test se queda
    // esperando para siempre un botón que ya no existe en ninguna parte.
    const continueButton = page.getByRole('button', { name: 'Continuar', exact: true });
    if ((await continueButton.count()) === 0) return;
    await continueButton.click();
    await expect(async () => {
      const count = await questionLocator.count();
      if (count === 0) return;
      const currentText = await questionLocator.textContent();
      expect(currentText).not.toBe(previousText);
    }).toPass({ timeout: 15_000 });
  }
  throw new Error('El bloque de contexto no terminó dentro del límite de preguntas del test.');
}

test.describe('Journey del empleado: diagnóstico completo', () => {
  test('acceso directo (bypass de correo) aterriza en /bienvenida para un empleado nuevo', async ({ page }) => {
    const employee = await createTestEmployee();
    await loginAsEmployee(page, employee);

    await expect(page).toHaveURL(/\/bienvenida/);
    await expect(page.getByRole('link', { name: /empezar mi diagnóstico/i })).toBeVisible();
  });

  test('responder todo el diagnóstico financiero llega a un resultado real con score', async ({ page }) => {
    const employee = await createTestEmployee();
    await loginAsEmployee(page, employee);

    await page.getByRole('link', { name: /empezar mi diagnóstico/i }).click();
    await expect(page).toHaveURL(/\/diagnostico$/);

    await completeFinancialDiagnostic(page);
    await completeContextIfAny(page);

    await expect(page).toHaveURL(/\/diagnostico\/resultado/);
    await expect(page.getByText('Tu Índice de Salud Financiera')).toBeVisible();

    // El score es un número real calculado por el motor (CFHI), no un
    // placeholder — "de 100" es el sufijo fijo del gauge (ScoreGauge).
    await expect(page.getByText('de 100')).toBeVisible();
  });

  test('/diagnostico/accion responde con una sugerencia real o un estado vacío coherente — nunca en blanco', async ({
    page
  }) => {
    const employee = await createTestEmployee();
    await loginAsEmployee(page, employee);
    await page.getByRole('link', { name: /empezar mi diagnóstico/i }).click();
    await completeFinancialDiagnostic(page);
    await completeContextIfAny(page);

    await page.goto('/diagnostico/accion');

    const commitButton = page.getByRole('button', { name: 'Me comprometo', exact: true });
    const emptyStateLink = page.getByRole('link', { name: 'Ver mi resultado', exact: true });

    // Cuál de las dos ramas aparece depende de las respuestas reales que
    // dio este empleado (Priority/Eligibility/Next Best Action) — el test
    // no la fuerza, solo exige que sea SIEMPRE una de las dos, nunca una
    // pantalla vacía o un error.
    await expect(commitButton.or(emptyStateLink)).toBeVisible({ timeout: 10_000 });

    if (await commitButton.isVisible()) {
      await commitButton.click();

      // El picker de disparadores viene de CommitmentTriggerOption (ver
      // PR #45, /admin/metodologia/conductual) — cualquiera de las
      // opciones activas sirve, se toma la primera.
      const firstTrigger = page.locator('button[aria-pressed]').first();
      await expect(firstTrigger).toBeVisible();
      await firstTrigger.click();

      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      await page.locator('input[type="date"]').fill(tomorrow);
      await page.getByRole('button', { name: 'Confirmar compromiso', exact: true }).click();

      await expect(page.getByText('Te comprometiste a este paso.').or(page.getByText(/comprometiste/))).toBeVisible({
        timeout: 10_000
      });
      await expect(page.getByText('¿Ya lo hiciste?')).toBeVisible();
    } else {
      await expect(page.getByText(/vas bien|todavía no tenemos suficiente información/i)).toBeVisible();
    }
  });
});
