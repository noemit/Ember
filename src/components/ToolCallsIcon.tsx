/**
 * The tool-call display glyph: a wrench, with a slash across it when tool calls are hidden — the
 * same "off" treatment `ThinkingIcon` gives the brain in its hidden state, so the two header
 * toggles read consistently.
 *
 * `casing` is the surface behind the slash; it is drawn as a thick line under the slash so the
 * line cuts cleanly through the wrench instead of merging with it. It defaults to the button
 * background (`--background`); the header toggle's pressed state is `--muted`, so pass that there.
 */
const WRENCH_PATH =
  'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z';
const SLASH = { x1: 3.5, y1: 3.5, x2: 20.5, y2: 20.5 };

type Props = {
  hidden: boolean;
  casing?: string;
  className?: string;
};

export default function ToolCallsIcon({ hidden, casing = 'var(--background)', className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={WRENCH_PATH} />
      {hidden ? (
        <>
          <line {...SLASH} stroke={casing} strokeWidth={5} />
          <line {...SLASH} strokeWidth={2.2} />
        </>
      ) : null}
    </svg>
  );
}
