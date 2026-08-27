import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { getNextQuestion, countAnsweredAndTotal } from '@/lib/engines/diagnostic';
import { finalizeDiagnostic } from '@/lib/engines/diagnostic-completion';
import { QuestionForm } from './question-form';

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
      redirect('/diagnostico/resultado');
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
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex justify-end text-[11px] text-nickel mb-1">
            <span>{dimension ? tDim(dimension.code) : tDim(question.role === 'CONTEXT' ? 'CONTEXTO' : 'BEHAVIORAL')}</span>
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
    );
  });
}
