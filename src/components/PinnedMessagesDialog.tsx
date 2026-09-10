import { LocateFixed, PinOff, Reply } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ChatMessage } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessage[];
  onJump: (messageId: string) => void;
  onReply: (message: ChatMessage) => void;
  onUnpin: (message: ChatMessage) => void;
};

const messageText = (message: ChatMessage): string =>
  message.text.trim() ||
  message.parts
    .map((part) => {
      if (part.type === 'reasoning') return part.text;
      if (part.type === 'file') return `File: ${part.file.filename}`;
      if (part.type === 'tool') return `${part.call.tool}: ${part.call.title ?? part.call.output ?? ''}`;
      return part.text;
    })
    .filter(Boolean)
    .join('\n');

export default function PinnedMessagesDialog({
  open,
  onOpenChange,
  messages,
  onJump,
  onReply,
  onUnpin,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Pinned messages</DialogTitle>
          <DialogDescription>
            {messages.length === 1 ? '1 pinned message' : `${messages.length} pinned messages`}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
          {messages.length ? (
            messages.map((message) => (
              <Card key={message.id}>
                <CardContent className="p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                    <span className="font-medium capitalize text-foreground">{message.role}</span>
                    {message.createdAt ? (
                      <span>
                        {new Date(message.createdAt).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted-foreground">
                    {messageText(message) || 'Message without text'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    <Button size="xs" variant="secondary" onClick={() => onJump(message.id)}>
                      <LocateFixed />
                      Jump
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => onReply(message)}>
                      <Reply />
                      Reply
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => onUnpin(message)}>
                      <PinOff />
                      Unpin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="py-6 text-center text-[12px] text-muted-foreground">
              Pin useful messages in the transcript to collect them here.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
