import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { countContextAnsweredAndTotal, getNextContextQuestion } from '@/lib/engines/diagnostic';
import { ContextFlow } from './context-flow';
import { EmployeeTopBar } from '../../employee-topbar';
import { BackHomeLink } from '../../back-home-link';

export default async function DiagnosticoContextoPage() {
  const employee = await requireEmployee();
  const employeeId = employee.id;

  return runWithTenantContext(employeeTenantContext(employee), async () => {
    const { answered, total } = await countContextAnsweredAndTotal(employeeId);

    // Sin preguntas de contexto activas, o ya respondidas todas — no hay
    // nada que ofrecer, directo a resultado.
    if (total === 0 || answered === total) {
      redirect('/diagnostico/resultado');
    }

    const question = await getNextContextQuestion(employeeId);
    if (!question) redirect('/diagnostico/resultado');

    const t = await getTranslations('diagnostic');
    const tContext = await getTranslations('diagnostic.context');

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
            <BackHomeLink />
            <ContextFlow
              // La pantalla de transición (explicando por qué se pregunta
              // esto) solo se muestra la primera vez — si ya respondió
              // alguna, va directo a la siguiente pregunta sin repetirla.
              showIntro={answered === 0}
              question={{ id: question.id, text: questionText, options }}
              labels={{
                eyebrow: tContext('eyebrow'),
                title: tContext('title'),
                body: tContext('body'),
                ctaContinue: tContext('ctaContinue'),
                formContinueLabel: t('ctaContinue'),
                formErrorLabel: t('errorSelectOption')
              }}
            />
          </div>
        </main>
      </div>
    );
  });
}
