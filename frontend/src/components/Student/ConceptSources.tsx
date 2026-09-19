import { useEffect, useMemo, useState } from 'react';
import { HiOutlineDocumentText } from 'react-icons/hi2';
import { getLearningSources, LearningSourcePassage } from '../../API/Index';

interface ConceptSourcesProps {
  conceptId: string;
  conceptName: string;
}

/** Passages grouped by the document they came from, largest document first. */
const groupByDocument = (passages: LearningSourcePassage[]) => {
  const groups = new Map<string, LearningSourcePassage[]>();
  for (const passage of passages) {
    groups.set(passage.source, [...(groups.get(passage.source) ?? []), passage]);
  }
  return [...groups.entries()]
    .map(([source, items]) => ({ source, passages: items }))
    .sort((a, b) => b.passages.length - a.passages.length);
};

/**
 * The passages a concept was built from — the credibility feature for a grounded
 * tool: every lesson, question and card on the concept page traces back to these.
 */
const ConceptSources = ({ conceptId, conceptName }: ConceptSourcesProps) => {
  const [passages, setPassages] = useState<LearningSourcePassage[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getLearningSources(conceptId, controller.signal)
      .then((result) => setPassages(result.passages))
      .catch((requestError) => {
        if ((requestError as { name?: string }).name !== 'CanceledError') {
          setError('CORA could not load the source passages. Please try again.');
        }
      });
    return () => controller.abort();
  }, [conceptId]);

  const documents = useMemo(() => groupByDocument(passages ?? []), [passages]);

  if (error) {
    return <div className='rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>;
  }

  if (!passages) {
    return (
      <div className='h-96 animate-pulse rounded-2xl border border-stone-200 bg-white' aria-label='Loading sources' />
    );
  }

  return (
    <section>
      <h2 className='font-display text-xl font-bold tracking-tight text-slate-900'>
        The passages {conceptName} was built from
      </h2>
      <p className='mt-1 text-sm text-slate-500'>
        Lessons, practice questions and review cards for this concept are all written from these.
      </p>

      {documents.length === 0 && (
        <p className='mt-6 rounded-2xl border border-stone-200 bg-white p-6 text-sm text-slate-500'>
          No readable passages are linked to this concept yet.
        </p>
      )}

      <div className='mt-5 space-y-4'>
        {documents.map((document) => (
          <article key={document.source} className='rounded-2xl border border-stone-200 bg-white p-6'>
            <header className='flex flex-wrap items-center gap-2'>
              <HiOutlineDocumentText className='h-5 w-5 text-teal-700' aria-hidden='true' />
              <h3 className='text-[15px] font-semibold text-slate-900'>{document.source}</h3>
              <span className='text-sm text-slate-500'>
                · {document.passages.length} passage{document.passages.length === 1 ? '' : 's'}
              </span>
            </header>
            <div className='mt-4 space-y-4'>
              {document.passages.map((passage) => (
                <p
                  key={passage.id}
                  className='whitespace-pre-line border-t border-stone-100 pt-4 text-sm leading-7 text-slate-700 first:border-t-0 first:pt-0'
                >
                  {passage.text}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ConceptSources;
