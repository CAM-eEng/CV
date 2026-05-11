import { SafeMarkdown } from '~/lib/markdown/safe';
import { rewriteCitations } from '~/lib/ai/citations';

interface Props {
  role: 'user' | 'assistant';
  content: string;
}

export function Message({ role, content }: Props) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 px-4 py-2 text-sm">
          {content}
        </div>
      </div>
    );
  }
  const cited = rewriteCitations(content);
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-sm">
        <SafeMarkdown content={cited} />
      </div>
    </div>
  );
}
