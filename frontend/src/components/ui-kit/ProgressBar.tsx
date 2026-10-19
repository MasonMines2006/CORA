interface ProgressBarProps {
  /** 0–100. Values outside are clamped so a bad number can't overflow the bar. */
  value: number;
  /** Fill colour (hex). Callers pass the semantic colour for the state. */
  color: string;
  className?: string;
}

/** A thin decorative bar; the number it shows must also be printed as text nearby. */
const ProgressBar = ({ value, color, className = '' }: ProgressBarProps) => (
  <div className={`bar ${className}`} aria-hidden='true'>
    <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
  </div>
);

export default ProgressBar;
