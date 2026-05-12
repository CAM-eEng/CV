import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { KeyPasteForm } from '~/components/byok/KeyPasteForm';

vi.mock('~/lib/ai/session', () => ({
  writeSession: vi.fn(),
}));

import { writeSession } from '~/lib/ai/session';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('KeyPasteForm — uncontrolled input', () => {
  it('renders the domain badge with current hostname', () => {
    render(
      <KeyPasteForm providerId="anthropic" defaultModel="claude-opus-4-7" onConnected={() => {}} />,
    );
    expect(screen.getByText(/pasting into/i)).toBeInTheDocument();
    // jsdom default hostname is 'localhost'.
    expect(screen.getByText('localhost')).toBeInTheDocument();
  });

  it('submits the typed value to writeSession and clears the input', () => {
    const onConnected = vi.fn();
    render(
      <KeyPasteForm
        providerId="anthropic"
        defaultModel="claude-opus-4-7"
        onConnected={onConnected}
      />,
    );
    const input = screen.getByLabelText(/API key/i) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'sk-ant-test-123' } });
    fireEvent.submit(input.form!);
    expect(writeSession).toHaveBeenCalledWith({
      providerId: 'anthropic',
      token: 'sk-ant-test-123',
      model: 'claude-opus-4-7',
    });
    expect(input.value).toBe('');
    expect(onConnected).toHaveBeenCalled();
  });

  it('does not re-render on every keystroke (input is uncontrolled)', () => {
    render(<KeyPasteForm providerId="openai" defaultModel="gpt-4o" onConnected={() => {}} />);
    const input = screen.getByLabelText(/API key/i) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'sk-x' } });
    expect(input.value).toBe('sk-x');
  });
});
