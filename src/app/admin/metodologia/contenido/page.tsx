import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import {
  getBancoMaestroContent,
  type BancoMaestroQuestion,
  type BancoMaestroVariable
} from '@/lib/seed/banco-maestro-content';

const DIMENSION_ORDER = ['CONTROL', 'RESILIENCE', 'DEBT', 'SAVING', 'PLANNING', 'BEHAVIORAL'] as const;
const NO_CONSTRUCT_KEY = '__SIN_CONSTRUCTO__';

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export default async function AdminMetodologiaContenidoPage() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');

  const t = await getTranslations('admin.metodologia.contenido');
  const tDim = await getTranslations('diagnostic.dimensions');
  const tRole = await getTranslations('admin.metodologia.contenido.roles');

  const content = getBancoMaestroContent();
  const constructsByDimension = groupBy(content.constructs, (c) => c.dimension ?? 'BEHAVIORAL');
  const variablesByConstruct = groupBy(content.variables, (v) => v.construct ?? NO_CONSTRUCT_KEY);
  const questionsByVariable = groupBy<BancoMaestroQuestion>(content.questions, (q) => q.variable);

  function renderVariable(variable: BancoMaestroVariable) {
    const questions = questionsByVariable.get(variable.code) ?? [];
    return (
      <details key={variable.code} className="ml-4 border-l border-silver/60 pl-4 py-2">
        <summary className="text-sm text-quartz cursor-pointer">
          <span className="font-medium">{variable.code}</span> — {variable.description}{' '}
          <span className="text-nickel">({t('questionsInVariable', { count: questions.length })})</span>
        </summary>
        <div className="mt-2 space-y-3">
          <p className="text-xs text-nickel">
            {t('possibleStatesLabel')}: {(variable.states as string[]).join(', ')}
          </p>
          {questions.length === 0 ? (
            <p className="text-xs text-nickel">{t('noQuestions')}</p>
          ) : (
            questions.map((q) => (
              <div key={q.id} className="bg-white border border-silver/60 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1 text-xs">
                  <span className="text-nickel">{q.id}</span>
                  <span className="bg-picton/10 text-yale rounded px-1.5 py-0.5">{tRole(q.role)}</span>
                  <span
                    className={
                      q.status === 'ACTIVA'
                        ? 'bg-ok/10 text-ok rounded px-1.5 py-0.5'
                        : 'bg-warn/10 text-warn rounded px-1.5 py-0.5'
                    }
                  >
                    {q.status === 'ACTIVA' ? t('statusActive') : t('statusDraft')}
                  </span>
                </div>
                <p className="text-sm text-quartz mb-2">{q.textUX}</p>
                {q.options.length > 0 ? (
                  <ul className="text-xs text-nickel space-y-0.5 list-disc list-inside">
                    {q.options.map((opt) => (
                      <li key={opt.order}>
                        {opt.text} <span className="text-silver">({opt.state})</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </div>
      </details>
    );
  }

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
        <p className="text-xs text-nickel mb-6">{t('intro')}</p>

        <div className="space-y-4">
          {DIMENSION_ORDER.filter((d) => constructsByDimension.has(d)).map((dimensionCode) => {
            const constructs = constructsByDimension.get(dimensionCode) ?? [];
            return (
              <details key={dimensionCode} className="bg-white border border-silver/60 rounded-xl p-4">
                <summary className="text-sm font-medium text-quartz cursor-pointer">
                  {tDim(dimensionCode)}{' '}
                  <span className="text-nickel font-normal">({t('constructsInDimension', { count: constructs.length })})</span>
                </summary>
                <div className="mt-3 space-y-2">
                  {constructs.map((construct) => {
                    const variables = variablesByConstruct.get(construct.code) ?? [];
                    return (
                      <details key={construct.code} className="ml-2 border-l border-silver/60 pl-4 py-1">
                        <summary className="text-sm text-quartz cursor-pointer">
                          <span className="font-medium">{construct.name}</span>{' '}
                          <span className="text-nickel">
                            ({construct.code} · {t('variablesInConstruct', { count: variables.length })})
                          </span>
                        </summary>
                        <div className="mt-2">
                          <p className="text-xs text-nickel mb-2">
                            {t('definitionLabel')}: {construct.definition}
                          </p>
                          {variables.map(renderVariable)}
                        </div>
                      </details>
                    );
                  })}

                  {(() => {
                    const orphanVariables = (variablesByConstruct.get(NO_CONSTRUCT_KEY) ?? []).filter(
                      (v) => v.dimension === dimensionCode
                    );
                    if (orphanVariables.length === 0) return null;
                    return (
                      <details className="ml-2 border-l border-silver/60 pl-4 py-1">
                        <summary className="text-sm text-quartz cursor-pointer">
                          {t('unownedVariables')} <span className="text-nickel">({orphanVariables.length})</span>
                        </summary>
                        <div className="mt-2">{orphanVariables.map(renderVariable)}</div>
                      </details>
                    );
                  })()}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </main>
  );
}
