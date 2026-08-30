const polyPath = (points: Array<[number, number]>): string =>
  'M' +
  points.map((point, index) => `${index ? 'L' : ''}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' ') +
  ' Z';

const blobPoints = (sides: number, jitter: number, shapeIndex: number, rng: () => number): Array<[number, number]> => {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    let rx = 36 * (1 + (rng() - 0.5) * jitter);
    let ry = 33 * (1 + (rng() - 0.5) * jitter);

    // Cabochon / Poring shape variations:
    // 0: Classic Poring / Round Cabochon (slightly bottom-heavy dome)
    // 1: Oval Cabochon (slightly wider horizontal ratio)
    // 2: Cushion / Soft Rectangle Cabochon
    // 3: Teardrop / Pear Cabochon (tapered top)
    // 4: Marquise / Seed Gem
    // 5: Squished Jelly / Blob Cabochon
    const variant = shapeIndex % 6;
    if (variant === 0) {
      // Bottom-heavy Poring dome
      if (angle > 0 && angle < Math.PI) ry *= 1.08;
    } else if (variant === 1) {
      rx *= 1.12;
      ry *= 0.92;
    } else if (variant === 2) {
      const cos4 = Math.cos(4 * angle);
      rx *= 1 + 0.08 * cos4;
      ry *= 1 + 0.08 * cos4;
    } else if (variant === 3) {
      if (angle < 0) ry *= 0.88;
      else ry *= 1.05;
    } else if (variant === 4) {
      const cos2 = Math.cos(2 * angle);
      rx *= 1 + 0.12 * cos2;
      ry *= 1 - 0.1 * cos2;
    } else if (variant === 5) {
      rx *= 1.05;
      ry *= 0.95;
    }

    points.push([50 + Math.cos(angle) * rx, 50 + Math.sin(angle) * ry]);
  }
  return points;
};

export type ShapeResult = {
  body: string;
  facets: string[];
  shine: string;
  highlight: { cx: number; cy: number; rx: number; ry: number; transform?: string };
};

export const buildShape = (shapeIndex: number, rng: () => number): ShapeResult => {
  const sidesMap = [24, 20, 24, 22, 24, 20];
  const jitterMap = [0.02, 0.03, 0.02, 0.03, 0.02, 0.04];
  const sides = sidesMap[shapeIndex % sidesMap.length];
  const jitter = jitterMap[shapeIndex % jitterMap.length];

  const points = blobPoints(sides, jitter, shapeIndex, rng);
  const body = polyPath(points);

  // Soft polished gem / cabochon inner contours instead of harsh polygon mesh lines
  const facets: string[] = [];
  
  // Outer rim contour
  const rimPoints = points.map(([x, y]) => [50 + (x - 50) * 0.92, 50 + (y - 50) * 0.92] as [number, number]);
  facets.push(polyPath(rimPoints));

  // Inner dome crown contour (cabochon table/dome line)
  const domePoints = points.map(([x, y]) => [50 + (x - 50) * 0.72, 47 + (y - 50) * 0.72] as [number, number]);
  facets.push(polyPath(domePoints));

  // Subtle curved facet arc highlights for gemstone feel
  const topPoints = points.slice(0, Math.floor(sides / 2));
  if (topPoints.length > 2) {
    const arcPath = 'M' + topPoints.map((p, i) => `${i ? 'L' : ''}${(50 + (p[0] - 50) * 0.85).toFixed(2)} ${(48 + (p[1] - 50) * 0.85).toFixed(2)}`).join(' ');
    facets.push(arcPath);
  }

  // Specular shine curve on top-left of cabochon
  const shinePoints = points.slice(Math.floor(sides * 0.65), Math.floor(sides * 0.9)).reverse();
  let shine = '';
  if (shinePoints.length > 1) {
    shine = 'M' + shinePoints.map((p, i) => {
      const sx = 50 + (p[0] - 50) * 0.78;
      const sy = 48 + (p[1] - 50) * 0.78;
      return `${i ? 'L' : ''}${sx.toFixed(2)} ${sy.toFixed(2)}`;
    }).join(' ');
  }

  const highlight = {
    cx: 38,
    cy: 28,
    rx: 14,
    ry: 8,
    transform: 'rotate(-22 38 28)',
  };

  return { body, facets, shine, highlight };
};
