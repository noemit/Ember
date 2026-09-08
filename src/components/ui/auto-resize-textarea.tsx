import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type AutoResizeTextareaProps = React.ComponentProps<typeof Textarea> & {
  maxHeight?: number;
};

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ maxHeight = 160, className, onChange, value, ...props }, forwardedRef) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const textareaRef = React.useMemo(
      () => (forwardedRef && typeof forwardedRef === 'function' ? forwardedRef : null),
      [forwardedRef]
    );
    const mergedRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node;
        if (textareaRef) textareaRef(node);
        else if (forwardedRef && typeof forwardedRef !== 'function') {
          (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }
      },
      [textareaRef, forwardedRef]
    );

    React.useLayoutEffect(() => {
      const textarea = internalRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }, [value, maxHeight]);

    return (
      <Textarea
        ref={mergedRef}
        value={value}
        onChange={onChange}
        className={cn('min-h-9 resize-none overflow-hidden py-2', className)}
        style={{ height: 'auto' }}
        {...props}
      />
    );
  }
);
AutoResizeTextarea.displayName = 'AutoResizeTextarea';
