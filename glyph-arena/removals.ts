/**
 * Glyphs we suggest retiring, with reasons. Every one still gets an improved variant in the
 * A/B section, so agreeing here means "cut it from the set", not "the redraw is bad".
 */
export type RemovalSuggestion = { name: string; reason: string };

export const REMOVAL_SUGGESTIONS: RemovalSuggestion[] = [
  {
    name: 'tulip-2',
    reason:
      'Redundant with tulip — at 30px both read as "a tulip". The improved version becomes a closed bud, which could earn its slot under a new name if you love it.',
  },
  {
    name: 'flower-blob',
    reason:
      'Six overlapping circles merge into mush at 30px. The set already has flower, daisy and clover — three flowers is plenty; four is noise.',
  },
  {
    name: 'seeds',
    reason:
      'Twelve tiny scattered ellipses read as anonymous dots at 30px. The improved "sprouting bean" is nicer but then overlaps sprout.',
  },
  {
    name: 'pawn',
    reason:
      'Reads as a lollipop / bear head at 30px, not chess. Even with the improved collar and base it is the weakest silhouette in the set.',
  },
  {
    name: 'squiggle',
    reason:
      'Overlaps spiral — both are "an abstract squiggle". One abstract curve in the set is charming; two compete for the same slot.',
  },
  {
    name: 'vase',
    reason:
      'Weak read at 30px (a blobby urn). Between potted-flower, tulip and the improved version, the "vessel" niche is already crowded.',
  },
];
