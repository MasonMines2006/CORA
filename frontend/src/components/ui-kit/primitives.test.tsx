import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Button, { buttonClass } from './Button';
import InlineError from './InlineError';
import SegmentBar from './SegmentBar';
import StateChip from './StateChip';

describe('buttonClass', () => {
  it('builds the key-button classes, leaving the default size out', () => {
    expect(buttonClass({})).toBe('btn btn-primary');
    expect(buttonClass({ variant: 'secondary', size: 'lg', block: true, className: 'mt-4' })).toBe(
      'btn btn-secondary btn-lg btn-block mt-4'
    );
  });

  it('renders a real button that is not a form submit by default', () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('type', 'button');
  });
});

describe('SegmentBar', () => {
  it('marks earlier steps done and the current one on', () => {
    const { container } = render(<SegmentBar count={4} current={2} label='Lesson progress' />);
    const segments = [...container.querySelectorAll('i')].map((segment) => segment.className);
    expect(segments).toEqual(['done', 'done', 'on', '']);
    expect(screen.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '3');
  });

  it('is hidden from screen readers when it has no label', () => {
    const { container } = render(<SegmentBar count={3} current={0} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('StateChip', () => {
  it('says the state in words, not just colour', () => {
    render(<StateChip state='inProgress' />);
    expect(screen.getByText('In progress')).toHaveClass('state', 'state-progress');
  });
});

describe('InlineError', () => {
  it('announces itself and offers Retry', () => {
    const onRetry = vi.fn();
    render(<InlineError title='Could not load your path' onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your path');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
