/**
 * The frame shared by sign in, join and reset (docs/redesign/prototype/signin.html).
 *
 * Left: the CORA mark and the form. Right (desktop only): a slice of the
 * learning path and a cited fact, as a quiet preview of what's inside.
 *
 * Styling note: `.field`, `.label`, `.btn*`, `.node*`, `.cite` and `.eyebrow`
 * are shared component classes defined in src/index.css (@layer components),
 * ported from the prototype's cora.css by the redesign work.
 */
import React from 'react';
import { Link } from 'react-router-dom';

export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main id='main' className='grid min-h-screen bg-white font-body text-slate-900 lg:grid-cols-[1fr_520px]'>
    <div className='flex flex-col px-4 py-6 sm:px-10'>
      <Link to='/' className='flex items-center gap-2.5 self-start' aria-label='CORA home'>
        <span className='grid h-8 w-8 place-items-center rounded-[10px] bg-red-600 font-display text-[17px] font-extrabold text-white shadow-[0_3px_0_#7f1d1d]'>
          C
        </span>
        <span className='font-display text-[19px] font-bold tracking-tight'>cora</span>
      </Link>
      <div className='mx-auto my-auto w-full max-w-[400px] py-10'>{children}</div>
    </div>
    <aside className='relative hidden overflow-hidden bg-red-50 lg:block' aria-hidden='true'>
      <div className='absolute inset-x-10 top-[18%]'>
        <p className='eyebrow'>Today on your path</p>
        <div className='mt-4 space-y-4'>
          <div className='flex items-center gap-4'>
            <span className='node node-mastered'>✓</span>
            <span className='font-semibold'>Delayed neutron fraction</span>
          </div>
          <div className='ml-12 flex items-center gap-4'>
            <span className='node node-current' />
            <span className='font-semibold'>Reactor period</span>
          </div>
          <div className='ml-6 flex items-center gap-4'>
            <span className='node node-new'>
              <span className='font-code text-[13px] font-semibold'>SUR</span>
            </span>
            <span className='font-semibold text-slate-500'>Startup rate</span>
          </div>
        </div>
        <div className='mt-10 rounded-[16px] bg-white p-5'>
          <p className='text-[15px] leading-relaxed text-slate-700'>
            “Decay heat is roughly 6–7% of prior power right after a trip, and about 1% an hour later.”
          </p>
        </div>
      </div>
    </aside>
  </main>
);

export const AuthHeading: React.FC<{ title: string; subtitle?: React.ReactNode }> = ({ title, subtitle }) => (
  <>
    <h1 className='font-display text-[32px] font-bold tracking-tight [text-wrap:balance]'>{title}</h1>
    {subtitle && <p className='mt-1 text-[15px] text-slate-500'>{subtitle}</p>}
  </>
);

/** One error box. role="alert" makes screen readers announce it as soon as it appears. */
export const AuthError: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className='mt-6 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700' role='alert'>
    {children}
  </div>
);

export default AuthLayout;
