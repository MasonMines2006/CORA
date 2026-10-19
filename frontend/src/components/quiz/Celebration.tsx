import { CSSProperties } from 'react';

const COLOURS = ['#dc2626', '#059669', '#d97706', '#0f766e', '#fecaca'];
const PIECES = 22;

/**
 * One short burst of confetti (900ms). Only rendered when mastery rose
 * (see `shouldCelebrate`); the CSS turns it off under prefers-reduced-motion.
 */
const Celebration = () => (
  <div className='burst' aria-hidden='true'>
    {Array.from({ length: PIECES }, (_, index) => {
      const angle = (index / PIECES) * Math.PI * 2;
      const distance = 90 + (index % 4) * 30;
      const style = {
        background: COLOURS[index % COLOURS.length],
        '--x': `${Math.cos(angle) * distance}px`,
        '--y': `${Math.sin(angle) * distance * 0.7}px`,
        '--r': `${(index * 47) % 360}deg`,
      } as CSSProperties;
      return <i key={index} style={style} />;
    })}
  </div>
);

export default Celebration;
