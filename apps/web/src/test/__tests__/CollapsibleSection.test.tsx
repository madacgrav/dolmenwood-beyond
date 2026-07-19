import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

describe('CollapsibleSection', () => {
  it('starts closed with a count and hides children', () => {
    render(
      <CollapsibleSection title="Skills" count={4}>
        <div>skill rows</div>
      </CollapsibleSection>
    );
    expect(screen.getByRole('button', { name: /skills/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('4 more')).toBeInTheDocument();
    expect(screen.queryByText('skill rows')).not.toBeInTheDocument();
  });

  it('opens on click and hides the count', () => {
    render(
      <CollapsibleSection title="Skills" count={4}>
        <div>skill rows</div>
      </CollapsibleSection>
    );
    fireEvent.click(screen.getByRole('button', { name: /skills/i }));
    expect(screen.getByRole('button', { name: /skills/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('skill rows')).toBeInTheDocument();
    expect(screen.queryByText('4 more')).not.toBeInTheDocument();
  });

  it('respects defaultOpen', () => {
    render(
      <CollapsibleSection title="Slots" defaultOpen>
        <div>slot rows</div>
      </CollapsibleSection>
    );
    expect(screen.getByText('slot rows')).toBeInTheDocument();
  });
});
