import { getTranslations } from 'next-intl/server';
import { requireAdm } from '@/lib/auth/admin-context';
import {
  getBancoMaestroContent,
  type BancoMaestroQuestion,
  type BancoMaestroVariable
} from '@/lib/seed/banco-maestro-content';

const DIMENSION_ORDER = ['CONTROL', 'RESILIENCE', 'DEBT', 'SAVING', 'PLANNING', 'BEHAVIORAL'] as const;
const NO_CONSTRUCT_KEY = '__SIN_CONSTRUCTO__';
const MIN_QUERY_LENGTH = 2;

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

function matches(haystack: (string | null | undefined)[], query: string): boolean {
  return haystack.some((h) => h?.toLowerCase().includes(query));
}

export default async function AdminMetodologiaContenidoPage({
  searchParams
}: {
  searchParams: { q?: string };
}) {
  await requireAdm();

  const t = await getTranslations('admin.metodologia.contenido');
  const tDim = await getTranslations('diagnostic.dimensions');
  const tRole = await getTranslations('admin.metodologia.contenido.roles');

  const content = getBancoMaestroContent();
  const constructsByDimension = groupBy(content.constructs, (c) => c.dimension ?? 'BEHAVIORAL');
  const variablesByConstruct = groupBy(content.variables, (v) => v.construct ?? NO_CONSTRUCT_KEY);
  const questionsByVariable = groupBy<BancoMaestroQuestion>(content.questions, (q) => q.variable);

  const rawQuery = searchParams.q?.trim() ?? '';
  const hasQuery = rawQuery.length >= MIN_QUERY_LENGTH;
  const query = rawQuery.toLowerCase();

  // Constructos que matchean directamente se muestran completos (todas sus
  // variables/preguntas); constructos que solo aparecen porque una de sus
  // variables o preguntas matcheó se muestran, pero solo con esa variable.
  const constructsFullyShown = new Set<string>();
  const variablesShown = new Set<string>();

  if (hasQuery) {
    for (const c of content.constructs) {
      if (matches([c.code, c.name, c.definition], query)) constructsFullyShown.add(c.code);
    }
    for (const v of content.variables) {
      if (matches([v.code, v.description], query)) {
        variablesShown.add(v.code);
      }
    }
    for (const q of content.questions) {
      if (matches([q.id, q.textUX, ...q.options.map((o) => o.text)], query)) {
        variablesShown.add(q.variable);
      }
    }
  }

  function renderVariable(variable: BancoMaestroVariable) {
    const allQuestions = questionsByVariable.get(variable.code) ?? [];
    const questions = hasQuery
      ? allQuestions.filter(
          (q) =>
            constructsFullyShown.has(q.construct ?? '') ||
            variablesShown.has(q.variable) ||
            matches([q.id, q.textUX, ...q.options.map((o) => o.text)], query)
        )
      : allQuestions;

    return (
      <details key={variable.code} open={hasQuery} className="ml-4 border-l border-silver/60 pl-4 py-2">
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

  let totalShown = 0;

  const dimensionSections = DIMENSION_ORDER.filter((d) => constructsByDimension.has(d)).map((dimensionCode) => {
    const allConstructs = constructsByDimension.get(dimensionCode) ?? [];
    const constructs = hasQuery
      ? allConstructs.filter(
          (c) =>
            constructsFullyShown.has(c.code) ||
            (variablesByConstruct.get(c.code) ?? []).some((v) => variablesShown.has(v.code))
        )
      : allConstructs;

    const orphanVariables = (variablesByConstruct.get(NO_CONSTRUCT_KEY) ?? []).filter(
      (v) => v.dimension === dimensionCode && (!hasQuery || variablesShown.has(v.code))
    );

    if (hasQuery && constructs.length === 0 && orphanVariables.length === 0) return null;
    totalShown += constructs.length + orphanVariables.length;

    return (
      <details key={dimensionCode} open={hasQuery} className="bg-white border border-silver/60 rounded-xl p-4">
        <summary className="text-sm font-medium text-quartz cursor-pointer">
          {tDim(dimensionCode)}{' '}
          <span className="text-nickel font-normal">({t('constructsInDimension', { count: constructs.length })})</span>
        </summary>
        <div className="mt-3 space-y-2">
          {constructs.map((construct) => {
            const allVariables = variablesByConstruct.get(construct.code) ?? [];
            const variables =
              hasQuery && !constructsFullyShown.has(construct.code)
                ? allVariables.filter((v) => variablesShown.has(v.code))
                : allVariables;
            return (
              <details key={construct.code} open={hasQuery} className="ml-2 border-l border-silver/60 pl-4 py-1">
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

          {orphanVariables.length > 0 ? (
            <details open={hasQuery} className="ml-2 border-l border-silver/60 pl-4 py-1">
              <summary className="text-sm text-quartz cursor-pointer">
                {t('unownedVariables')} <span className="text-nickel">({orphanVariables.length})</span>
              </summary>
              <div className="mt-2">{orphanVariables.map(renderVariable)}</div>
            </details>
          ) : null}
        </div>
      </details>
    );
  });

  return (
    <main className="flex-1 p-6 lg:p-8">
      {/* max-w-3xl (no max-w-2xl): un poco más de aire, pero sin
          restructurar en grilla — este árbol usa indentación para
          comunicar jerarquía (dimensión > constructo > variable >
          pregunta) y forzarlo a columnas la rompería. */}
      <div className="w-full max-w-3xl">
        <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
        <p className="text-xs text-nickel mb-4">{t('intro')}</p>

        <form className="mb-6" action="/admin/metodologia/contenido">
          <input
            type="search"
            name="q"
            defaultValue={rawQuery}
            placeholder={t('searchPlaceholder')}
            className="w-full border border-silver/60 rounded-lg px-3 py-2 text-sm text-quartz"
          />
        </form>

        <div className="space-y-4">
          {dimensionSections}
          {hasQuery && totalShown === 0 ? <p className="text-sm text-nickel">{t('searchNoResults')}</p> : null}
        </div>
      </div>
    </main>
  );
}
