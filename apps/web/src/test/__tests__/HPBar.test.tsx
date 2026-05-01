import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HPBar } from '../../components/ui/HPBar';

describe('HPBar', () => {
  it('shows HP numbers by default', () => {
    render(<HPBar current={8} max={10} />);
    expect(screen.getByText('8 / 10 HP')).toBeInTheDocument();
  });

  it('hides HP numbers when showNumbers=false', () => {
    render(<HPBar current={8} max={10} showNumbers={false} />);
    expect(screen.queryByText('8 / 10 HP')).not.toBeInTheDocument();
  });

  it('renders at full width for full HP', () => {
    render(<HPBar current={10} max={10} />);
    const fill = screen.getByTestId('hp-bar-fill');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  it('renders at 0% width for zero HP', () => {
    render(<HPBar current={0} max={10} />);
    const fill = screen.getByTestId('hp-bar-fill');
    expect(fill).toHaveStyle({ width: '0%' });
  });

  it('uses primary color for high HP (>66%)', () => {
    render(<HPBar current={9} max={10} />);
    const fill = screen.getByTestId('hp-bar-fill');
    expect(fill.getAttribute('style')).toContain('var(--color-primary)');
  });

  it('uses gold color for medium HP (33%–66%)', () => {
    render(<HPBar current={5} max={10} />);
    const fill = screen.getByTestId('hp-bar-fill');
    expect(fill.getAttribute('style')).toContain('var(--color-gold)');
  });

  it('uses danger color for low HP (<33%)', () => {
    render(<HPBar current={2} max={10} />);
    const fill = screen.getByTestId('hp-bar-fill');
    expect(fill.getAttribute('style')).toContain('var(--color-danger)');
  });

  it('handles zero max HP without dividing by zero', () => {
    render(<HPBar current={0} max={0} />);
    const fill = screen.getByTestId('hp-bar-fill');
    expect(fill).toHaveStyle({ width: '0%' });
  });

  it('clamps width to 100% when current exceeds max', () => {
    render(<HPBar current={15} max={10} />);
    const fill = screen.getByTestId('hp-bar-fill');
    expect(fill).toHaveStyle({ width: '100%' });
  });
});
