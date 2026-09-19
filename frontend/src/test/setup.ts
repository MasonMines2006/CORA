import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom has window.scrollTo but only as a stub that logs "Not implemented" on every
// call. StudentApp scrolls to the top on each navigation, so without this every
// navigation test prints an error that is not an error.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
