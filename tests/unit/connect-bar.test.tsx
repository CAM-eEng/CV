import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { ConnectBar } from '~/components/byok/ConnectBar';
import { REQUEST_CONNECT_EVENT, SESSION_CHANGED_EVENT } from '~/lib/ai/session';

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ConnectBar', () => {
  it('renders the Connect button when no session is set', () => {
    render(<ConnectBar />);
    expect(screen.getByRole('button', { name: /^connect/i })).toBeInTheDocument();
  });

  it('renders the ProviderStatus chip when a session exists', () => {
    sessionStorage.setItem(
      'byok-session',
      JSON.stringify({ providerId: 'anthropic', token: 'sk-x', model: 'claude-opus-4-7' }),
    );
    render(<ConnectBar />);
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    // Button shouldn't be present; only the "Disconnect" button from the chip
    expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument();
  });

  it('opens the ConnectSheet when cv:request-connect is dispatched', () => {
    render(<ConnectBar />);
    // ConnectSheet is closed before the event
    expect(screen.queryByRole('heading', { name: /connect to ask/i })).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(REQUEST_CONNECT_EVENT));
    });
    expect(screen.getByRole('heading', { name: /connect to ask/i })).toBeInTheDocument();
  });

  it('swaps from button to chip when SESSION_CHANGED_EVENT fires', () => {
    render(<ConnectBar />);
    expect(screen.getByRole('button', { name: /^connect/i })).toBeInTheDocument();

    act(() => {
      sessionStorage.setItem(
        'byok-session',
        JSON.stringify({ providerId: 'anthropic', token: 'sk-x', model: 'claude-opus-4-7' }),
      );
      window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
    });

    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument();
  });

  it('opens the ConnectSheet when the Connect button is clicked', () => {
    render(<ConnectBar />);
    fireEvent.click(screen.getByRole('button', { name: /^connect/i }));
    expect(screen.getByRole('heading', { name: /connect to ask/i })).toBeInTheDocument();
  });
});
