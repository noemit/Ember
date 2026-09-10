import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AvatarIdentity, BallMood, BlobStyle } from '../types';

type BlobComponent = React.ComponentType<{
  seed: string;
  identity?: AvatarIdentity;
  size?: number;
  mood?: BallMood;
  interactive?: boolean;
}>;

const loadBlobComponent = async (style: BlobStyle): Promise<BlobComponent> => {
  if (style === 'glyph') return (await import('./GlyphBlob')).default;
  return (await import('./GrokBlob')).default;
};

const CANVAS = 512;
/** macOS app icons sit inside the 1024 grid with ~10% margin; the squircle radius is ~22.5%. */
const INSET = CANVAS * 0.08;
const TILE = CANVAS - INSET * 2;
const RADIUS = TILE * 0.225;

const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Standalone SVG for a blob. The React markup references theme CSS variables that an
 * `<img>`-loaded SVG can't see, so they're resolved against the document first.
 */
const blobSvg = (
  Component: BlobComponent,
  identity: AvatarIdentity,
  mood: BallMood,
  size: number
): string => {
  const html = renderToStaticMarkup(
    React.createElement(Component, {
      seed: identity.sessionKey,
      identity,
      size,
      mood,
      interactive: false,
    })
  );
  const svg = html.slice(html.indexOf('<svg'), html.lastIndexOf('</svg>') + '</svg>'.length);
  return svg
    .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    .replace(/var\((--[\w-]+)\)/g, (_match, name: string) => cssVar(name) || '#888');
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('blob svg failed to load'));
    image.src = src;
  });

/** Rasterise a session's blob onto a theme-coloured squircle tile, as a PNG data URL. */
export const renderDockIcon = async (
  style: BlobStyle,
  identity: AvatarIdentity,
  mood: BallMood
): Promise<string> => {
  const blobSize = TILE * 0.7;
  const Component = await loadBlobComponent(style);
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(blobSvg(Component, identity, mood, blobSize))}`
  );

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CANVAS;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  ctx.beginPath();
  ctx.roundRect(INSET, INSET, TILE, TILE, RADIUS);
  ctx.fillStyle = cssVar('--sidebar') || '#222';
  ctx.fill();

  const offset = (CANVAS - blobSize) / 2;
  ctx.drawImage(image, offset, offset, blobSize, blobSize);

  // Blobs show state through motion, which a still image loses. Grok draws its own badge for
  // input/question/error and glyphs paint an error dot, so only the rest need a corner marker.
  const hasOwnBadge =
    style === 'grok'
      ? mood === 'input' || mood === 'question' || mood === 'error'
      : mood === 'error';
  if (!hasOwnBadge && mood !== 'idle') {
    const r = TILE * 0.075;
    const cx = INSET + TILE - r * 1.6;
    const cy = INSET + TILE - r * 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = cssVar('--highlight') || '#f08a3a';
    ctx.fill();
    ctx.lineWidth = r * 0.35;
    ctx.strokeStyle = cssVar('--sidebar') || '#222';
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
};
