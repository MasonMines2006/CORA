interface SegmentBarProps {
  /** How many steps in total. */
  count: number;
  /** Zero-based index of the step you are on. Steps before it show as done. */
  current: number;
  /** When set, the bar is announced as a progress bar with this name. */
  label?: string;
  className?: string;
}

/**
 * The segmented step bar used by lessons, quizzes and the continue card.
 * Green = done, red = where you are, grey = still to come.
 */
const SegmentBar = ({ count, current, label, className = '' }: SegmentBarProps) => {
  const a11y = label
    ? {
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 1,
        'aria-valuemax': count,
        'aria-valuenow': current + 1,
      }
    : { 'aria-hidden': true };
  return (
    <div className={`seg ${className}`} {...a11y}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} className={index < current ? 'done' : index === current ? 'on' : ''} />
      ))}
    </div>
  );
};

export default SegmentBar;
