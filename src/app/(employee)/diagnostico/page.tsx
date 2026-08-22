import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { getNextQuestion, countAnsweredAndTotal } from '@/lib/engines/diagnostic';
import { QuestionForm } from './question-form';

export default async function DiagnosticoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const employeeId = session.user.id;
  const question = await getNextQuestion(employeeId);

  if (!question) {
    redirect('/diagnostico/resultado');
  }

  const dimension = question.dimensionId
    ? await prisma.dimension.findUnique({ where: { id: question.dimensionId } })
    : null;
  const { answered, total } = await countAnsweredAndTotal(employeeId);

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
        <div className="flex justify-between text-[11px] text-nickel mb-1">
          <span>{t('progress', { current: answered + 1, total: Math.max(total, answered + 1) })}</span>
          <span>{dimension ? tDim(dimension.code) : tDim('BEHAVIORAL')}</span>
        </div>
        <div className="h-1 bg-silver/40 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-picton to-cola"
            style={{ width: `${Math.round((answered / Math.max(total, answered + 1)) * 100)}%` }}
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
}
