import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
  maxHeight?: string;
}

/**
 * Simple markdown viewer — renders pre-formatted text.
 * Replace with react-markdown if richer rendering is needed:
 *   npm install react-markdown
 *   import ReactMarkdown from 'react-markdown'
 *   return <ReactMarkdown>{content}</ReactMarkdown>
 */
export function MarkdownViewer({ content, className, maxHeight = 'max-h-[600px]' }: MarkdownViewerProps) {
  return (
    <pre
      className={cn(
        'text-xs whitespace-pre-wrap overflow-auto font-mono text-muted-foreground leading-relaxed',
        maxHeight,
        className
      )}
    >
      {content}
    </pre>
  );
}
