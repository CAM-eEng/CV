import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Chat } from '~/components/chat/Chat';
import { JDAnalyzer } from '~/components/jd-analyzer/JDAnalyzer';
import type { CV } from '~/lib/content/cv-schema';

const cvFixture = {
  basics: {
    name: 'Cameron',
    label: 'Engineer',
    summary: 'Test summary',
    location: { city: 'X', region: 'X' },
    profiles: [],
  },
  work: [],
  education: [],
  skills: [],
  projects: [],
} as unknown as CV;

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('Playground terms gate enforcement', () => {
  it('Chat shows placeholder when terms are not accepted', () => {
    render(<Chat cv={cvFixture} />);
    expect(screen.getByText(/Accept the playground terms above to use the chat/i)).toBeInTheDocument();
  });

  it('JDAnalyzer shows placeholder when terms are not accepted', () => {
    render(<JDAnalyzer cv={cvFixture} />);
    expect(
      screen.getByText(/Accept the playground terms above to use the JD analyzer/i),
    ).toBeInTheDocument();
  });

  it('Chat shows the live UI when terms are accepted', () => {
    sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
    render(<Chat cv={cvFixture} />);
    expect(screen.getByText(/Chat with my CV/i)).toBeInTheDocument();
    // Placeholder must NOT appear:
    expect(screen.queryByText(/Accept the playground terms above to use the chat/i)).toBeNull();
  });

  it('JDAnalyzer shows the live UI when terms are accepted', () => {
    sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
    render(<JDAnalyzer cv={cvFixture} />);
    expect(screen.getByPlaceholderText(/Paste a job description here/i)).toBeInTheDocument();
  });
});
