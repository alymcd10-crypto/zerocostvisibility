// {{#live}}…{{/live}} and {{#private}}…{{/private}} blocks, used by scripts/build.mjs.
// A marker may sit inside a comment (<!--{{#live}}--> or /*{{#live}}*/); the comment goes too.
// In live mode the live blocks keep their text and the private ones vanish, and the other way round.
const BLOCK = /(?:<!--|\/\*)?\{\{#(live|private)\}\}(?:-->|\*\/)?([\s\S]*?)(?:<!--|\/\*)?\{\{\/\1\}\}(?:-->|\*\/)?/g;

export function applyMode(text, isLive) {
  const result = text.replace(BLOCK, (_, kind, inner) => ((kind === "live") === isLive ? inner : ""));
  const stray = result.match(/\{\{[#/](live|private)\}\}/);
  if (stray) throw new Error(`Unpaired ${stray[0]} marker`);
  return result;
}
