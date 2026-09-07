/**
 * Glyph candidates. Round 1 keepers (snowflake, mug) stay; the rest are a quirky
 * second batch to replace skipped originals. Same 48-box contract as glyphs.ts.
 */
export type CandidateGlyph = { name: string; body: string; note: string };

export const CANDIDATES: CandidateGlyph[] = [
  {
    name: 'snowflake',
    note: 'Round 1 keep. Six round-capped arms with barbs.',
    body: '<defs><g id="{id}s"><path d="M24 4.5v39"/><path d="M19.8 8.8 24 13l4.2-4.2"/><path d="M19.8 39.2 24 35l4.2 4.2"/></g></defs><g stroke="{c}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" fill="none"><use href="#{id}s"/><use href="#{id}s" transform="rotate(60 24 24)"/><use href="#{id}s" transform="rotate(120 24 24)"/></g>',
  },
  {
    name: 'mug',
    note: 'Round 1 keep. Steam and a chunky handle.',
    body: '<path d="M11 17.5h20.5v16c0 4.4-3 7.5-7.5 7.5h-5.5c-4.5 0-7.5-3.1-7.5-7.5z"/><path d="M31.5 21.5h3c4.1 0 7.2 2.9 7.2 7s-3.1 7-7.2 7h-3" fill="none" stroke="{c}" stroke-width="4.4"/><path d="M17.5 4.5c-1.9 2.4-1.9 5.1 0 7.5M25.5 4.5c-1.9 2.4-1.9 5.1 0 7.5" fill="none" stroke="{c}" stroke-width="3.4" stroke-linecap="round"/>',
  },
  {
    name: 'cactus',
    note: 'Saguaro with two arms — desert cousin of palm and pine.',
    body: '<path d="M21 44V14a5 5 0 0 1 10 0v30z"/><path d="M21 29H14V18a3.5 3.5 0 0 0 7 0v11z"/><path d="M31 33h7V21a3.5 3.5 0 0 0 7 0v12H31z"/>',
  },
  {
    name: 'snail',
    note: 'Shell plus two eyestalks. Very snail.',
    body: '<ellipse cx="17" cy="36" rx="11" ry="6.5"/><circle cx="31" cy="23" r="11"/><path d="M31 23c-1.2 5-5 8.2-9.2 8.2" fill="none" stroke="var(--background)" stroke-width="2.5" stroke-linecap="round"/><path d="M14 32c-3.2-8-2-14.5 2-16.5" fill="none" stroke="{c}" stroke-width="3.5" stroke-linecap="round"/><circle cx="16.5" cy="14.8" r="2.5"/><path d="M20.5 32c.2-6.5 3-11.5 7-13" fill="none" stroke="{c}" stroke-width="3.5" stroke-linecap="round"/><circle cx="28" cy="18" r="2.5"/>',
  },
  {
    name: 'jellyfish',
    note: 'Dome and five wobbly tentacles.',
    body: '<path d="M10 22c0-9 6.2-14.5 14-14.5S38 13 38 22c0 3.2-2.2 5-5.5 5H15.5c-3.3 0-5.5-1.8-5.5-5z"/><g fill="none" stroke="{c}" stroke-width="3.2" stroke-linecap="round"><path d="M14 27c-1.2 6-3.2 12-1.2 17"/><path d="M19 27c.4 6-1.2 13 .8 17"/><path d="M24 27c0 7 .2 14 .2 17"/><path d="M29 27c-.4 6 1.2 13-.8 17"/><path d="M34 27c1.2 6 3.2 12 1.2 17"/></g>',
  },
  {
    name: 'teapot',
    note: 'Spout, handle, lid knob — a cousin of mug and vase.',
    body: '<ellipse cx="24" cy="28" rx="13" ry="11"/><path d="M36 24c7-1.2 11.2 3 10 9.2-3.6-2-7.2-2.2-11.2-1.2z"/><path d="M11.5 24c-5.5 0-8 4-8 8s2.5 8 8 8" fill="none" stroke="{c}" stroke-width="3.6" stroke-linecap="round"/><rect x="16" y="15.5" width="16" height="5" rx="2.5"/><circle cx="24" cy="13.5" r="2.6"/>',
  },
  {
    name: 'doughnut',
    note: 'A ring with a proper hole. Breakfast.',
    body: '<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="5.8" fill="var(--background)"/>',
  },
  {
    name: 'banana',
    note: 'A fat crescent banana with a stem nub.',
    body: '<path d="M7 32c2-12 12-24 26-26 3.5-.5 6 2 6 5.5 0 2-1.2 3.5-3 4.2C24 19 16 26 12 34c-1 2-3.2 2.5-5 1.2-1.2-.9-1.2-2.2 0-3.2z"/><path d="M36 11c2-1.2 4.6-.6 6 1.6" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/>',
  },
  {
    name: 'chili',
    note: 'Curved pepper with a stem. A little mean.',
    body: '<path d="M22 12c6.5 1 14 8 16 18 1.5 7.2-2.2 12-9.2 12-9 0-16-10-18.2-20C9.4 14.5 16 10 22 12z"/><path d="M24 11c1-4 3.6-7.2 7.6-8.2" fill="none" stroke="{c}" stroke-width="3.2" stroke-linecap="round"/>',
  },
  {
    name: 'strawberry',
    note: 'Heart-berry with three seed cut-outs and a leafy cap.',
    body: '<path d="M24 16c9 3 14 11 14 18 0 6-6.2 10-14 10S10 40 10 34c0-7 5-15 14-18z"/><path d="M18 14c-1-5 2-9 6-10 4 1 7 5 6 10-2-2-4-3-6-3s-4 1-6 3z"/><ellipse cx="18" cy="28" rx="1.6" ry="2.2" transform="rotate(-20 18 28)" fill="var(--background)"/><ellipse cx="26" cy="24" rx="1.5" ry="2.1" transform="rotate(15 26 24)" fill="var(--background)"/><ellipse cx="30" cy="32" rx="1.5" ry="2" transform="rotate(-10 30 32)" fill="var(--background)"/>',
  },
  {
    name: 'carrot',
    note: 'Tapered root with a three-leaf tuft.',
    body: '<path d="M24 10c3.2 8 6.5 18 7.5 26.5-1.6 3.2-4.2 4.5-7.5 4.5s-5.9-1.3-7.5-4.5C17.5 28 20.8 18 24 10z"/><path d="M24 10c-3-5-7-7-10-6 2 4 5 6 10 6z"/><path d="M24 10c3-5 7-7 10-6-2 4-5 6-10 6z"/><path d="M24 10c-1-6 1-9 4-10-1 4-2 7-4 10z"/>',
  },
  {
    name: 'seashell',
    note: 'Scallop fan with ridge cut-outs — beach cousin of coral.',
    body: '<path d="M24 42c-13-5-17-18-8-32 7 7 17 7 24 0 9 14 5 27-8 32z"/><path d="M24 42 16 16M24 42 24 14M24 42 32 16" fill="none" stroke="var(--background)" stroke-width="2.2" stroke-linecap="round"/>',
  },
  {
    name: 'kite',
    note: 'Diamond on a string with two tail bows.',
    body: '<polygon points="24,5 40,22 24,32 8,22"/><path d="M24 32c1.6 3.6.2 7.2 3.2 11.2" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/><polygon points="26.5,36 30,33.5 31.2,38"/><polygon points="28.5,41.5 32,39 33.2,43.5"/>',
  },
  {
    name: 'pretzel',
    note: 'A knotted loop. Cousin of squiggle, but it\'s a snack.',
    body: '<path d="M10 22c-2-10 8-14 14-6 6-8 16-4 14 6 4 10-10 16-14 10-4 6-18 0-14-10z" fill="none" stroke="{c}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    name: 'ice-cream',
    note: 'One scoop on a cone.',
    body: '<circle cx="24" cy="16" r="10.5"/><path d="M15 23 24 44 33 23z"/>',
  },
  {
    name: 'crab',
    note: 'From above: oval, two claws, four legs, two eye dots.',
    body: '<ellipse cx="24" cy="28" rx="10" ry="7.5"/><path d="M11 24 4 16l3 8-2 7 8-3z"/><path d="M37 24 44 16l-3 8 2 7-8-3z"/><path d="M14 34c-3 3-4 6-3 8M18 36c-2 3-2.5 6-1 8M30 36c2 3 2.5 6 1 8M34 34c3 3 4 6 3 8" fill="none" stroke="{c}" stroke-width="2.8" stroke-linecap="round"/><circle cx="20" cy="26.5" r="1.7" fill="var(--background)"/><circle cx="28" cy="26.5" r="1.7" fill="var(--background)"/>',
  },
  {
    name: 'balloon',
    note: 'Round balloon, knot, curly string.',
    body: '<ellipse cx="24" cy="20" rx="11" ry="13"/><path d="M24 33l-3 3.2 3 2 3-2z"/><path d="M24 38.2c-2.6 4 2.2 8 .2 10.2" fill="none" stroke="{c}" stroke-width="2.8" stroke-linecap="round"/>',
  },
  {
    name: 'moth',
    note: 'Two big wings and a fat body. Night cousin of bird (which you skipped).',
    body: '<ellipse cx="13" cy="22" rx="10" ry="13" transform="rotate(-28 13 22)"/><ellipse cx="35" cy="22" rx="10" ry="13" transform="rotate(28 35 22)"/><ellipse cx="24" cy="24" rx="3.6" ry="11"/><circle cx="24" cy="12" r="3"/>',
  },
  {
    name: 'toast',
    note: 'A slice with a bite taken out of the corner.',
    body: '<rect x="8" y="12" width="30" height="26" rx="5"/><circle cx="38" cy="14" r="7" fill="var(--background)"/>',
  },
  {
    name: 'octopus',
    note: 'Round head, four tentacles, two eye cut-outs.',
    body: '<circle cx="24" cy="16" r="9.2"/><path d="M16 22c-2 6-6 10-8 16 4-2 8-2 11 1 0-6 1-11 5-17z"/><path d="M32 22c2 6 6 10 8 16-4-2-8-2-11 1 0-6-1-11-5-17z"/><path d="M20 24c-1 7 0 13-2 18M28 24c1 7 0 13 2 18" fill="none" stroke="{c}" stroke-width="3.2" stroke-linecap="round"/><circle cx="20.5" cy="14.5" r="2" fill="var(--background)"/><circle cx="27.5" cy="14.5" r="2" fill="var(--background)"/>',
  },
  {
    name: 'ghost',
    note: 'Wavy hem and two eye cut-outs. A blob with opinions.',
    body: '<path d="M9 20c0-9 6.5-14.5 15-14.5S39 11 39 20c0 5-2.5 9-7 11v2c1.5 1 2 3 1 5h-4c-1 2-3 2-4 0h-4c-1 2-3 2-4 0h-4c-1-2-.5-4 1-5v-2c-4.5-2-7-6-7-11z"/><circle cx="18" cy="18" r="2.8" fill="var(--background)"/><circle cx="30" cy="18" r="2.8" fill="var(--background)"/>',
  },
  {
    name: 'frog',
    note: 'Round body, two eye bumps. Reads at 30px.',
    body: '<ellipse cx="24" cy="30" rx="14" ry="11"/><circle cx="16.5" cy="16.5" r="6"/><circle cx="31.5" cy="16.5" r="6"/><circle cx="16.5" cy="16" r="2.3" fill="var(--background)"/><circle cx="31.5" cy="16" r="2.3" fill="var(--background)"/>',
  },
  {
    name: 'avocado',
    note: 'Half an avocado with a pit cut-out.',
    body: '<path d="M24 4.5c4.5 0 7.5 2.5 9 6.5 2 5 4.5 11 4.5 16 0 9.5-6 16.5-13.5 16.5S10.5 36.5 10.5 27c0-5 2.5-11 4.5-16 1.5-4 4.5-6.5 9-6.5z"/><circle cx="24" cy="27" r="6" fill="var(--background)"/>',
  },
  {
    name: 'pineapple',
    note: 'Spiky crown, round body, cut-out ridges.',
    body: '<ellipse cx="24" cy="31" rx="10.5" ry="12.5"/><path d="M24 19c-2-5-5-8-9-9 2 5 5 8 9 9z"/><path d="M24 19c2-5 5-8 9-9-2 5-5 8-9 9z"/><path d="M24 18.5c-1-5.5 0-10 3-13.5.5 5-.5 9.5-3 13.5z"/><path d="M24 18.5c1-5.5 0-10-3-13.5-.5 5 .5 9.5 3 13.5z"/><path d="M16 24c5 2 11 2 16 0M15 30c6 2.5 12 2.5 18 0M15 36c6 2.5 12 2.5 18 0" fill="none" stroke="var(--background)" stroke-width="2" stroke-linecap="round"/>',
  },
  {
    name: 'cherry',
    note: 'Two cherries, joined stems, one leaf.',
    body: '<circle cx="16.5" cy="34" r="7"/><circle cx="31.5" cy="36" r="7"/><path d="M16.5 27C17 20 19 14 24 10M31.5 29c-1-8-3-14-7.5-19" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"/><path d="M24 10c3-2.5 7-3 10-1-2 3-6 4-10 1z"/>',
  },
  {
    name: 'pumpkin',
    note: 'Ribbed pumpkin with a chunky stem.',
    body: '<ellipse cx="24" cy="28" rx="14.5" ry="12"/><path d="M17 17.5c-3.5 6-3.5 15 0 21M31 17.5c3.5 6 3.5 15 0 21" fill="none" stroke="var(--background)" stroke-width="2.4" stroke-linecap="round"/><path d="M22.5 11c0-3.5 1-6 3-7.5.6 2.5.3 5-.8 7.5z"/>',
  },
  {
    name: 'watermelon',
    note: 'Slice with a rind band and three seed cut-outs.',
    body: '<path d="M6 19a18 18 0 0 0 36 0z"/><path d="M8.5 19a15.5 15.5 0 0 0 31 0" fill="none" stroke="var(--background)" stroke-width="2.6"/><circle cx="18" cy="25" r="1.6" fill="var(--background)"/><circle cx="24" cy="29" r="1.7" fill="var(--background)"/><circle cx="30" cy="25" r="1.6" fill="var(--background)"/>',
  },
  {
    name: 'turtle',
    note: 'Dome shell with cut-out seams, head poking right, three feet.',
    body: '<path d="M10 30c0-9 6.3-15 14-15s14 6 14 15z"/><path d="M24 15v15M17 16l-2 14M31 16l2 14" fill="none" stroke="var(--background)" stroke-width="2.2" stroke-linecap="round"/><circle cx="40" cy="27" r="4.5"/><rect x="12" y="30" width="5" height="6" rx="2.5"/><rect x="24" y="30" width="5" height="6" rx="2.5"/><rect x="31" y="30" width="5" height="6" rx="2.5"/>',
  },
  {
    name: 'owl',
    note: 'Ear tufts, cut-out eyes with pupils, beak.',
    body: '<path d="M24 6c9 0 15 6.5 15 16v10c0 6-6 11-15 11S9 38 9 32V22C9 12.5 15 6 24 6z"/><path d="M11 12 9 4l8 4z"/><path d="M37 12 39 4l-8 4z"/><circle cx="18" cy="20" r="4.6" fill="var(--background)"/><circle cx="30" cy="20" r="4.6" fill="var(--background)"/><circle cx="18" cy="20" r="1.8"/><circle cx="30" cy="20" r="1.8"/><path d="M24 25l-2.8 4h5.6z" fill="var(--background)"/>',
  },
  {
    name: 'penguin',
    note: 'Egg body with a cut-out belly, dot eyes, tiny beak.',
    body: '<path d="M24 5c8.3 0 13 6.5 13 15v12c0 6-5.5 10-13 10s-13-4-13-10V20C11 11.5 15.7 5 24 5z"/><path d="M24 14c5 0 8 3.5 8 9v10c0 4-3 6-8 6s-8-2-8-6V23c0-5.5 3-9 8-9z" fill="var(--background)"/><circle cx="19.5" cy="12.5" r="1.7" fill="var(--background)"/><circle cx="28.5" cy="12.5" r="1.7" fill="var(--background)"/><path d="M22 15.5h4l-2 3.5z"/><path d="M18 41.5l-3 2.5h6zM30 41.5l-3 2.5h6z"/>',
  },
  {
    name: 'hedgehog',
    note: 'Spiky dome with a cut-out face and a nose dot.',
    body: '<path d="M6 36l4-6-2-6 5-1 0-6 5 1 2-6 4 3 4-3 2 6 5-1 0 6 5 1-2 6 4 6z"/><path d="M6 36c0-6 2.5-10.5 6.5-12.5 3 2.5 4.5 7 4.5 12.5z" fill="var(--background)"/><circle cx="7.5" cy="33.5" r="2"/><circle cx="13" cy="31.5" r="1.4"/>',
  },
  {
    name: 'fin',
    note: 'Shark fin over a wave line.',
    body: '<path d="M14 36c-1-12 6-22 18-26-3 7-2 13 2 18l12 8z"/><path d="M6 40c4-3 8-3 12 0s8 3 12 0 8-3 12 0" fill="none" stroke="{c}" stroke-width="4" stroke-linecap="round"/>',
  },
  {
    name: 'fish',
    note: 'Round fish with a forked tail and an eye cut-out.',
    body: '<ellipse cx="21" cy="26" rx="13" ry="10"/><path d="M32 26 42 18l-2.5 8L42 34z"/><circle cx="15" cy="24" r="1.8" fill="var(--background)"/>',
  },
  {
    name: 'ladybug',
    note: 'Dome, head bump, antennae, cut-out seam and spots.',
    body: '<path d="M9 28c0-9.4 6.7-16 15-16s15 6.6 15 16c0 7-6.7 12-15 12s-15-5-15-12z"/><circle cx="24" cy="9.5" r="4"/><path d="M21 6l-3-3M27 6l3-3" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"/><path d="M24 14v24" fill="none" stroke="var(--background)" stroke-width="2.2"/><circle cx="17" cy="25" r="2.6" fill="var(--background)"/><circle cx="31" cy="25" r="2.6" fill="var(--background)"/><circle cx="20" cy="34" r="2.2" fill="var(--background)"/><circle cx="28" cy="34" r="2.2" fill="var(--background)"/>',
  },
  {
    name: 'bee',
    note: 'Striped body (cut-out bands), two wings, stinger, antennae.',
    body: '<ellipse cx="24" cy="29" rx="9.5" ry="12"/><path d="M15 26h18M15 33h18" stroke="var(--background)" stroke-width="3.6" stroke-linecap="round"/><ellipse cx="17" cy="15" rx="6" ry="7.5" transform="rotate(-20 17 15)"/><ellipse cx="31" cy="15" rx="6" ry="7.5" transform="rotate(20 31 15)"/><path d="M24 40.5 26 45l-2-1-2 1z"/><path d="M20 6l-2-3M28 6l2-3" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"/>',
  },
  {
    name: 'caterpillar',
    note: 'A chain of bumps with a face and antennae.',
    body: '<circle cx="10" cy="34" r="5.5"/><circle cx="19" cy="31" r="6"/><circle cx="28" cy="33" r="5.5"/><circle cx="36" cy="36" r="5"/><path d="M8 29l-3-4M12 28.5l1-4.5" fill="none" stroke="{c}" stroke-width="2.2" stroke-linecap="round"/><circle cx="8.5" cy="33" r="1.5" fill="var(--background)"/>',
  },
  {
    name: 'campfire',
    note: 'Flame with an inner cut-out over two crossed logs.',
    body: '<path d="M24 4c5 6.5 9 11.5 9 17 0 6-4 10-9 10s-9-4-9-10c0-2.5.8-5 2.2-7.5C18.5 16.5 21 11 24 4z"/><path d="M24 12c2.8 4 4.5 7 4.5 10 0 3.5-2 6-4.5 6s-4.5-2.5-4.5-6c0-3 1.7-6 4.5-10z" fill="var(--background)"/><rect x="6" y="35" width="22" height="6" rx="3" transform="rotate(14 17 38)"/><rect x="20" y="35" width="22" height="6" rx="3" transform="rotate(-14 31 38)"/>',
  },
  {
    name: 'ufo',
    note: 'Dome on a saucer with three light cut-outs.',
    body: '<path d="M15 21c0-6.6 4-11 9-11s9 4.4 9 11z"/><path d="M6 27c0-4 8-7 18-7s18 3 18 7-8 7-18 7S6 31 6 27z"/><circle cx="16" cy="27" r="1.7" fill="var(--background)"/><circle cx="24" cy="28" r="1.7" fill="var(--background)"/><circle cx="32" cy="27" r="1.7" fill="var(--background)"/>',
  },
  {
    name: 'sock',
    note: 'A sock with a cut-out stripe and toe.',
    body: '<path d="M16 5h12v17c0 2 .8 3.6 2.3 5.1l5.4 5.4c2.8 2.8 2.8 7 0 9.8-2.8 2.8-7 2.8-9.8 0l-7.6-7.6C16.8 33.2 16 31.6 16 29.5z"/><path d="M16 10.5h12" stroke="var(--background)" stroke-width="3"/><circle cx="32.5" cy="38.5" r="3.5" fill="var(--background)"/>',
  },
  {
    name: 'popsicle',
    note: 'Rounded pop on a stick with a bite taken out.',
    body: '<rect x="14" y="5" width="20" height="30" rx="10"/><rect x="21.8" y="35" width="4.4" height="9" rx="2.2"/><circle cx="33.5" cy="8.5" r="4" fill="var(--background)"/>',
  },
  {
    name: 'cupcake',
    note: 'Swirl of frosting over a pleated wrapper.',
    body: '<path d="M12 27c-2-1.5-3-3.5-3-5.5C9 17 13 13 18 12c1-4.5 4-7.5 6-7.5s5 3 6 7.5c5 1 9 5 9 9.5 0 2-1 4-3 5.5z"/><path d="M13 27h22l-2.6 13c-.4 1.9-1.8 3-3.7 3h-9.4c-1.9 0-3.3-1.1-3.7-3z"/><path d="M18 27.5 17 42M24 27.5V42M30 27.5 31 42" fill="none" stroke="var(--background)" stroke-width="2"/>',
  },
  {
    name: 'paw',
    note: 'One big pad, four toes.',
    body: '<path d="M24 44c-7 0-11.5-4.5-11.5-10.5C12.5 28.5 17 25 24 25s11.5 3.5 11.5 8.5C35.5 39.5 31 44 24 44z"/><circle cx="12.5" cy="20" r="3.6"/><circle cx="19.5" cy="16.5" r="3.6"/><circle cx="28.5" cy="16.5" r="3.6"/><circle cx="35.5" cy="20" r="3.6"/>',
  },
];
