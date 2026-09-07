import * as React from 'react';
import { Check, ChevronDown, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return selectableProjects;
    return selectableProjects.filter((project) =>
      [project.name, project.path].some((part) => part.toLowerCase().includes(needle))
    );
  }, [selectableProjects, query]);

  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

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
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[460px] p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Choose a project</DialogTitle>
          <div className="border-b p-2.5">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a project name or folder…"
              aria-label="Filter projects"
              className="h-9 text-xs shadow-none"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => {
                onSelect('');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span className="flex-1">Custom folder</span>
              {!selected ? <Check className="size-3.5 text-highlight" /> : null}
            </button>
            {filtered.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  onSelect(project.path);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{project.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{project.path}</span>
                </span>
                {project.path === value ? <Check className="mt-0.5 size-3.5 text-highlight" /> : null}
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No projects match “{query.trim()}”.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
