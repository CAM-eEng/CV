import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SafeMarkdown } from '~/lib/markdown/safe';

describe('SafeMarkdown', () => {
  it('renders bold and italic', () => {
    const { container } = render(<SafeMarkdown content="**bold** and _italic_" />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('renders inline code and code blocks', () => {
    const { container } = render(<SafeMarkdown content={'`inline` and\n\n```\nblock\n```'} />);
    expect(container.querySelector('code')?.textContent).toBe('inline');
    expect(container.querySelector('pre code')?.textContent).toMatch(/^block/);
  });

  it('renders links with rel="noopener noreferrer"', () => {
    const { container } = render(<SafeMarkdown content="[home](/cv)" />);
    const a = container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/cv');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('strips <script> tags', () => {
    const { container } = render(<SafeMarkdown content={'<script>alert(1)</script>safe'} />);
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.textContent).toContain('safe');
  });

  it('strips inline event handlers', () => {
    const { container } = render(<SafeMarkdown content={'<img src=x onerror="alert(1)">'} />);
    expect(container.innerHTML).not.toMatch(/onerror=/i);
  });

  it('strips javascript: URLs', () => {
    const { container } = render(<SafeMarkdown content="[bad](javascript:alert(1))" />);
    const a = container.querySelector('a');
    if (a) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    }
  });
});
