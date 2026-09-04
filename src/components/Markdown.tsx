import * as React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Element, Root, RootContent } from 'hast';
import { cn } from '@/lib/utils';
import { tokenizeLinks } from './Linkify';

const SKIP_TAGS = new Set(['a', 'code', 'pre']);

/**
 * rehype plugin: turn bare local paths inside prose into links. remark-gfm already
 * autolinks URLs, so this only needs to catch what Linkify would — paths — and leave
 * code and existing anchors alone.
 */
const rehypeLinkPaths = () => (tree: Root) => {
  const visit = (node: Root | Element) => {
    node.children = node.children.flatMap((child): RootContent[] => {
      if (child.type === 'element') {
        if (!SKIP_TAGS.has(child.tagName)) visit(child);
        return [child];
      }
      if (child.type !== 'text') return [child];
      const tokens = tokenizeLinks(child.value);
      if (tokens.every((token) => token.type === 'text')) return [child];
      return tokens.map((token) =>
        token.type === 'text'
          ? { type: 'text', value: token.value }
          : {
              type: 'element',
              tagName: 'a',
              properties: { href: token.value },
              children: [{ type: 'text', value: token.value }],
            }
      );
    });
  };
  visit(tree);
};

const openLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
  const href = event.currentTarget.getAttribute('href');
  event.preventDefault();
  event.stopPropagation();
  if (href) void window.ember.openExternal(href);
};

const components: Components = {
  a: ({ node: _node, children, ...props }) => (
    <a
      {...props}
      onClick={openLink}
      title={props.href}
      className="cursor-pointer break-all underline decoration-current/50 underline-offset-2 hover:decoration-current"
    >
      {children}
    </a>
  ),
  // Images from the model are untrusted; no width/height hints, just bounded.
  img: ({ node: _node, alt, ...props }) => (
    <img {...props} alt={alt ?? ''} loading="lazy" className="my-1.5 max-h-72 max-w-full rounded-md" />
  ),
};

type Props = {
  text: string;
  className?: string;
};

/** Assistant prose. GitHub-flavoured markdown, raw HTML is never rendered. */
function Markdown({ text, className }: Props) {
  return (
    <div
      className={cn(
        'break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        '[&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
        '[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-[15px] [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[14px] [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-semibold',
        '[&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_hr]:my-3 [&_hr]:border-border',
        '[&_code]:font-mono [&_code]:text-[12px] [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-background/70 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5',
        '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background/70 [&_pre]:px-3 [&_pre]:py-2 [&_pre]:leading-relaxed',
        '[&_table]:my-2 [&_table]:block [&_table]:w-max [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-[12px] [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeLinkPaths]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default React.memo(Markdown);
