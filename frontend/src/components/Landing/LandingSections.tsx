import { ReactNode } from 'react';
import { HiCheck, HiOutlineBolt, HiOutlineBookOpen, HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2';
import CoraMark from '../ui-kit/CoraMark';

/*
 * Static landing copy (DESIGN.md 5.1). The examples are illustrations of how
 * CORA works, labelled as examples; they quote no real document. Copy rules:
 * name the subject, no "AI-powered", no sparkles.
 */

export interface LandingActions {
  primary: ReactNode;
  secondary: ReactNode;
}

/** The product beside the claim: a cited answer, its passage, and a mastery toast. */
const ProductComposite = () => (
  <figure className='relative' aria-label='Example of a CORA answer with its source'>
    <div className='rounded-[22px] border-2 border-red-100 bg-white p-5 shadow-[0_24px_48px_-24px_rgba(15,23,42,.25)]'>
      <p className='ml-auto w-fit max-w-[90%] rounded-[18px] rounded-br-[6px] bg-slate-100 px-4 py-2.5 text-[14.5px]'>
        What sets the −80 s period after a scram?
      </p>
      <div className='mt-4 flex gap-3'>
        <CoraMark size={28} />
        <p className='text-[14.5px] leading-relaxed text-slate-700'>
          The longest-lived delayed-neutron precursor group. Its roughly 55 s half-life means power can&apos;t fall
          faster than about −80 s once the prompt drop is over <span className='cite'>Source 1</span>
        </p>
      </div>
      <p className='passage mt-4 text-[13px]'>
        Sources sit under every answer. Open one to see the <mark>published document</mark> it came from.
      </p>
      <div className='mt-4 flex flex-wrap gap-2' aria-hidden='true'>
        <span className='btn btn-sm btn-secondary'>
          <HiOutlineBolt />
          Quiz me
        </span>
        <span className='btn btn-sm btn-secondary'>
          <HiOutlineBookOpen />
          Guide me
        </span>
      </div>
    </div>
    <div className='absolute -bottom-8 right-4 hidden items-center gap-3 rounded-[16px] border-2 border-emerald-300 bg-white px-4 py-3 shadow-lg sm:flex'>
      <span className='grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-white' aria-hidden='true'>
        <HiCheck className='h-5 w-5' />
      </span>
      <span className='text-[13.5px]'>
        <span className='block font-semibold'>Reactor period</span>
        <span className='tabular text-emerald-700'>mastery up after a quiz</span>
      </span>
    </div>
    <figcaption className='sr-only'>Example only. Real answers quote your course&apos;s published material.</figcaption>
  </figure>
);

export const Hero = ({ actions }: { actions: LandingActions }) => (
  <section className='bg-red-50'>
    <div className='mx-auto grid max-w-[1160px] items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_520px] lg:py-[80px]'>
      <div>
        <p className='eyebrow'>For reactor theory students and trainee operators</p>
        <h1 className='mt-4 font-display text-[40px] font-extrabold leading-[1.02] tracking-tight sm:text-[56px]'>
          Study reactor theory with a tutor that shows its work.
        </h1>
        <p className='mt-5 max-w-[540px] text-[17px] leading-relaxed text-slate-700'>
          CORA turns your course&apos;s published material (lecture notes, manuals, question banks) into short lessons,
          answers with sources, and quizzes that get harder as you get better.
        </p>
        <div className='mt-8 flex flex-wrap gap-3'>
          {actions.primary}
          {actions.secondary}
        </div>
        <p className='mt-4 text-[13.5px] text-slate-500'>Use the account your instructor set up for you.</p>
      </div>
      <ProductComposite />
    </div>
  </section>
);

const ModeCard = ({
  icon,
  tone,
  title,
  lead,
  children,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  lead: string;
  children: ReactNode;
}) => (
  <article className='rounded-[20px] border-2 border-slate-200 p-5'>
    <h3 className='flex items-center gap-2 font-semibold'>
      <span className={`grid h-8 w-8 place-items-center rounded-[8px] ${tone}`} aria-hidden='true'>
        {icon}
      </span>
      {title}
    </h3>
    <p className='mt-1 text-[14px] text-slate-500'>{lead}</p>
    <div className='mt-4 rounded-[12px] bg-slate-50 p-4 text-[13.5px] leading-relaxed text-slate-700'>{children}</div>
  </article>
);

export const ModesDemo = () => (
  <section id='modes' className='bg-white'>
    <div className='mx-auto max-w-[1160px] px-4 py-14 sm:px-6 lg:py-[80px]'>
      <p className='eyebrow'>How it teaches</p>
      <h2 className='mt-2 max-w-[640px] font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]'>
        One concept, three ways in. Switch whenever you&apos;re stuck.
      </h2>
      <p className='mt-3 max-w-[640px] text-[16px] text-slate-500'>
        Every concept works in all three modes. Nobody is sorted into a &quot;type&quot; of learner; what adapts is the
        difficulty, driven by what you actually get right.
      </p>
      <div className='mt-10 grid gap-5 lg:grid-cols-3'>
        <ModeCard
          icon={<HiOutlineBookOpen className='h-[18px] w-[18px]' />}
          tone='bg-amber-50 text-amber-700'
          title='Guide me'
          lead='Four short steps: idea, mechanism, application, check.'
        >
          <div className='seg' aria-hidden='true'>
            <i className='done' />
            <i className='done' />
            <i className='on' />
            <i />
          </div>
          <p className='mt-3 font-code text-[15px] text-slate-900'>τ ≈ (β̄ − ρ) / (λ·ρ)</p>
          <p className='mt-2'>For a small positive insertion, the delayed neutrons set the period.</p>
        </ModeCard>
        <ModeCard
          icon={<HiOutlineChatBubbleOvalLeft className='h-[18px] w-[18px]' />}
          tone='bg-red-50 text-red-700'
          title='Ask'
          lead='Talk it through. Every answer lists the documents behind it.'
        >
          <p className='font-medium text-slate-900'>“Why does decay heat matter after a scram?”</p>
          <p className='mt-2'>
            Fission stops, but fission products keep decaying and heating the core{' '}
            <span className='cite'>Source 1</span>
          </p>
        </ModeCard>
        <ModeCard
          icon={<HiOutlineBolt className='h-[18px] w-[18px]' />}
          tone='bg-teal-50 text-teal-700'
          title='Quiz me'
          lead='Questions picked for your level, explained after you answer.'
        >
          <p className='font-medium text-slate-900'>Doubling ρ from 0.001 to 0.002 makes τ…</p>
          <p className='mt-2 rounded-[8px] border-2 border-slate-200 bg-white px-3 py-2'>roughly half as long</p>
          <p className='mt-2 rounded-[8px] border-2 border-emerald-600 bg-emerald-50 px-3 py-2 font-medium text-emerald-800'>
            less than half as long
          </p>
        </ModeCard>
      </div>
    </div>
  </section>
);

const RECEIPTS = [
  [
    'Instructors publish, students learn',
    'Uploads stay private until an admin previews the extracted passages and publishes them.',
  ],
  ['Sources you can open', 'Every answer shows the published documents it drew on.'],
  [
    'Says "not in the material"',
    'No source, no answer. CORA tells you when your course material does not cover a question.',
  ],
];

export const ReceiptsBand = () => (
  <section id='sources' className='bg-red-50'>
    <div className='mx-auto grid max-w-[1160px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-[80px]'>
      <div>
        <p className='eyebrow'>Sources</p>
        <h2 className='mt-2 font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]'>
          Every answer has a receipt.
        </h2>
        <p className='mt-3 text-[16px] leading-relaxed text-slate-700'>
          In nuclear training, &quot;the computer said so&quot; is not good enough. CORA only answers from material an
          instructor has reviewed and published, and it shows where each answer came from.
        </p>
      </div>
      <ol className='space-y-3'>
        {RECEIPTS.map(([title, body], index) => (
          <li key={title} className='flex gap-4 rounded-[16px] bg-white p-4'>
            <span className='font-code text-[13px] font-semibold text-red-700' aria-hidden='true'>
              0{index + 1}
            </span>
            <div>
              <p className='font-semibold'>{title}</p>
              <p className='text-[14px] text-slate-500'>{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export const CtaStrip = ({ action }: { action: ReactNode }) => (
  <section className='bg-white'>
    <div className='mx-auto max-w-[1160px] px-4 py-14 sm:px-6 lg:py-[80px]'>
      <div className='flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-slate-900 px-6 py-6 text-white'>
        <p className='font-display text-[22px] font-bold'>Your course material, one concept at a time.</p>
        {action}
      </div>
    </div>
  </section>
);
