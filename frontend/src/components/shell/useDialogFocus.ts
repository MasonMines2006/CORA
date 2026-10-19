import { RefObject, useEffect, useRef } from 'react';

/**
 * Keyboard rules for drawers, sheets and menus (DESIGN.md section 8):
 * focus moves in when it opens, Escape closes it, and focus goes back to
 * whatever opened it when it closes.
 *
 * `firstFocus` is the element to focus on open (usually the close button).
 */
export const useDialogFocus = (isOpen: boolean, onClose: () => void, firstFocus: RefObject<HTMLElement>) => {
  // Remember who had focus before we opened, so we can hand it back.
  const opener = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the effect on every render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    opener.current = document.activeElement as HTMLElement | null;
    firstFocus.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener.current?.focus?.();
    };
  }, [isOpen, firstFocus]);
};
