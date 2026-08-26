/**
 * Justified ("Google Photos") row layout for /photos.
 *
 * The server renders fixed-height rows with a ragged right edge, which needs no
 * JavaScript and no per-photo inline styles — the page CSP forbids style
 * attributes, so the pre-JS layout leans on the <img> width/height attributes
 * instead. This module then packs the photos into rows that fill the container
 * exactly and collapses each album to COLLAPSED_ROWS until "show more" is
 * pressed. Setting .style.* from script is unaffected by the CSP.
 */

/** Must match the gap in the .photo-grid rule. */
const GAP = 8;
/**
 * Rows shown before the "show more" button takes over. Two rows is the intent,
 * but at one photo per row that is a two-photo preview of a whole album, so
 * narrow layouts get more rows to show a comparable number of photos.
 */
const COLLAPSED_ROWS = 2;
const COLLAPSED_ROWS_SINGLE_COLUMN = 4;
/**
 * How much of the next row is left showing above the "show more" button, as a
 * hint that the album continues. .photo-peek fades its lower part out.
 */
const PEEK_HEIGHT = 240;
/**
 * Photos per row aimed for at a given container width. Row height falls out of
 * this and the actual aspect ratios, so a row of panoramas ends up shorter and
 * a row of portraits taller.
 */
const TARGETS: { maxWidth: number; perRow: number }[] = [
  { maxWidth: 560, perRow: 1 },
  // Two-up holds all the way through 1440p. Ending this band at 1900 meant a
  // 2560px monitor moved to three-up and got *smaller* photos than a 1920px one
  // (838px vs 940px) — a wider screen should never shrink the pictures.
  { maxWidth: 2700, perRow: 2 },
  { maxWidth: 3600, perRow: 3 },
  { maxWidth: Infinity, perRow: 4 },
];
/** Typical landscape photo, used to turn "photos per row" into a row height. */
const NOMINAL_ASPECT = 1.45;
/**
 * How much taller than the row above the justified final row may be before its
 * items are rebalanced. Every row is stretched to the full container width, so a
 * final row holding one photo would otherwise be enormous; pulling photos down
 * from the row above shortens it while keeping both rows full width.
 */
const MAX_LAST_ROW_RATIO = 1.4;

interface Item {
  el: HTMLElement;
  img: HTMLImageElement | null;
  aspect: number;
}

let cleanups: (() => void)[] = [];

function perRowFor(width: number): number {
  return TARGETS.find((t) => width <= t.maxWidth)!.perRow;
}

function readItems(grid: HTMLElement): Item[] {
  return [...grid.querySelectorAll<HTMLElement>(".photo-item")].map((el) => {
    const img = el.querySelector("img");
    const w = Number(img?.getAttribute("width")) || 3;
    const h = Number(img?.getAttribute("height")) || 2;
    return { el, img, aspect: w / h };
  });
}

/** Greedily packs items into rows that are each about `target` tall. */
function packRows(items: Item[], containerWidth: number, target: number, maxPerRow: number): Item[][] {
  const rows: Item[][] = [];
  let row: Item[] = [];
  let aspectSum = 0;

  for (const item of items) {
    row.push(item);
    aspectSum += item.aspect;
    const available = containerWidth - GAP * (row.length - 1);
    if (available / aspectSum <= target || row.length >= maxPerRow) {
      rows.push(row);
      row = [];
      aspectSum = 0;
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

/** The height a row takes once stretched to fill `containerWidth`. */
function justifiedHeight(row: Item[], containerWidth: number): number {
  const available = containerWidth - GAP * (row.length - 1);
  return available / row.reduce((sum, item) => sum + item.aspect, 0);
}

/**
 * Moves photos from the second-to-last row down into the last one while that
 * makes the taller of the two shorter.
 *
 * Every row is stretched to the container width, so a last row holding a single
 * photo would be as wide as the whole grid and correspondingly tall. Handing it a
 * neighbour shortens it and lengthens the row above.
 *
 * The test is "does this reduce the tallest of the two", not "is the last row
 * still taller than the one above": the latter overshoots. It kept moving until
 * the ratio flipped, which turned a 732px row followed by a 1104px one into a
 * 1104px row followed by a 732px one — the same tall row, one position earlier.
 */
function rebalanceLastRow(rows: Item[][], containerWidth: number): void {
  if (rows.length < 2) return;
  const last = rows[rows.length - 1]!;
  const previous = rows[rows.length - 2]!;
  const tallest = () =>
    Math.max(justifiedHeight(last, containerWidth), justifiedHeight(previous, containerWidth));

  while (previous.length > 1) {
    // Only worth trying while the last row is the disproportionate one.
    if (
      justifiedHeight(last, containerWidth) <=
      justifiedHeight(previous, containerWidth) * MAX_LAST_ROW_RATIO
    ) {
      break;
    }
    const before = tallest();
    last.unshift(previous.pop()!);
    if (tallest() >= before) {
      // No improvement: put it back and stop.
      previous.push(last.shift()!);
      break;
    }
  }
}

/**
 * Sizes one row so its photos plus gaps span exactly `containerWidth`, and
 * returns the height used. Every row is justified, including the last, so all
 * rows are the same width.
 *
 * `clipTo` shortens the boxes without touching the widths, which is what leaves
 * the peek row showing only the tops of its photos while still spanning the
 * container.
 */
function applyRow(row: Item[], containerWidth: number, clipTo?: number): number {
  const available = containerWidth - GAP * (row.length - 1);
  const height = justifiedHeight(row, containerWidth);
  // Never taller than the photos actually are.
  const boxHeight = clipTo === undefined ? height : Math.min(clipTo, height);

  let used = 0;
  row.forEach((item, i) => {
    // The last photo absorbs rounding drift, so the row lands on exactly the
    // container width. The 0.5px shortfall keeps a sub-pixel overflow from
    // wrapping the row.
    const width =
      i === row.length - 1
        ? Math.max(1, available - used - 0.5)
        : Math.round(item.aspect * height);
    used += width;
    item.el.style.width = `${width}px`;
    item.el.style.height = `${Math.round(boxHeight)}px`;
    // The markup can only carry a rough `sizes` estimate, since a row's photo
    // count depends on the aspect ratios that land in it. Now that the exact
    // width is known, hand it to the browser so it picks the right rendition —
    // the estimate was understating these widths, which is what made the grid
    // look soft. Renditions keep the aspect ratio, so a wide-enough candidate is
    // automatically tall enough too.
    if (item.img) item.img.sizes = `${Math.round(width)}px`;
  });
  return height;
}

function layoutAlbum(album: HTMLElement): void {
  const grid = album.querySelector<HTMLElement>(".photo-grid");
  if (!grid) return;

  const items = readItems(grid);
  if (items.length === 0) return;

  const containerWidth = grid.clientWidth;
  if (containerWidth <= 0) return;

  const perRow = perRowFor(containerWidth);
  const target = containerWidth / (perRow * NOMINAL_ASPECT);
  // A hard cap matters for portrait-heavy albums: a 2:3 photo adds only 0.67 to
  // the row's aspect sum, so packing purely by target height fitted six or seven
  // of them per row, each far narrower than intended. One column stays one
  // column — that is the point of the narrowest breakpoint.
  const maxPerRow = perRow === 1 ? 1 : perRow + 1;
  const rows = packRows(items, containerWidth, target, maxPerRow);
  rebalanceLastRow(rows, containerWidth);

  const collapsedRows = perRow === 1 ? COLLAPSED_ROWS_SINGLE_COLUMN : COLLAPSED_ROWS;
  const expanded = album.dataset.expanded === "true";
  const visibleRows = expanded ? rows.length : Math.min(collapsedRows, rows.length);

  rows.forEach((row, index) => {
    // The row straight after the visible ones is clipped to a faded sliver
    // instead of being hidden, so the album visibly continues past the button.
    const isPeek = !expanded && index === visibleRows;
    const hidden = !expanded && index > visibleRows;
    for (const item of row) {
      item.el.classList.toggle("photo-hidden", hidden);
      item.el.classList.toggle("photo-peek", isPeek);
    }
    if (!hidden) applyRow(row, containerWidth, isPeek ? PEEK_HEIGHT : undefined);
  });

  grid.classList.add("photo-grid-justified");

  const more = album.querySelector<HTMLElement>(".photo-more");
  if (more) {
    const button = more.querySelector("button");
    // collapsedRows, not COLLAPSED_ROWS: at one photo per row the threshold is
    // higher, and comparing against the constant left the button on screen
    // saying "Show 0 more" for a three-row album on a phone.
    more.classList.toggle("photo-hidden", rows.length <= collapsedRows);
    if (button) {
      const hiddenCount = rows.slice(visibleRows).reduce((n, row) => n + row.length, 0);
      button.textContent = expanded ? "Show less" : `Show ${hiddenCount} more`;
    }
  }
}

export function initGallery(): void {
  teardownGallery();

  const albums = [...document.querySelectorAll<HTMLElement>(".photo-album")];
  if (albums.length === 0) return;

  for (const album of albums) {
    album.dataset.expanded ??= "false";
    layoutAlbum(album);

    const button = album.querySelector<HTMLElement>(".photo-more button");
    if (!button) continue;
    const onClick = () => {
      const collapsing = album.dataset.expanded === "true";
      album.dataset.expanded = collapsing ? "false" : "true";
      layoutAlbum(album);
      // Collapsing can leave the viewport below the album; keep the heading in
      // view so the page does not appear to jump to an unrelated album.
      if (collapsing) album.scrollIntoView({ block: "nearest" });
    };
    button.addEventListener("click", onClick);
    cleanups.push(() => button.removeEventListener("click", onClick));
  }

  // One rAF-throttled relayout for the whole page: every album depends on the
  // same container width.
  let frame = 0;
  const onResize = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const album of albums) layoutAlbum(album);
    });
  };
  window.addEventListener("resize", onResize);
  cleanups.push(() => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
  });
}

/**
 * Client-side navigation does not reset module state, so the resize listener and
 * button handlers from the previous visit have to go before re-initialising.
 */
export function teardownGallery(): void {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
}
