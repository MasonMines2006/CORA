import { ReactNode, useRef } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';
import { useDialogFocus } from './useDialogFocus';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** The sidebar as a slide-in menu on phones and tablets (below 1024px). */
const MenuDrawer = ({ isOpen, onClose, children }: MenuDrawerProps) => {
  const closeButton = useRef<HTMLButtonElement>(null);
  useDialogFocus(isOpen, onClose, closeButton);
  if (!isOpen) {
    return null;
  }
  return (
    <div className='fixed inset-0 z-50 lg:hidden' role='dialog' aria-modal='true' aria-label='Menu'>
      {/* The dimmed backdrop closes the menu when tapped. It is not focusable; Escape and the X do the same. */}
      <div className='absolute inset-0 bg-slate-900/40' onClick={onClose} aria-hidden='true' />
      <div className='enter absolute inset-y-0 left-0 w-[300px] max-w-[85vw] bg-white shadow-xl'>
        <button
          ref={closeButton}
          type='button'
          onClick={onClose}
          className='absolute right-2 top-2.5 z-10 grid h-11 w-11 place-items-center rounded-[12px] text-slate-500'
          aria-label='Close menu'
        >
          <HiOutlineXMark className='h-6 w-6' aria-hidden='true' />
        </button>
        {children}
      </div>
    </div>
  );
};

export default MenuDrawer;
