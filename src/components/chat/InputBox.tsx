import { useState, useRef } from 'react';
import { MAX_TEXT_INPUT_CHARS } from '~/lib/ai/limits';

interface Props {
  disabled: boolean;
  onSubmit: (text: string) => void;
}

export function InputBox({ disabled, onSubmit }: Props) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText('');
    taRef.current?.focus();
  }

  const pct = text.length / MAX_TEXT_INPUT_CHARS;
  const counterColor =
    pct >= 0.95
      ? 'text-red-600 dark:text-red-400'
      : pct >= 0.8
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-neutral-500 dark:text-neutral-400';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-1"
    >
      <div className="flex gap-2 items-end">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={disabled}
          maxLength={MAX_TEXT_INPUT_CHARS}
          placeholder="Ask about Cameron's work, AI experience, projects…"
          className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm resize-y min-h-[40px] max-h-32 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="px-4 py-2 rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 text-sm disabled:opacity-50"
        >
          Ask
        </button>
      </div>
      <div className={`text-xs text-right tabular-nums ${counterColor}`}>
        {text.length} / {MAX_TEXT_INPUT_CHARS}
      </div>
    </form>
  );
}
