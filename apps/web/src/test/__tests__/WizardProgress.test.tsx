import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardProgress } from '../../components/wizard/WizardProgress';

describe('WizardProgress', () => {
  it('renders the step counter', () => {
    render(<WizardProgress step={3} totalSteps={13} title="Pick Your Kindred" />);
    expect(screen.getByText('3 / 13')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<WizardProgress step={1} totalSteps={13} title="Roll Ability Scores" />);
    expect(screen.getByText('Roll Ability Scores')).toBeInTheDocument();
  });

  it('does NOT render a back button when onBack is not provided', () => {
    render(<WizardProgress step={1} totalSteps={13} title="Step 1" />);
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
  });

  it('renders a back button when onBack is provided', () => {
    render(<WizardProgress step={2} totalSteps={13} title="Step 2" onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<WizardProgress step={2} totalSteps={13} title="Step 2" onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /go back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('sets progress bar width proportional to step/totalSteps', () => {
    const { container } = render(<WizardProgress step={13} totalSteps={13} title="Final Step" />);
    // The inner bar div (last div in the progress track)
    const bars = container.querySelectorAll('div');
    const progressBar = Array.from(bars).find(
      (el) => el.style.width && el.style.width.endsWith('%'),
    );
    expect(progressBar).toBeDefined();
    expect(progressBar!.style.width).toBe('100%');
  });

  it('renders partial progress correctly', () => {
    const { container } = render(<WizardProgress step={1} totalSteps={4} title="Step 1" />);
    const bars = container.querySelectorAll('div');
    const progressBar = Array.from(bars).find(
      (el) => el.style.width && el.style.width.endsWith('%'),
    );
    expect(progressBar!.style.width).toBe('25%');
  });
});
