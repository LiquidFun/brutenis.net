/**
 * Reserves space for the fixed nav bar, and slides it out of the way while the
 * reader moves down the page.
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

/**
 * Scroll travel before the bar reacts. Without it a trackpad's jitter, which
 * alternates direction pixel by pixel, makes the bar flap.
 */
const SCROLL_STEP = 8;

let observer: ResizeObserver | null = null;
let onScroll: (() => void) | null = null;
let navHeight = 0;
let lastY = 0;
let frame = 0;

function reserve(nav: HTMLElement): void {
  const height = nav.getBoundingClientRect().height;
  if (height <= 0) return;
  navHeight = height;
  document.body.style.paddingTop = `${height}px`;
  // Anchor targets and scrollIntoView would otherwise land underneath the bar.
  document.documentElement.style.scrollPaddingTop = `${height}px`;
}

/**
 * Hides the bar while the reader goes down and brings it back the moment they
 * go up — full-width pages (/photography most of all) want the chrome gone, but
 * not at the price of having to scroll all the way up to reach the links.
 *
 * Only the class moves; the body keeps its padding either way, so the page never
 * reflows as the bar comes and goes.
 */
function update(): void {
  frame = 0;
  const y = Math.max(0, window.scrollY);
  const delta = y - lastY;
  // Below the step, leave lastY alone so that slow travel keeps accumulating
  // instead of being rounded away one frame at a time.
  if (Math.abs(delta) < SCROLL_STEP) return;
  lastY = y;
  // Never hidden within the first couple of bar heights: there is nothing to
  // get out of the way of yet.
  document.documentElement.classList.toggle("nav-collapsed", delta > 0 && y > navHeight * 2);
}

export function initFixedNav(): void {
  teardownFixedNav();

  const nav = document.querySelector<HTMLElement>("nav");
  if (!nav) return;

  reserve(nav);
  observer = new ResizeObserver(() => reserve(nav));
  observer.observe(nav);

  lastY = Math.max(0, window.scrollY);
  onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

/**
 * Client-side navigation keeps module state but swaps <body>, so the observed
 * nav is replaced; without this the old observer would linger and one more would
 * be added on every navigation.
 */
export function teardownFixedNav(): void {
  observer?.disconnect();
  observer = null;
  if (onScroll) window.removeEventListener("scroll", onScroll);
  onScroll = null;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  // The incoming page starts at the top, where the bar is always shown.
  document.documentElement.classList.remove("nav-collapsed");
}
