import { ConceptNeighbour, LearningConcept, LearningMastery } from '../../API/Index';
import { radialLayout } from './conceptHubModel';
import { STATE_STYLE, masteryLabel, masteryState } from './learningState';

interface ConceptNeighbourhoodGraphProps {
  concept: LearningConcept;
  mastery: LearningMastery | null;
  neighbours: ConceptNeighbour[];
  linkedCount: number;
  onOpenConcept: (conceptId: string) => void;
}

const VIEW = { width: 640, height: 440 };
const CENTRE = { cx: VIEW.width / 2, cy: VIEW.height / 2 - 6 };
const RING_RADIUS = 158;
const CENTRE_R = 50;
const NODE_R = 30;
const LABEL_MAX = 18;

const shorten = (name: string) => (name.length > LABEL_MAX ? `${name.slice(0, LABEL_MAX - 1)}…` : name);

/**
 * One concept and its direct neighbours, drawn as a ring. Deliberately not the
 * whole course graph: the point is "what does this connect to", and a radial
 * layout answers that at a glance without a force simulation.
 */
const ConceptNeighbourhoodGraph = ({
  concept,
  mastery,
  neighbours,
  linkedCount,
  onOpenConcept,
}: ConceptNeighbourhoodGraphProps) => {
  const points = radialLayout(neighbours.length, { ...CENTRE, radius: RING_RADIUS });

  return (
    <section className='rounded-2xl border border-stone-200 bg-white p-6 sm:p-8'>
      <h2 className='font-display text-xl font-bold tracking-tight text-slate-900'>
        {concept.name} in the course graph
      </h2>
      <p className='mt-1 text-sm text-slate-500'>
        Only this concept’s neighbourhood — showing {neighbours.length} of {linkedCount} linked concepts, strongest
        links first. Select one to open it.
      </p>

      {neighbours.length === 0 ? (
        <p className='mt-8 rounded-xl bg-stone-50 p-6 text-sm text-slate-500'>
          The graph has no links from {concept.name} to other course concepts yet.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          className='mt-4 h-auto w-full'
          role='group'
          aria-label={`${concept.name} and ${neighbours.length} linked concepts`}
        >
          {points.map((point, index) => (
            <line
              key={`edge-${neighbours[index].id}`}
              x1={CENTRE.cx}
              y1={CENTRE.cy}
              x2={point.x}
              y2={point.y}
              stroke='#d6d3d1'
              strokeWidth={1.5}
            />
          ))}

          {neighbours.map((neighbour, index) => {
            const { x, y } = points[index];
            const state = masteryState(neighbour.mastery);
            const style = STATE_STYLE[state];
            const started = state !== 'notStarted';
            const open = () => onOpenConcept(neighbour.id);
            return (
              <g
                key={neighbour.id}
                role='button'
                tabIndex={0}
                aria-label={`${neighbour.name}, ${style.label.toLowerCase()}, ${neighbour.relationship.replace(/_/g, ' ').toLowerCase()}`}
                onClick={open}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open();
                  }
                }}
                className='cursor-pointer outline-none [&:focus-visible>circle]:stroke-slate-900 [&:hover>circle]:opacity-85'
              >
                <title>{`${neighbour.name} — ${neighbour.relationship} · ${neighbour.shared_passages} shared passages`}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={NODE_R}
                  fill={started ? style.color : style.fill}
                  stroke={started ? style.color : '#cbd5e1'}
                  strokeWidth={2}
                />
                <text
                  x={x}
                  y={y + 5}
                  textAnchor='middle'
                  className='font-display'
                  fontSize={13}
                  fontWeight={700}
                  fill={started ? '#ffffff' : '#475569'}
                >
                  {masteryLabel(neighbour.mastery)}
                </text>
                <text x={x} y={y + NODE_R + 18} textAnchor='middle' fontSize={12.5} fontWeight={600} fill='#0f172a'>
                  {shorten(neighbour.name)}
                </text>
              </g>
            );
          })}

          <circle cx={CENTRE.cx} cy={CENTRE.cy} r={CENTRE_R} fill='#dc2626' />
          <text x={CENTRE.cx} y={CENTRE.cy - 4} textAnchor='middle' fontSize={13} fontWeight={700} fill='#ffffff'>
            {shorten(concept.name)}
          </text>
          <text
            x={CENTRE.cx}
            y={CENTRE.cy + 16}
            textAnchor='middle'
            className='font-display'
            fontSize={15}
            fontWeight={700}
            fill='#ffffff'
          >
            {masteryLabel(mastery)}
          </text>
        </svg>
      )}

      <div className='mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600'>
        <span className='flex items-center gap-2'>
          <i className='h-2.5 w-2.5 rounded-full bg-red-600' /> This concept
        </span>
        {(['mastered', 'inProgress', 'notStarted'] as const).map((state) => (
          <span key={state} className='flex items-center gap-2'>
            <i className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: STATE_STYLE[state].color }} />
            {STATE_STYLE[state].label}
          </span>
        ))}
      </div>
    </section>
  );
};

export default ConceptNeighbourhoodGraph;
