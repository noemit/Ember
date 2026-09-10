import type { ReasoningDisplay } from '../types';

/**
 * The chat header's thinking-display glyph. All three states share one brain; collapsed adds a
 * bold bar across it and hidden adds a slash, each cut out of the brain with a background-coloured
 * casing so it still reads at the 14px header size. Expanded is the plain brain.
 *
 * Reviewed in `buddy-arena/` (`/thinking`); this is the "A · bar / slash" option.
 */
const BRAIN_PATHS = [
  'M12 18V5',
  'M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4',
  'M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5',
  'M17.997 5.125a4 4 0 0 1 2.526 5.77',
  'M18 18a4 4 0 0 0 2-7.464',
  'M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517',
  'M6 18a4 4 0 0 1-2-7.464',
  'M6.003 5.125a4 4 0 0 0-2.526 5.77',
];

const MARKS: Partial<Record<ReasoningDisplay, { x1: number; y1: number; x2: number; y2: number }>> = {
  collapsed: { x1: 4.5, y1: 12, x2: 19.5, y2: 12 },
  hidden: { x1: 3.5, y1: 3.5, x2: 20.5, y2: 20.5 },
};

type Props = {
  mode: ReasoningDisplay;
  className?: string;
};

export default function ThinkingIcon({ mode, className }: Props) {
  const mark = MARKS[mode];
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
      {BRAIN_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
      {mark ? (
        <>
          <line {...mark} stroke="var(--background)" strokeWidth={5} />
          <line {...mark} strokeWidth={2.2} />
        </>
      ) : null}
    </svg>
  );
}
