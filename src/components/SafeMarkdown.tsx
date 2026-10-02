import type React from 'react';
import ReactMarkdown from 'react-markdown';
import { isSafeMarkdownUrl } from '@/lib/security';

type SafeMarkdownProps = {
  children: string;
  components?: React.ComponentProps<typeof ReactMarkdown>['components'];
};

export default function SafeMarkdown({ children, components }: SafeMarkdownProps) {
  return (
    <ReactMarkdown
      urlTransform={isSafeMarkdownUrl}
      components={{
        ...components,
        a: ({ href, children: linkChildren }) => {
          const safeHref = isSafeMarkdownUrl(href);
          if (!safeHref) return <>{linkChildren}</>;

          const isExternal = /^https?:\/\//i.test(safeHref);
          return (
            <a
              href={safeHref}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
            >
              {linkChildren}
            </a>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
