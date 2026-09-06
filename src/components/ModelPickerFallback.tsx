/** Shown while the lazy-loaded model picker chunk is fetched. */
export const ModelPickerFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="status">
    <span className="rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
      Loading models…
    </span>
  </div>
);
