import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberField } from '../../components/ui/NumberField';

function getInput(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement;
}

describe('NumberField', () => {
  it('renders empty when value is null', () => {
    render(<NumberField value={null} onCommit={() => {}} aria-label="qty" />);
    expect((screen.getByLabelText('qty') as HTMLInputElement).value).toBe('');
  });

  it('renders the value when set', () => {
    render(<NumberField value={12} onCommit={() => {}} aria-label="qty" />);
    expect((screen.getByLabelText('qty') as HTMLInputElement).value).toBe('12');
  });

  it('strips non-digits in integer mode, including dots', () => {
    render(<NumberField value={null} onCommit={() => {}} aria-label="qty" />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '1a.2b' } });
    expect(input.value).toBe('12');
  });

  it('keeps a single dot in decimal mode', () => {
    render(<NumberField value={null} onCommit={() => {}} allowDecimal aria-label="wt" />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '0.0.75' } });
    expect(input.value).toBe('0.075');
  });

  it('commits parsed decimal on blur', () => {
    const onCommit = vi.fn();
    render(<NumberField value={null} onCommit={onCommit} allowDecimal aria-label="wt" />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(2.5);
  });

  it('commits null when cleared', () => {
    const onCommit = vi.fn();
    render(<NumberField value={7} onCommit={onCommit} aria-label="qty" />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('clamps to min and max on commit', () => {
    const onCommit = vi.fn();
    render(<NumberField value={null} onCommit={onCommit} min={1} max={10} aria-label="qty" />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenLastCalledWith(1);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenLastCalledWith(10);
  });

  it('commits on Enter via blur', () => {
    const onCommit = vi.fn();
    render(<NumberField value={null} onCommit={onCommit} aria-label="qty" />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(3);
  });

  it('resyncs from prop when not editing', () => {
    const { rerender } = render(<NumberField value={1} onCommit={() => {}} aria-label="qty" />);
    rerender(<NumberField value={5} onCommit={() => {}} aria-label="qty" />);
    expect(getInput().value).toBe('5');
  });
});
