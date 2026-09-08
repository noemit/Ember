import * as React from 'react';
import { Check, FolderOpen } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Project } from '../types';

type Props = {
  projects: Project[];
  /** Current folder; matches a project by path, otherwise shows as a custom folder. */
  value: string;
  onSelect: (directory: string) => void;
};

export default function ProjectPicker({ projects, value, onSelect }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selectableProjects = React.useMemo(
    () => projects.filter((project): project is Project & { path: string } => Boolean(project.path)),
    [projects]
  );
  const selected = selectableProjects.find((project) => project.path === value) ?? null;

  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const select = (directory: string) => {
    onSelect(directory);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 max-w-[220px] px-2 text-xs font-normal"
        onClick={() => setOpen(true)}
        aria-label="New agent project"
      >
        <FolderOpen className="size-3.5 text-muted-foreground" />
        <span className="truncate">{selected?.name ?? 'Custom folder'}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[460px] gap-0 overflow-hidden p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Choose a project</DialogTitle>
          <Command>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Type a project name or folder…"
              aria-label="Filter projects"
              className="h-10 text-xs"
            />
            <CommandList className="max-h-[320px] overflow-y-auto p-1.5">
              <CommandGroup>
                <CommandItem
                  value=""
                  onSelect={() => select('')}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] aria-selected:bg-muted"
                >
                  <span className="flex-1">Custom folder</span>
                  {!selected ? <Check className="size-3.5 text-highlight" /> : null}
                </CommandItem>
                {selectableProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`${project.name}\n${project.path}`}
                    onSelect={() => select(project.path)}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] aria-selected:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{project.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{project.path}</span>
                    </span>
                    {project.path === value ? <Check className="mt-0.5 size-3.5 text-highlight" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandEmpty className="px-3 py-8 text-center text-xs text-muted-foreground">
                No projects match “{query.trim()}”.
              </CommandEmpty>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
