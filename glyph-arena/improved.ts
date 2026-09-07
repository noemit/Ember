/**
 * Improved variants of every glyph in src/blob/glyphs.ts, authored for legibility at 30px:
 * chunkier fills, consistent stroke weights (>=4), clearer silhouettes, bigger cutouts.
 * Same markup contract as the originals: {c} = glyph colour, {id} = unique prefix,
 * accents use var(--background) so they read as cut-outs on any theme.
 */
export type ImprovedGlyph = { name: string; body: string; note: string };

export const IMPROVED: ImprovedGlyph[] = [
  {
    name: 'raindrops',
    note: 'Both drops now share one path (defs/use) so their curves are consistent; the small drop is bigger and the pair is balanced.',
    body: '<defs><path id="{id}d" d="M0-11c3.2 5.5 8 11.2 8 17.5a8 8 0 1 1-16 0C-8 6.2-3.2-5.5 0-11z"/></defs><use href="#{id}d" transform="translate(19.5 18)"/><use href="#{id}d" transform="translate(34 29) scale(.52)"/>',
  },
  {
    name: 'bolt',
    note: 'Was fill+stroke stacked (muddy joins). Now a single filled, chunkier zigzag.',
    body: '<path d="M28 3 11 27h9l-4.5 18 21.5-26h-11.5l6.5-16z"/>',
  },
  {
    name: 'grass',
    note: 'Blades used to fan from one point (read as a sparkler). Now blades rise from a ground line with varied, natural curves.',
    body: '<g stroke="{c}" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M6 44h36"/><path d="M13 44c-1.5-8-.5-15 4.5-21"/><path d="M20 44c-.5-10 .5-19 4-27"/><path d="M28 44c.5-8 1.5-15 6-20"/><path d="M8 44c-1-5-.5-9 2-13"/><path d="M40 44c1-5 .5-9-2-13"/></g>',
  },
  {
    name: 'waves',
    note: 'The closed ribbon had awkward tails. Two clean stroked wave lines read better at 30px.',
    body: '<g stroke="{c}" stroke-width="4.6" stroke-linecap="round" fill="none"><path d="M5 17c4-4.5 8-4.5 12 0s8 4.5 12 0 8-4.5 12 0"/><path d="M5 30c4-4.5 8-4.5 12 0s8 4.5 12 0 8-4.5 12 0"/></g>',
  },
  {
    name: 'mushroom',
    note: 'Classic toadstool: three big cut-out dots on the cap make it instantly readable.',
    body: '<path d="M7.5 22c0-10 7.5-16 16.5-16s16.5 6 16.5 16c0 2.4-2 3.8-4.5 3.8H12c-2.5 0-4.5-1.4-4.5-3.8z"/><circle cx="15.5" cy="14.5" r="3.2" fill="var(--background)"/><circle cx="26.5" cy="11.5" r="3.6" fill="var(--background)"/><circle cx="33" cy="18.5" r="2.7" fill="var(--background)"/><path d="M18.5 25.8h11l-1.1 12.2c-.3 3.2-2 5.5-4.4 5.5s-4.1-2.3-4.4-5.5z"/>',
  },
  {
    name: 'wind-turbine',
    note: 'Three tapered blades fanning from the hub (classic turbine pose) over a tapered tower with a footing.',
    body: '<defs><path id="{id}b" d="M24 3.5c1.6 3 2.6 6.8 2.8 11-1.8.7-3.8.7-5.6 0 .2-4.2 1.2-8 2.8-11z"/></defs><g transform="rotate(-25 24 17)"><use href="#{id}b"/><use href="#{id}b" transform="rotate(120 24 17)"/><use href="#{id}b" transform="rotate(240 24 17)"/><circle cx="24" cy="17" r="2.5"/></g><path d="M23 19.5h2l1.5 21.5h-5z"/><ellipse cx="24" cy="43.5" rx="5.2" ry="2.2"/>',
  },
  {
    name: 'palm',
    note: 'Original frond geometry was right — mine detached. Fronds fattened ~1px and reattached to a straighter trunk.',
    body: '<path d="M22.4 44c1.2-8.5 1-16-1-22.5h5.8c-2 6.5-2.2 14-1 22.5z"/><path d="M24 21.5c-7.5-6.5-15.5-7.5-20.5-3.5 5.5 4.5 14.5 5.5 20.5 3.5z"/><path d="M24.6 21.5c7.5-6.5 15.5-7.5 20.5-3.5-5.5 4.5-14.5 5.5-20.5 3.5z"/><path d="M24 21c-5.5-5.5-10-11.5-10-17.5 6.5 4.5 10.5 10.5 10.5 17.5z"/><path d="M24.6 21c5.5-5.5 10-11.5 10-17.5-6.5 4.5-10.5 10.5-10.5 17.5z"/><path d="M24 20c-2.5-7-.5-13 4.5-17 2 6.5.5 13-4.5 17z"/>',
  },
  {
    name: 'tulip',
    note: 'Deeper petal notches, a visible stem and fatter leaves placed lower — a bolder tulip at 30px.',
    body: '<path d="M13.5 9.5c0 9.5 4.5 15.5 10.5 15.5s10.5-6 10.5-15.5c-2.8 3.8-6.2 4.8-7.3-1.2-1 3.3-2 4.3-3.2 4.3s-2.2-1-3.2-4.3c-1.1 6-4.5 5-7.3 1.2z"/><rect x="22.5" y="24.5" width="3" height="10" rx="1.5"/><path d="M24 34.5c-4 4-9.5 5-14.5 3 1.5 5.5 9.5 7.5 14.5 3.5z"/><path d="M24 34.5c4 4 9.5 5 14.5 3-1.5 5.5-9.5 7.5-14.5 3.5z"/>',
  },
  {
    name: 'flower',
    note: 'Six fat petals became five rounded ones — a classic bloom, clearly distinct from daisy (8 thin petals) and clover.',
    body: '<g><ellipse cx="24" cy="12.5" rx="5.6" ry="8.6" transform="rotate(0 24 23)"/><ellipse cx="24" cy="12.5" rx="5.6" ry="8.6" transform="rotate(72 24 23)"/><ellipse cx="24" cy="12.5" rx="5.6" ry="8.6" transform="rotate(144 24 23)"/><ellipse cx="24" cy="12.5" rx="5.6" ry="8.6" transform="rotate(216 24 23)"/><ellipse cx="24" cy="12.5" rx="5.6" ry="8.6" transform="rotate(288 24 23)"/><circle cx="24" cy="23" r="5.6"/></g>',
  },
  {
    name: 'bicycle',
    note: 'Thicker frame strokes (4), bigger wheels, simplified seat/handlebars so the silhouette survives 30px.',
    body: '<g fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="32.5" r="6.5"/><circle cx="37.5" cy="32.5" r="6.5"/><path d="M10.5 32.5 18 20.5h11l8 12M18 20.5l5.5 12h8"/><path d="M19 20.5v-3.5"/><path d="M16 17h6"/><path d="M29 20.5l3-6h4.5"/></g>',
  },
  {
    name: 'sun',
    note: 'Twelve thin triangle rays became eight chunky round-capped rays around a bigger disc.',
    body: '<g stroke="{c}" stroke-width="4.6" stroke-linecap="round"><path d="M24 3.2v5.6" transform="rotate(0 24 24)"/><path d="M24 3.2v5.6" transform="rotate(45 24 24)"/><path d="M24 3.2v5.6" transform="rotate(90 24 24)"/><path d="M24 3.2v5.6" transform="rotate(135 24 24)"/><path d="M24 3.2v5.6" transform="rotate(180 24 24)"/><path d="M24 3.2v5.6" transform="rotate(225 24 24)"/><path d="M24 3.2v5.6" transform="rotate(270 24 24)"/><path d="M24 3.2v5.6" transform="rotate(315 24 24)"/></g><circle cx="24" cy="24" r="10.5"/>',
  },
  {
    name: 'map-pin',
    note: 'Bigger hole, fatter body, smoother apex — the pin reads instantly.',
    body: '<path d="M24 4.5c-8.1 0-14.6 6.2-14.6 14.3 0 10 14.6 25.7 14.6 25.7s14.6-15.7 14.6-25.7C38.6 10.7 32.1 4.5 24 4.5z"/><circle cx="24" cy="18.5" r="6" fill="var(--background)"/>',
  },
  {
    name: 'planet',
    note: 'The ring now passes behind the planet on top and in front below — a proper Saturn instead of an ellipse crossing through.',
    body: '<g transform="rotate(-18 24 24)"><path d="M6.5 24a17.5 6 0 0 1 35 0" fill="none" stroke="{c}" stroke-width="3.6" stroke-linecap="round"/><circle cx="24" cy="24" r="10.2"/><path d="M6.5 24a17.5 6 0 0 0 35 0" fill="none" stroke="{c}" stroke-width="3.6" stroke-linecap="round"/></g>',
  },
  {
    name: 'cloud',
    note: 'Rebuilt as a union of puffs with a flat rounded base — the classic cloud silhouette instead of a lumpy blob.',
    body: '<circle cx="13.5" cy="28" r="8"/><circle cx="24" cy="20" r="10"/><circle cx="34.5" cy="28" r="8"/><path d="M11 27h26v7a5 5 0 0 1-5 5H16a5 5 0 0 1-5-5z"/>',
  },
  {
    name: 'tree',
    note: 'Stacked ellipse tiers became one rounded canopy over a flared trunk — clearly a tree, and clearly not the pine.',
    body: '<circle cx="15.5" cy="21" r="8.2"/><circle cx="32.5" cy="21" r="8.2"/><circle cx="24" cy="13.5" r="9"/><circle cx="24" cy="25" r="9.2"/><path d="M21.6 31h4.8l1.6 13h-8z"/>',
  },
  {
    name: 'flower-blob',
    note: 'Six overlapping circles merged into mush. Now six touching petals around an open centre — a "flower of life" ring.',
    body: '<g><circle cx="24" cy="13" r="6" transform="rotate(0 24 24)"/><circle cx="24" cy="13" r="6" transform="rotate(60 24 24)"/><circle cx="24" cy="13" r="6" transform="rotate(120 24 24)"/><circle cx="24" cy="13" r="6" transform="rotate(180 24 24)"/><circle cx="24" cy="13" r="6" transform="rotate(240 24 24)"/><circle cx="24" cy="13" r="6" transform="rotate(300 24 24)"/></g>',
  },
  {
    name: 'bird',
    note: 'The swallow\u2019s complex curves blurred at 30px. Round body, a raised head with a proper beak, tail and cut-out wing.',
    body: '<path d="M10.5 27 3 19.5l1.6 7.5L3 34.5z"/><ellipse cx="21.5" cy="29" rx="13" ry="13.5"/><circle cx="31.5" cy="15.5" r="7.2"/><path d="M38 12.5 44.5 15.5l-6.5 3z"/><path d="M13.5 29.5c3-6 8-9 13.5-8-2.5 5-8 8.5-13.5 8z" fill="var(--background)"/><circle cx="33.5" cy="13.5" r="1.7" fill="var(--background)"/>',
  },
  {
    name: 'vase',
    note: 'A proper amphora: a rim on top, an S-curve body and a flared foot, so it reads as a vessel.',
    body: '<rect x="15.5" y="3.5" width="17" height="4.5" rx="2.25"/><path d="M19 8c1 2.5.8 4.5-.8 6.5C13 18.5 11 25 13.5 31.5 16 38 19.5 41.5 24 41.5s8-3.5 10.5-10C37 25 35 18.5 29.8 14.5c-1.6-2-1.8-4-.8-6.5z"/><path d="M16.5 42h15l1.8 3H14.7z"/>',
  },
  {
    name: 'whale',
    note: 'Same silhouette idea as the original (tail left, eye right) but rounder and fatter so it fills the slot.',
    body: '<path d="M40 26.5c0-7.8-6.4-13.5-15.5-13.5-7 0-12.9 3.7-14.8 9.2l-6.2-1.2 3.4 5.4-3.6 4.8 6.1-.4C11.2 37.3 17.3 42 23.8 42 33.3 42 40 36 40 26.5z"/><circle cx="31" cy="21.5" r="2" fill="var(--background)"/>',
  },
  {
    name: 'seeds',
    note: 'Ground line under a fat sprouting seed — the first pass read as a music note.',
    body: '<path d="M7 44h34" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/><ellipse cx="24" cy="36.5" rx="6.8" ry="4.8"/><path d="M24 32V18.5" fill="none" stroke="{c}" stroke-width="3.8" stroke-linecap="round"/><path d="M22.6 19.5c-5.4-1.2-8.6-4.6-9.2-10 5.4 1.2 8.6 4.6 9.2 10z"/><path d="M25.4 19.5c5.4-1.2 8.6-4.6 9.2-10-5.4 1.2-8.6 4.6-9.2 10z"/>',
  },
  {
    name: 'pawn',
    note: 'Added a collar and a wide base so it finally reads as chess, not a lollipop.',
    body: '<circle cx="24" cy="12.5" r="6.8"/><rect x="16.5" y="19.8" width="15" height="4.2" rx="2.1"/><path d="M24 23.5c5.8 0 9.2 4.8 8.6 10.5-.4 3.8-2.2 6.8-4.8 8.4H20.2c-2.6-1.6-4.4-4.6-4.8-8.4-.6-5.7 2.8-10.5 8.6-10.5z"/><path d="M15 41.5h18l2 3.5H13z"/>',
  },
  {
    name: 'bulb',
    note: 'The lightning cut-out became a proper filament, and the base has clean separated bands.',
    body: '<path d="M24 6.5a12.6 12.6 0 0 1 7.6 22.7v4.3H16.4v-4.3A12.6 12.6 0 0 1 24 6.5z"/><path d="M20.6 31v-5.6c0-2.3 1.5-3.7 3.4-3.7s3.4 1.4 3.4 3.7V31" fill="none" stroke="var(--background)" stroke-width="2.7" stroke-linecap="round"/><rect x="18.5" y="33.8" width="11" height="3.2" rx="1.6"/><rect x="19.8" y="38.4" width="8.4" height="3.2" rx="1.6"/>',
  },
  {
    name: 'daisy',
    note: 'Wider petals with rounder tips; same construction, bolder read.',
    body: '<g><ellipse cx="24" cy="11.5" rx="3.4" ry="9" transform="rotate(0 24 22)"/><ellipse cx="24" cy="11.5" rx="3.4" ry="9" transform="rotate(45 24 22)"/><ellipse cx="24" cy="11.5" rx="3.4" ry="9" transform="rotate(90 24 22)"/><ellipse cx="24" cy="11.5" rx="3.4" ry="9" transform="rotate(135 24 22)"/><ellipse cx="24" cy="11.5" rx="3.4" ry="9" transform="rotate(180 24 22)"/><ellipse cx="24" cy="11.5" rx="3.4" ry="9" transform="rotate(225 24 22)"/><ellipse cx="24" cy="11.5" rx="3.4" ry="9" transform="rotate(270 24 22)"/><ellipse cx="24" cy="11.5" rx="3.4" ry="9" transform="rotate(315 24 22)"/><circle cx="24" cy="22" r="5.4"/></g>',
  },
  {
    name: 'sprout',
    note: 'Bigger leaves and a thicker stem — the sprout finally fills the slot.',
    body: '<path d="M24 43.5V25" fill="none" stroke="{c}" stroke-width="5" stroke-linecap="round"/><path d="M22.8 27.5C14.8 27.5 9.5 23 8.5 15c8 0 13.3 4.5 14.3 12.5z"/><path d="M25.2 27.5c8 0 13.3-4.5 14.3-12.5-8 0-13.3 4.5-14.3 12.5z"/>',
  },
  {
    name: 'sparkle',
    note: 'Added a small companion sparkle so it reads "sparkle" rather than a lone 4-point star.',
    body: '<path d="M24 3c2 12 7 17 20 21-13 4-18 9-20 21-2-12-7-17-20-21 13-4 18-9 20-21z"/><path d="M39.5 4.5c.7 4 2.3 5.8 5 6.5-2.7.7-4.3 2.5-5 6.5-.7-4-2.3-5.8-5-6.5 2.7-.7 4.3-2.5 5-6.5z"/>',
  },
  {
    name: 'teddy',
    note: 'Fatter attached ears with inner-ear cut-outs, plus little arms — unmistakably a teddy.',
    body: '<g><circle cx="13.5" cy="9.5" r="5.2"/><circle cx="34.5" cy="9.5" r="5.2"/><circle cx="24" cy="17" r="9.5"/><path d="M24 25c7.2 0 11 5.2 10.6 12.2-.4 6.8-4.4 10.8-10.6 10.8s-10.2-4-10.6-10.8C13 30.2 16.8 25 24 25z"/><circle cx="11.5" cy="27.5" r="4.8"/><circle cx="36.5" cy="27.5" r="4.8"/></g><circle cx="13.5" cy="9.5" r="2.1" fill="var(--background)"/><circle cx="34.5" cy="9.5" r="2.1" fill="var(--background)"/>',
  },
  {
    name: 'apple',
    note: 'Deeper top notch between the lobes, a curved stem and a fatter leaf.',
    body: '<path d="M24 14.5c-1.6-2.6-5.6-3.6-8.6-1.4-4.4 3.2-5 9.8-2.4 15.6 2.4 5.4 6.5 10.4 11 12.1 4.5-1.7 8.6-6.7 11-12.1 2.6-5.8 2-12.4-2.4-15.6-3-2.2-7-1.2-8.6 1.4z"/><path d="M24 13c.2-3 1.4-5.2 3.4-7" fill="none" stroke="{c}" stroke-width="3.2" stroke-linecap="round"/><path d="M26.5 6.8c2.8-4.2 7.6-5.6 11-3.6-1.4 4.4-6.4 6.6-11 3.6z"/>',
  },
  {
    name: 'recycle',
    note: 'Thicker arrows (4.4) with bigger heads — the triangle survives 30px.',
    body: '<defs><g id="{id}r"><path d="M13.5 21.5A11 11 0 0 1 24 14.2" fill="none" stroke="{c}" stroke-width="4.4" stroke-linecap="round"/><path d="M21.5 9.2 30 14.5l-8.6 5.4z"/></g></defs><use href="#{id}r"/><use href="#{id}r" transform="rotate(120 24 25)"/><use href="#{id}r" transform="rotate(240 24 25)"/>',
  },
  {
    name: 'heart',
    note: 'Rounder lobes and a slightly rounder tip; marginally bigger overall.',
    body: '<path d="M24 42.8C10.8 33.6 4.2 25.6 4.2 17 4.2 9.7 9.7 4.2 16.9 4.2c3.4 0 6.5 1.6 7.1 4.4.6-2.8 3.7-4.4 7.1-4.4 7.2 0 12.7 5.5 12.7 12.8 0 8.6-6.6 16.6-19.8 25.8z"/>',
  },
  {
    name: 'drop',
    note: 'Added a cut-out shine so the flat drop has some depth.',
    body: '<path d="M24 4C24 4 10.5 20.8 10.5 29.8 10.5 37.6 16.6 44 24 44s13.5-6.4 13.5-14.2C37.5 20.8 24 4 24 4z"/><path d="M15.6 27.5c-1 4.6.8 8.8 4.6 11-3.9-1.2-6.6-5.6-4.6-11z" fill="var(--background)"/>',
  },
  {
    name: 'house',
    note: 'Wider roof, plus a round attic window so the blank gable is not dead space.',
    body: '<path d="M24 4.5 4.5 22.5V40c0 1.7 1.3 3 3 3h33c1.7 0 3-1.3 3-3V22.5z"/><path d="M17.5 43v-8.5a6.5 6.5 0 0 1 13 0V43z" fill="var(--background)"/><circle cx="24" cy="14.5" r="2.9" fill="var(--background)"/>',
  },
  {
    name: 'scissors',
    note: 'Thicker blades that actually cross, and the pivot dot sits at the crossing point.',
    body: '<g fill="none" stroke="{c}" stroke-width="4.2" stroke-linecap="round"><circle cx="14" cy="38" r="4.8"/><circle cx="34" cy="38" r="4.8"/><path d="M16.2 34.2 30 7M31.8 34.2 18 7"/></g><circle cx="24" cy="17.5" r="2.5"/>',
  },
  {
    name: 'magnifier',
    note: 'Thicker ring and handle plus a cut-out glare arc inside the lens.',
    body: '<circle cx="20" cy="19" r="11.2" fill="none" stroke="{c}" stroke-width="5.4"/><path d="M28.3 27.3 40 39" stroke="{c}" stroke-width="6.6" stroke-linecap="round"/><path d="M14.5 13.5c-2 2-3 4.5-3 7" fill="none" stroke="var(--background)" stroke-width="2.6" stroke-linecap="round"/>',
  },
  {
    name: 'clover',
    note: 'Cut-out seams divide the four leaves, so it reads as a clover rather than a blob of circles.',
    body: '<g><circle cx="24" cy="15.6" r="7"/><circle cx="30.9" cy="24" r="7"/><circle cx="24" cy="32.4" r="7"/><circle cx="17.1" cy="24" r="7"/></g><g stroke="var(--background)" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M20.4 20.4 27.6 27.6M27.6 20.4 20.4 27.6"/></g><path d="M26 33.5c1.5 4 4 7 8 8.5" fill="none" stroke="{c}" stroke-width="3.2" stroke-linecap="round"/>',
  },
  {
    name: 'moon',
    note: 'Fatter crescent plus a tiny star companion fills the empty corner.',
    body: '<path d="M31 4a20 20 0 1 0 0 40 26 26 0 0 1 0-40z"/><path d="M38.5 9c.6 3.4 2 4.9 4.3 5.5-2.3.6-3.7 2.1-4.3 5.5-.6-3.4-2-4.9-4.3-5.5 2.3-.6 3.7-2.1 4.3-5.5z"/>',
  },
  {
    name: 'robot',
    note: 'Rounder head, bigger antenna and a mouth cut-out; legs kept — reads like a wind-up toy.',
    body: '<g><rect x="11" y="14" width="26" height="19.5" rx="7"/><rect x="6.3" y="19.5" width="4.4" height="8" rx="2.2"/><rect x="37.3" y="19.5" width="4.4" height="8" rx="2.2"/><rect x="16" y="33.5" width="5.2" height="5.5" rx="1.8"/><rect x="26.8" y="33.5" width="5.2" height="5.5" rx="1.8"/><path d="M24 14V9.8" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="7" r="2.9"/></g><circle cx="18.6" cy="23" r="2.9" fill="var(--background)"/><circle cx="29.4" cy="23" r="2.9" fill="var(--background)"/><rect x="20.4" y="28.4" width="7.2" height="2.6" rx="1.3" fill="var(--background)"/>',
  },
  {
    name: 'flag',
    note: 'Chunkier pole and a taller, fatter waving flag.',
    body: '<path d="M14 4.5v39" fill="none" stroke="{c}" stroke-width="4.5" stroke-linecap="round"/><path d="M17 7.5c6.2-3.2 12 2.8 18-.3v18.6c-6 3.1-11.8-2.9-18 .3z"/>',
  },
  {
    name: 'star',
    note: 'Was a thin outline; now a filled, chunky five-point star — clearly bolder than sparkle at 30px.',
    body: '<polygon points="24,5 30.2,15.5 42.1,18.1 34,27.2 35.2,39.4 24,34.5 12.8,39.4 14,27.2 5.9,18.1 17.8,15.5"/>',
  },
  {
    name: 'rainbow',
    note: 'Added cloud puffs at both ends — it finally reads as a rainbow rather than three floating arcs.',
    body: '<g fill="none" stroke="{c}" stroke-width="4.4" stroke-linecap="round"><path d="M8.5 39a15.8 15.8 0 0 1 31 0"/><path d="M15.2 39a9.3 9.3 0 0 1 17.6 0"/><path d="M22.5 39a3.4 3.4 0 0 1 3 0"/></g><circle cx="9" cy="38" r="5"/><circle cx="39.5" cy="38" r="5"/>',
  },
  {
    name: 'spiral',
    note: 'A smoother, more even spiral — the original kinked where the arcs met.',
    body: '<path d="M27.5 24.5c-.3 3.3-3.8 5-6.6 3.4-3.4-2-3.3-7.6.7-10.4 4.8-3.4 12-.9 13.2 5.3 1.4 7.3-5.3 13.6-12.7 12.6-8.6-1.2-13-10.6-9.3-18.2C16.5 9 24.9 5.5 32 8.5" fill="none" stroke="{c}" stroke-width="4.6" stroke-linecap="round"/>',
  },
  {
    name: 'coral',
    note: 'Rebuilt as a union of five tapered capsules — chunky antler-coral instead of wiggly spaghetti.',
    body: '<rect x="20.5" y="9" width="7" height="35" rx="3.5"/><rect x="12.5" y="13" width="6.6" height="21" rx="3.3" transform="rotate(-27 15.8 23.5)"/><rect x="28.9" y="13" width="6.6" height="21" rx="3.3" transform="rotate(27 32.2 23.5)"/><rect x="6.5" y="18" width="6" height="12" rx="3" transform="rotate(-48 9.5 24)"/><rect x="35.5" y="18" width="6" height="12" rx="3" transform="rotate(48 38.5 24)"/>',
  },
  {
    name: 'pine',
    note: 'Zigzag steps became smooth curved brims, on a proper trunk.',
    body: '<path d="M24 3.5c2.6 4.2 6.2 7.6 10.5 10-2.6.4-5 1.5-7 3.1 3.4 1.7 6.3 4 8.5 6.8-2.8.1-5.4 1-7.6 2.6 3.4 2.2 6.2 5 8 8.3-4.2-1.6-8.4-2.3-12.4-2.3s-8.2.7-12.4 2.3c1.8-3.3 4.6-6.1 8-8.3-2.2-1.6-4.8-2.5-7.6-2.6 2.2-2.8 5.1-5.1 8.5-6.8-2-1.6-4.4-2.7-7-3.1 4.3-2.4 7.9-5.8 10.5-10z"/><rect x="21.8" y="36.5" width="4.4" height="8" rx="1.6"/>',
  },
  {
    name: 'electric-car',
    note: 'Simpler hatchback silhouette with cut-out wheels and a bigger bolt cut-out.',
    body: '<path d="M6 34v-4.6c0-3 2-5.6 4.9-6.1l3.1-7.4c.9-2.2 3-3.4 5.4-3.4h9.2c2.4 0 4.5 1.2 5.4 3.4l3.1 7.4c2.9.5 4.9 3.1 4.9 6.1V34h-4.9a6.1 6.1 0 0 1-12.2 0h-4a6.1 6.1 0 0 1-12.2 0z"/><circle cx="14.7" cy="34" r="3.6" fill="var(--background)"/><circle cx="31" cy="34" r="3.6" fill="var(--background)"/><path d="M23.5 14.6l-7.4 11.4h4.3l-2.2 9.4 7.9-12.2h-4.4z" fill="var(--background)"/>',
  },
  {
    name: 'squiggle',
    note: 'A proper loopy scribble (cursive "ee") instead of the original\u2019s tight curl.',
    body: '<path d="M6 33c-2-7 2.5-13 9-13 5 0 7.5 3.5 5.8 6.7-1.5 2.8-6 2.6-6.6-.4-.7-3.5 3-6.3 8.3-6.3 7.6 0 13.5 4.6 14.5 11.5.4 2.7-.2 5-1.5 6.8" fill="none" stroke="{c}" stroke-width="4.4" stroke-linecap="round"/>',
  },
  {
    name: 'globe',
    note: 'Bigger sphere with a meridian AND an equator cut-out, on a curved stand — reads as a desk globe.',
    body: '<circle cx="24" cy="19.5" r="12.5"/><ellipse cx="24" cy="19.5" rx="5.2" ry="12.5" fill="none" stroke="var(--background)" stroke-width="2.3"/><path d="M11.6 19.5c4-2.2 16.8-2.2 24.8 0" fill="none" stroke="var(--background)" stroke-width="2.3" stroke-linecap="round"/><path d="M24 32v5.5" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/><path d="M13.5 43.5c2.5-4.5 6.2-6.5 10.5-6.5s8 2 10.5 6.5z"/>',
  },
  {
    name: 'paintbrush',
    note: 'Longer handle, crisper ferrule, fatter bristles with a pointed tip.',
    body: '<g transform="rotate(45 24 24)"><rect x="21.4" y="3" width="5.2" height="16.5" rx="2.6"/><rect x="19" y="19.5" width="10" height="5.5" rx="1.6"/><path d="M19.5 25h9l-1 8.5c-.3 3-1.7 5-3.5 5s-3.2-2-3.5-5z"/></g>',
  },
  {
    name: 'pyramid',
    note: 'Two-tone faces (left side is a cut-out) so it reads 3D, plus a small sun.',
    body: '<path d="M24 7 43 41H5z"/><path d="M24 7 15.8 41H5z" fill="var(--background)"/><circle cx="38" cy="10" r="4.2"/>',
  },
  {
    name: 'battery',
    note: 'The random 38° tilt read as a mistake. Upright with a slight lean, bigger bolt cut-out.',
    body: '<g transform="rotate(-8 24 24)"><rect x="20.5" y="3.5" width="7" height="4.2" rx="2.1"/><rect x="14" y="7.7" width="20" height="34" rx="5"/><path d="M24.8 13.5 17.8 26h4.3l-2.3 10.5 8.6-13.5h-4.5z" fill="var(--background)"/></g>',
  },
  {
    name: 'tulip-2',
    note: 'Was a second, muddier front-view tulip. Now a closed tulip bud — a different flower shape instead of a duplicate.',
    body: '<path d="M24 7.5c4.2 3.6 6.8 8.8 6.8 13.8 0 6.2-3 10-6.8 10s-6.8-3.8-6.8-10c0-5 2.6-10.2 6.8-13.8z"/><path d="M24 12.5v17" fill="none" stroke="var(--background)" stroke-width="2.2" stroke-linecap="round"/><path d="M22.8 30h2.4l.8 13h-4z"/><path d="M24 36c-4-3.5-9-4.5-13.5-2.5 2 4.5 8 6.5 13.5 2.5z"/><path d="M24 36c4-3.5 9-4.5 13.5-2.5-2 4.5-8 6.5-13.5 2.5z"/>',
  },
  {
    name: 'potted-flower',
    note: 'The vague head became a five-petal bloom, and the pot got a rim.',
    body: '<g><circle cx="24" cy="6" r="3" transform="rotate(0 24 10.5)"/><circle cx="24" cy="6" r="3" transform="rotate(72 24 10.5)"/><circle cx="24" cy="6" r="3" transform="rotate(144 24 10.5)"/><circle cx="24" cy="6" r="3" transform="rotate(216 24 10.5)"/><circle cx="24" cy="6" r="3" transform="rotate(288 24 10.5)"/><circle cx="24" cy="10.5" r="3.4"/></g><rect x="22.8" y="14" width="2.4" height="11" rx="1.2"/><rect x="13.5" y="24" width="21" height="4.6" rx="2.3"/><path d="M15.5 28.6h17L30.2 41c-.3 1.5-1.4 2.3-3 2.3h-6.4c-1.6 0-2.7-.8-3-2.3z"/>',
  },
];
