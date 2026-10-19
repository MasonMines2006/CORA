interface CitationChipProps {
  /** What the chip shows, e.g. "1" or "NE235_L07.pdf". */
  label: string;
  /** Spoken name, e.g. "Source 1: NE235_L07.pdf". */
  description: string;
  /** True while the source drawer shows this source. */
  expanded?: boolean;
  onClick?: () => void;
}

/**
 * The "every answer has a receipt" chip: monospaced, opens the source.
 * Its hit area is padded to 24px by `.cite::after` in index.css (WCAG 2.5.8).
 */
const CitationChip = ({ label, description, expanded, onClick }: CitationChipProps) => (
  <button
    type='button'
    className='cite'
    aria-label={description}
    aria-expanded={expanded === undefined ? undefined : expanded}
    onClick={onClick}
  >
    {label}
  </button>
);

export default CitationChip;
