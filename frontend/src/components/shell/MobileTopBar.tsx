import { HiOutlineBars3 } from 'react-icons/hi2';
import CoraMark from '../ui-kit/CoraMark';

interface MobileTopBarProps {
  isMenuOpen: boolean;
  onOpenMenu: () => void;
  onHome: () => void;
}

/** Phone/tablet header: menu button and logo. The streak tile is hidden until there is streak data. */
const MobileTopBar = ({ isMenuOpen, onOpenMenu, onHome }: MobileTopBarProps) => (
  <header className='sticky top-0 z-30 flex h-14 items-center justify-between border-b border-red-100 bg-white/95 px-4 backdrop-blur lg:hidden'>
    <button
      type='button'
      onClick={onOpenMenu}
      className='-ml-2 grid h-11 w-11 place-items-center rounded-[12px] text-slate-700'
      aria-label='Open menu'
      aria-expanded={isMenuOpen}
    >
      <HiOutlineBars3 className='h-6 w-6' aria-hidden='true' />
    </button>
    <button type='button' onClick={onHome} className='flex items-center gap-2.5' aria-label='CORA home: your path'>
      <CoraMark />
      <span className='font-display text-[19px] font-bold tracking-tight'>cora</span>
    </button>
    <span className='w-11' aria-hidden='true' />
  </header>
);

export default MobileTopBar;
