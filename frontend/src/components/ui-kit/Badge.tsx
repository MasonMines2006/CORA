import { ReactNode } from 'react';

export type BadgeTone = 'live' | 'review' | 'draft' | 'fail' | 'teal';

/** Small status pill with a dot: "Grounded in 3 published passages", "No published source". */
const Badge = ({ tone, children, className = '' }: { tone: BadgeTone; children: ReactNode; className?: string }) => (
  <span className={`badge badge-${tone} ${className}`}>{children}</span>
);

export default Badge;
