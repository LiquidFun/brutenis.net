/**
 * The back-to-top button, on every page.
 *
 * This used to live in @scripts/photos/album-index and only existed on
 * /photography, which is the one page tall enough that its absence was obvious
 * — but the CTF writeups and the about page are long too, and on desktop there
 * is no equivalent of tapping the iOS status bar to get back up.
 *
 * The listeners are registered once at module scope rather than per page. The
 * module is only evaluated on a real page load, so nothing accumulates across
 * client-side navigations; the button element itself is replaced by each body
 * swap, so that one reference is re-read on `astro:page-load`.
 */

/** How far down the page the button appears, in pixels. */
const SHOW_AFTER = 600;

let button: HTMLElement | null = null;
let frame = 0;

function update(): void {
  frame = 0;
  button?.classList.toggle("to-top-visible", window.scrollY > SHOW_AFTER);
}

function onScroll(): void {
  if (!frame) frame = requestAnimationFrame(update);
}

/** Re-reads the button out of the freshly swapped body and syncs its state. */
function bind(): void {
  button = document.querySelector<HTMLElement>(".to-top");
  update();
}

bind();
document.addEventListener("astro:page-load", bind);
window.addEventListener("scroll", onScroll, { passive: true });

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest(".to-top")) return;

  // Drop any fragment on the way up. On /photography it would otherwise make a
  // link copied from the top of the page point at whichever album was last
  // visited, and it would swallow the next click on that album's card.
  if (location.hash) {
    history.replaceState(history.state, "", location.pathname + location.search);
  }
  // No explicit behaviour: this follows `scroll-behavior: smooth` from
  // global.css rather than forcing it here.
  window.scrollTo({ top: 0 });
});
