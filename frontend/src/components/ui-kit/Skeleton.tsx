/** A shimmering placeholder block. Give it the size of what will load so nothing jumps. */
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`skel ${className}`} aria-hidden='true' />
);

export default Skeleton;
