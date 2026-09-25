const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const graphemeLength = (s: string) => { let n = 0; for (const _ of seg.segment(s)) n++; return n; };
const norm = (h: string) => `#${h.replace(/^#+/, "").trim()}`;

/** Caption + "\n\n#tags" within `max` graphemes. The caption is trimmed at a word boundary with an ellipsis;
 *  if even a reasonable caption cannot fit next to the tags, the tags are dropped instead. */
export function composeText(caption: string, hashtags: string[], max: number): string {
  const tags = hashtags.map(norm).filter((t) => t.length > 1).join(" ");
  const cap = caption.trim();
  const withTags = tags ? `${cap}\n\n${tags}` : cap;
  if (graphemeLength(withTags) <= max) return withTags;
  const room = tags ? max - graphemeLength(`\n\n${tags}`) : max;
  if (!tags || room < 20) return trimWords(cap, max);
  return `${trimWords(cap, room)}\n\n${tags}`;
}

/** Longest whole-word prefix that fits in `max` graphemes including the trailing ellipsis. */
function trimWords(s: string, max: number): string {
  if (graphemeLength(s) <= max) return s;
  let out = "";
  for (const w of s.split(/\s+/)) {
    const next = out ? `${out} ${w}` : w;
    if (graphemeLength(next) + 1 > max) break;
    out = next;
  }
  return `${out}…`;
}
