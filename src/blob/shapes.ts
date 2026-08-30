const polyPath = (points: Array<[number, number]>): string =>
  'M' +
  points.map((point, index) => `${index ? 'L' : ''}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' ') +
  ' Z';

const blobPoints = (sides: number, jitter: number, rng: () => number): Array<[number, number]> => {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const radius = 34 * (1 + (rng() - 0.5) * jitter);
    points.push([50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius]);
  }
  return points;
};

export type ShapeResult = {
  body: string;
  facets: string[];
};

export const buildShape = (shapeIndex: number, rng: () => number): ShapeResult => {
  const sidesMap = [16, 8, 6, 4, 5, 11];
  const jitterMap = [0.06, 0.05, 0.0, 0.0, 0.03, 0.18];
  const sides = sidesMap[shapeIndex % sidesMap.length];
  const jitter = jitterMap[shapeIndex % jitterMap.length];

  const points = blobPoints(sides, jitter, rng);
  const body = polyPath(points);

  const facets: string[] = points.map((point) => `M50 50 L${point[0].toFixed(2)} ${point[1].toFixed(2)}`);
  const inner = points.map(([x, y]) => [50 + (x - 50) * 0.6, 50 + (y - 50) * 0.6] as [number, number]);
  facets.push(polyPath(inner));

  return { body, facets };
};
