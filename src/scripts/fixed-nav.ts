/**
 * Reserves space for the fixed nav bar.
 *
 * The bar is position:fixed so that it is anchored to the viewport no matter
 * what any ancestor does — sticky silently stops pinning as soon as something up
 * the tree becomes a scroll container. The cost is that it occupies no space in
 * the flow, so the page has to leave room for it.
 *
 * The height is measured rather than hard-coded because it changes: the links
 * wrap onto a second or third row on narrow windows, and the game HUD can alter
 * the row height. A ResizeObserver keeps the padding in step.
 *
 * Setting .style from script is unaffected by the page CSP; a style attribute in
 * the markup would have been blocked.
 */

let observer: ResizeObserver | null = null;

function reserve(nav: HTMLElement): void {
  const height = nav.getBoundingClientRect().height;
  if (height <= 0) return;
  document.body.style.paddingTop = `${height}px`;
  // Anchor targets and scrollIntoView would otherwise land underneath the bar.
  document.documentElement.style.scrollPaddingTop = `${height}px`;
}

export function initFixedNav(): void {
  teardownFixedNav();

  const nav = document.querySelector<HTMLElement>("nav");
  if (!nav) return;

  reserve(nav);
  observer = new ResizeObserver(() => reserve(nav));
  observer.observe(nav);
}

/**
 * Client-side navigation keeps module state but swaps <body>, so the observed
 * nav is replaced; without this the old observer would linger and one more would
 * be added on every navigation.
 */
export function teardownFixedNav(): void {
  observer?.disconnect();
  observer = null;
}
