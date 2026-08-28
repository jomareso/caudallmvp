import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { getNextQuestion, countAnsweredAndTotal } from '@/lib/engines/diagnostic';
import { finalizeDiagnostic } from '@/lib/engines/diagnostic-completion';
import { DIMENSION_ICON, DEFAULT_DIMENSION_ICON } from '@/lib/engines/commitment-triggers';
import { QuestionForm } from './question-form';
import { EmployeeTopBar } from '../employee-topbar';

export default async function DiagnosticoPage() {
  const employee = await requireEmployee();
  const employeeId = employee.id;

  return runWithTenantContext(employeeTenantContext(employee), async () => {
    const question = await getNextQuestion(employeeId);

    if (!question) {
      // Causa raíz/Prioridad/Eligibility solo se calculan la primera vez que
      // el diagnóstico queda completo. Si alguien ya había respondido todo
      // antes de que estos motores existieran (o por cualquier otra razón
      // ese cálculo no llegó a correr), se completa aquí — no solo al
      // responder la última pregunta en actions.ts.
      const financialState = await prisma.financialState.findUnique({ where: { employeeId } });
      if (!financialState?.systemPriority) {
        await finalizeDiagnostic(employeeId);
      }
      // El bloque de contexto (opcional) se ofrece después de terminar la
      // parte financiera — /diagnostico/contexto decide si hay algo
      // pendiente ahí o si va directo a resultado.
      redirect('/diagnostico/contexto');
    }

    const dimension = question.dimensionId
      ? await prisma.dimension.findUnique({ where: { id: question.dimensionId } })
      : null;
    const { answered } = await countAnsweredAndTotal(employeeId);

    // El banco es adaptativo (spec §23): cuántas preguntas "faltan" cambia
    // según lo que se responde, porque respuestas nuevas desbloquean
    // preguntas que antes no aplicaban. No se muestra ningún número (ni
    // "Pregunta N" ni "N de M") porque cualquier cantidad sería una promesa
    // que puede cambiar — solo una barra visual que avanza, sin texto. Usa
    // la meta del STOP ENGINE (spec §24: "target 8–12 preguntas") nada más
    // como referencia interna para el ancho; no afecta cuándo el
    // diagnóstico realmente termina, eso lo decide getNextQuestion.
    const PROGRESS_TARGET = 12;
    const progressPercent = Math.min(92, Math.round((answered / PROGRESS_TARGET) * 100));

    const t = await getTranslations('diagnostic');
    const tDim = await getTranslations('diagnostic.dimensions');

    const questionText = t(`questions.${question.code}.text`);
    const options = question.answerOptions
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((option) => {
        const evidence = option.evidenceProduced as { state: string };
        return {
          id: option.id,
          label: t(`questions.${question.code}.options.${evidence.state}`)
        };
      });

    return (
      <div className="min-h-screen flex flex-col">
        <EmployeeTopBar />
        <main className="flex-1 flex flex-col items-center p-6 pt-10 lg:justify-center lg:pt-10">
          <div className="w-full max-w-sm lg:max-w-xl">
            <div className="flex justify-end mb-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-yale bg-picton/10 rounded-full px-2.5 py-1">
                <span aria-hidden="true">{DIMENSION_ICON[dimension?.code ?? ''] ?? DEFAULT_DIMENSION_ICON}</span>
                {dimension ? tDim(dimension.code) : tDim('BEHAVIORAL')}
              </span>
            </div>
            <div className="h-1 bg-silver/40 rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-gradient-to-r from-picton to-cola"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <QuestionForm
              questionId={question.id}
              questionText={questionText}
              options={options}
              continueLabel={t('ctaContinue')}
              errorLabel={t('errorSelectOption')}
            />
          </div>
        </main>
      </div>
    );
  });
}
