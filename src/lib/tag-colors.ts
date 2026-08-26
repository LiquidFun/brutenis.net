/**
 * The yarn palette is a fixed set of eight colours, which is what lets a
 * per-item colour travel as a *class* rather than as
 * `style="--card-color: ..."`. Style attributes in markup are blocked by the
 * CSP — a hash can cover a <style> element but not an attribute — so anything
 * that used to be an inline custom property now resolves to one of the
 * `.yarn-color-*` classes in global.css, which set `--yarn-color`.
 */
export const yarnColorNames = [
  "coral",
  "teal",
  "yellow",
  "purple",
  "pink",
  "blue",
  "green",
  "orange",
] as const;

export type YarnColorName = (typeof yarnColorNames)[number];

/** Deterministic colour for a tag name. */
export function getTagColorName(tag: string): YarnColorName {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return yarnColorNames[Math.abs(hash) % yarnColorNames.length];
}

/** The class that sets `--yarn-color`, for a tag or an explicit fallback. */
export function yarnColorClass(name: YarnColorName): string {
  return `yarn-color-${name}`;
}

/** Shorthand: the class for the colour derived from `tag`. */
export function getTagColorClass(tag: string): string {
  return yarnColorClass(getTagColorName(tag));
}
