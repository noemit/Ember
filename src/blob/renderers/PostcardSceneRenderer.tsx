import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

const INK = '#2d2a26';
const SUN = '#ffd93d';
const SUN_EDGE = '#f4b93c';

const POSTCARD_SKIES = [
  { name: 'Day Sky', sky: '#bfe3f7' },
  { name: 'Dusk Peach', sky: '#f7d9b8' },
  { name: 'Mint Morning', sky: '#cdeedd' },
  { name: 'Lavender Evening', sky: '#ddd6f8' },
];

const SUN_X = 66;
const SUN_Y = 28;

export default function PostcardSceneRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const sunFaceRef = React.useRef<SVGGElement>(null);

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const sky = POSTCARD_SKIES[Math.floor(rng() * POSTCARD_SKIES.length)];
  const sceneType = Math.floor(rng() * 6); // 0: Desert, 1: Farm, 2: Mountains, 3: Island, 4: Volcano, 5: Rolling Hills
  const clipId = `postcard-clip-${seedHash.toString(36)}`;

  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !sunFaceRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = (dx / dist) * 2.5 * reach;
      const ty = (dy / dist) * 2 * reach;
      sunFaceRef.current.setAttribute(
        'transform',
        `translate(${(SUN_X + tx).toFixed(2)} ${(SUN_Y + ty).toFixed(2)})`
      );
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  const terrain = () => {
    switch (sceneType) {
      case 0:
        /* Desert (from fbedf22b cactus tile) */
        return (
          <g>
            <path d="M 5 68 Q 30 56 52 66 T 95 64 L 95 95 L 5 95 Z" fill="#f2c26b" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 5 80 Q 42 70 62 78 T 95 76 L 95 95 L 5 95 Z" fill="#dfa64f" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <g stroke={INK} strokeWidth="2" strokeLinecap="round" opacity="0.6">
              <line x1="58" y1="86" x2="66" y2="86" />
              <line x1="74" y1="90" x2="84" y2="90" />
            </g>
            <g fill="#5f9e4a" stroke={INK} strokeWidth="2.6" strokeLinejoin="round">
              <rect x="21" y="40" width="7" height="27" rx="3.5" />
              <rect x="12" y="44" width="5" height="11" rx="2.5" />
              <rect x="12" y="52" width="10" height="5" rx="2.5" />
              <rect x="32" y="38" width="5" height="12" rx="2.5" />
              <rect x="27" y="47" width="10" height="5" rx="2.5" />
            </g>
          </g>
        );
      case 1:
        /* Farm (from fbedf22b barn tile) */
        return (
          <g>
            <rect x="5" y="62" width="90" height="33" fill="#7cb35b" stroke={INK} strokeWidth="2.6" />
            <g stroke="#4c7c34" strokeWidth="2" strokeLinecap="round">
              <line x1="50" y1="66" x2="26" y2="93" />
              <line x1="50" y1="66" x2="50" y2="93" />
              <line x1="50" y1="66" x2="74" y2="93" />
            </g>
            <g stroke={INK} strokeWidth="2.6" strokeLinejoin="round">
              <rect x="12" y="50" width="20" height="13" fill="#d05a3a" />
              <polygon points="10,51 22,40 34,51" fill="#8a3b28" />
              <rect x="19" y="55" width="6" height="8" fill="#f2c26b" />
            </g>
            <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
              <circle cx="78" cy="54" r="7" fill="#4c8c3f" />
              <line x1="78" y1="61" x2="78" y2="67" stroke="#6b4a2e" strokeWidth="3" strokeLinecap="round" />
            </g>
          </g>
        );
      case 2:
        /* Mountains (from fbedf22b peak tile) */
        return (
          <g>
            <polygon points="6,68 32,26 56,68" fill="#93a3b8" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 25 40 L 32 26 L 40 41 L 36 36 L 32 42 L 28 36 Z" fill="#ffffff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <polygon points="38,68 64,34 92,68" fill="#b6c4d6" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 57 47 L 64 34 L 72 48 L 68 43 L 64 49 L 60 43 Z" fill="#ffffff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <rect x="5" y="66" width="90" height="29" fill="#8fc866" stroke={INK} strokeWidth="2.6" />
          </g>
        );
      case 3:
        /* Island (from fbedf22b palm tile) */
        return (
          <g>
            <rect x="5" y="58" width="90" height="37" fill="#5cb8e0" stroke={INK} strokeWidth="2.6" />
            <g className="postcard-wave" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
              <line x1="14" y1="68" x2="24" y2="68" />
              <line x1="30" y1="76" x2="42" y2="76" />
              <line x1="20" y1="85" x2="32" y2="85" />
              <line x1="52" y1="88" x2="62" y2="88" />
            </g>
            <ellipse cx="72" cy="61" rx="17" ry="7" fill="#ecd391" stroke={INK} strokeWidth="2.6" />
            <path d="M 69 60 C 70 50 73 45 78 40 L 82 42 C 77 47 75 52 75 60 Z" fill="#a5763f" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <g fill="#4c9e46" stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
              <path d="M 79 41 Q 68 34 61 40 Q 71 41 79 44 Z" />
              <path d="M 79 41 Q 90 34 96 40 Q 87 41 79 44 Z" />
              <path d="M 79 41 Q 74 30 66 29 Q 74 34 77 42 Z" />
              <path d="M 79 41 Q 85 30 93 30 Q 84 35 81 42 Z" />
            </g>
          </g>
        );
      case 4:
        /* Volcano (from 41506930 waterfall tile energy) */
        return (
          <g>
            <polygon points="14,72 46,24 78,72" fill="#8a5a44" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <polygon points="38,34 46,24 54,34" fill="#e2543e" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M 42 32 Q 41 40 43 46 M 50 32 Q 52 38 51 44" fill="none" stroke="#e2543e" strokeWidth="3" strokeLinecap="round" />
            <path d="M 5 76 Q 34 66 52 74 T 95 72 L 95 95 L 5 95 Z" fill="#c9a06a" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          </g>
        );
      default:
        /* Rolling Hills (from fbedf22b winding path tile) */
        return (
          <g>
            <path d="M 5 70 Q 30 48 55 66 T 95 60 L 95 95 L 5 95 Z" fill="#8fc866" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 5 82 Q 40 62 95 78 L 95 95 L 5 95 Z" fill="#6aa84f" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 46 95 C 50 84 60 80 58 72" fill="none" stroke="#f4e3b2" strokeWidth="4.5" strokeLinecap="round" />
            <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
              <circle cx="22" cy="62" r="6.5" fill="#4c8c3f" />
              <line x1="22" y1="68" x2="22" y2="73" stroke="#6b4a2e" strokeWidth="3" strokeLinecap="round" />
              <circle cx="80" cy="64" r="5" fill="#4c8c3f" />
              <line x1="80" y1="69" x2="80" y2="74" stroke="#6b4a2e" strokeWidth="2.6" strokeLinecap="round" />
            </g>
          </g>
        );
    }
  };

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`blob-postcard-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="6.5" y="6.5" width="87" height="87" rx="12" />
        </clipPath>
      </defs>

      {/* Animated scene body */}
      <g className="postcard-scene-body">
        <rect x="6.5" y="6.5" width="87" height="87" rx="12" fill={sky.sky} />

        <g clipPath={`url(#${clipId})`}>
          {/* Sun rays (spin) */}
          <g className="postcard-sun-rays" stroke={SUN_EDGE} strokeWidth="2.8" strokeLinecap="round">
            <line x1={SUN_X} y1={SUN_Y - 15} x2={SUN_X} y2={SUN_Y - 21} />
            <line x1={SUN_X} y1={SUN_Y + 15} x2={SUN_X} y2={SUN_Y + 21} />
            <line x1={SUN_X - 15} y1={SUN_Y} x2={SUN_X - 21} y2={SUN_Y} />
            <line x1={SUN_X + 15} y1={SUN_Y} x2={SUN_X + 21} y2={SUN_Y} />
            <line x1={SUN_X - 11} y1={SUN_Y - 11} x2={SUN_X - 15.5} y2={SUN_Y - 15.5} />
            <line x1={SUN_X + 11} y1={SUN_Y - 11} x2={SUN_X + 15.5} y2={SUN_Y - 15.5} />
            <line x1={SUN_X - 11} y1={SUN_Y + 11} x2={SUN_X - 15.5} y2={SUN_Y + 15.5} />
            <line x1={SUN_X + 11} y1={SUN_Y + 11} x2={SUN_X + 15.5} y2={SUN_Y + 15.5} />
          </g>

          {/* Sun = the agent face */}
          <circle cx={SUN_X} cy={SUN_Y} r="12" fill={SUN} stroke={INK} strokeWidth="2.6" />
          <g ref={sunFaceRef} transform={`translate(${SUN_X} ${SUN_Y})`}>
            {isError ? (
              <g stroke={INK} strokeWidth="2" strokeLinecap="round">
                <line x1="-6" y1="-4" x2="-2" y2="0" />
                <line x1="-6" y1="0" x2="-2" y2="-4" />
                <line x1="2" y1="-4" x2="6" y2="0" />
                <line x1="2" y1="0" x2="6" y2="-4" />
              </g>
            ) : (
              <g fill={INK}>
                <circle cx="-3.6" cy="-2" r="1.9" />
                <circle cx="3.6" cy="-2" r="1.9" />
              </g>
            )}
            {isNeedsInput ? (
              <ellipse cx="0" cy="4.5" rx="2.4" ry="3.4" fill={INK} />
            ) : isError ? (
              <path d="M -3.4 5.5 Q 0 2.5 3.4 5.5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M -3.4 3 Q 0 6.5 3.4 3" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            )}
            {isNeedsInput && (
              <g stroke={INK} strokeWidth="1.8" strokeLinecap="round">
                <line x1="-7" y1="-8" x2="-4.5" y2="-6" />
                <line x1="7" y1="-8" x2="4.5" y2="-6" />
              </g>
            )}
          </g>

          {/* Drifting clouds */}
          <g className="postcard-cloud" fill="#ffffff">
            <ellipse cx="26" cy="22" rx="9" ry="5" />
            <ellipse cx="33" cy="19" rx="7" ry="5" />
            <ellipse cx="19" cy="20" rx="5.5" ry="4" />
          </g>
          <g className="postcard-cloud-2" fill="#ffffff" opacity="0.9">
            <ellipse cx="46" cy="14" rx="6.5" ry="3.8" />
            <ellipse cx="52" cy="12" rx="5" ry="3.6" />
          </g>

          {/* Scene terrain */}
          {terrain()}

          {/* Bird flies across when active */}
          <g className="postcard-bird" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d="M 0 0 Q 3 -3.4 6 0 Q 9 -3.4 12 0" />
          </g>

          {/* Error storm + rain */}
          <g className="postcard-storm">
            <g fill="#8d99a6" stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
              <ellipse cx="66" cy="26" rx="14" ry="8" />
              <ellipse cx="58" cy="22" rx="9" ry="6.5" />
              <ellipse cx="74" cy="21" rx="9" ry="6.5" />
            </g>
            <g className="postcard-rain" stroke="#4a7fb5" strokeWidth="2.2" strokeLinecap="round">
              <line x1="56" y1="38" x2="53" y2="46" />
              <line x1="66" y1="40" x2="63" y2="48" />
              <line x1="76" y1="38" x2="73" y2="46" />
              <line x1="61" y1="52" x2="58" y2="60" />
              <line x1="72" y1="54" x2="69" y2="62" />
            </g>
          </g>

          {/* Needs-input exclamation bubble */}
          <g className="postcard-alert">
            <circle cx="84" cy="14" r="6.5" fill="#ffffff" stroke={INK} strokeWidth="2.2" />
            <line x1="84" y1="10.5" x2="84" y2="15" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="84" cy="18" r="1.1" fill={INK} />
          </g>
        </g>

        {/* Bold postcard frame on top */}
        <rect x="5" y="5" width="90" height="90" rx="14" fill="none" stroke={INK} strokeWidth="3.4" />
      </g>
    </svg>
  );
}
