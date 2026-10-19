import { useState } from 'react';
import { HiCheck } from 'react-icons/hi2';
import { masteryState } from '../Student/learningState';
import { ModeActions } from '../shell/types';
import Button from '../ui-kit/Button';
import NodeList from './NodeList';
import { PathUnit } from './pathModel';

interface UnitBandProps extends ModeActions {
  unit: PathUnit;
  number: number;
  openId: string;
  onOpenChange: (conceptId: string) => void;
}

const SourceLine = ({ unit }: { unit: PathUnit }) => (
  <p className='mt-1 text-[14px] text-slate-500'>
    <span className='tabular'>
      {unit.masteredCount} of {unit.concepts.length}
    </span>{' '}
    mastered
    {unit.source && (
      <>
        {' '}
        · from <span className='font-code text-[12.5px]'>{unit.source}</span>
      </>
    )}
  </p>
);

/** Completed unit: one emerald row, collapsed, with a way to look inside. */
const CompleteUnit = ({
  unit,
  number,
  expanded,
  onToggle,
}: {
  unit: PathUnit;
  number: number;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <div className='flex items-center gap-3 rounded-[16px] border border-emerald-300/60 bg-emerald-50 px-4 py-3'>
    <span className='grid h-9 w-9 flex-none place-items-center rounded-[12px] bg-emerald-600 text-white shadow-key-emerald'>
      <HiCheck className='h-5 w-5' aria-hidden='true' />
    </span>
    <div className='min-w-0 flex-1'>
      <h2 className='text-[15px] font-semibold'>
        Unit {number} · {unit.title}
      </h2>
      <p className='text-[13px] text-emerald-800'>
        All <span className='tabular'>{unit.concepts.length}</span> concepts mastered
      </p>
    </div>
    <Button variant='secondary' size='sm' onClick={onToggle} aria-expanded={expanded}>
      {expanded ? 'Hide' : 'Show'}
    </Button>
  </div>
);

/** Up next: a red-50 band of concept chips. Nothing is locked, so each chip starts its lesson. */
const UpcomingUnit = ({
  unit,
  number,
  onGuide,
}: {
  unit: PathUnit;
  number: number;
  onGuide: ModeActions['onGuide'];
}) => (
  <div className='rounded-[20px] bg-red-50 px-5 py-5 sm:px-6'>
    <p className='eyebrow'>Unit {number} · Up next</p>
    <h2 className='mt-1 font-display text-[20px] font-bold tracking-tight'>{unit.title}</h2>
    <ul className='mt-4 flex flex-wrap gap-2 text-[13.5px]'>
      {unit.concepts.map((item) => (
        <li key={item.concept.id}>
          <button
            type='button'
            onClick={() => onGuide(item.concept.id)}
            className='min-h-[40px] rounded-[12px] border border-red-100 bg-white px-3 py-2 text-left hover:border-red-200'
          >
            {item.concept.name}
            {masteryState(item.mastery) !== 'notStarted' && (
              <span className='tabular ml-1 font-semibold text-amber-700'>{Math.round(item.mastery.score)}%</span>
            )}
          </button>
        </li>
      ))}
    </ul>
    <p className='mt-3 text-[13px] text-slate-500'>Nothing is locked. Start anywhere.</p>
  </div>
);

/** Later unit: a compact row you can expand. */
const LaterUnit = ({
  unit,
  number,
  expanded,
  onToggle,
}: {
  unit: PathUnit;
  number: number;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <button
    type='button'
    onClick={onToggle}
    aria-expanded={expanded}
    className='block w-full rounded-[16px] border border-slate-200 px-4 py-3 text-left hover:border-slate-300'
  >
    <span className='block text-[12px] font-semibold uppercase tracking-wider text-slate-500'>Unit {number}</span>
    <span className='block font-semibold'>{unit.title}</span>
    <span className='block text-[13px] text-slate-500'>
      <span className='tabular'>{unit.concepts.length}</span> concept{unit.concepts.length === 1 ? '' : 's'}
      {unit.masteredCount > 0 && <> · {unit.masteredCount} mastered</>}
    </span>
  </button>
);

/** One unit of the path, drawn according to where it sits: complete, current, up next or later. */
const UnitBand = ({ unit, number, openId, onOpenChange, ...modes }: UnitBandProps) => {
  const [expanded, setExpanded] = useState(false);
  const nodes = (
    <NodeList
      label={`Unit ${number} concepts`}
      concepts={unit.concepts}
      openId={openId}
      onOpenChange={onOpenChange}
      {...modes}
    />
  );
  const firstOpen = unit.concepts.find((item) => masteryState(item.mastery) !== 'mastered') ?? unit.concepts[0];

  if (unit.status === 'current') {
    return (
      <section className='mt-6' aria-label={`Unit ${number}: ${unit.title}`}>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <p className='eyebrow'>Unit {number} · In progress</p>
            <h2 className='mt-1 font-display text-[22px] font-bold tracking-tight'>{unit.title}</h2>
            <SourceLine unit={unit} />
          </div>
          <Button variant='soft' size='sm' onClick={() => modes.onGuide(firstOpen.concept.id)}>
            Guide me through it
          </Button>
        </div>
        {nodes}
      </section>
    );
  }
  if (unit.status === 'upcoming') {
    return (
      <section className='mt-8' aria-label={`Unit ${number}: ${unit.title}`}>
        <UpcomingUnit unit={unit} number={number} onGuide={modes.onGuide} />
      </section>
    );
  }
  const Row = unit.status === 'complete' ? CompleteUnit : LaterUnit;
  return (
    <section className='mt-4' aria-label={`Unit ${number}: ${unit.title}`}>
      <Row unit={unit} number={number} expanded={expanded} onToggle={() => setExpanded((open) => !open)} />
      {expanded && nodes}
    </section>
  );
};

export default UnitBand;
