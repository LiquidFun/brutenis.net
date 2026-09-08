/**
 * The album index strip at the top of /photography, plus the back-to-top button.
 *
 * The index entries are plain `<a href="#slug">` links, so the browser does the
 * scrolling and the history entry: the URL becomes shareable for free, the links
 * work without JavaScript, and "copy link address" gives the album's address.
 * Astro's client router recognises a same-page fragment link and only moves the
 * location, so no view transition runs and the gallery is not rebuilt.
 *
 * What is left for this module is the things the browser gets wrong: a scroll
 * position — from a fragment or from a reload — that was resolved before the
 * justified layout ran, and a repeat click on a fragment already in the URL.
 */

/** How far down the page the back-to-top button appears, in pixels. */
const SHOW_TO_TOP_AFTER = 600;

let cleanups: (() => void)[] = [];

/** The album a fragment points at, or null. */
function albumFor(hash: string): HTMLElement | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return null;
  const el = document.getElementById(id);
  return el?.classList.contains("photo-album") ? el : null;
}

/**
 * Puts the page back where it was, once the grid has its real row heights.
 *
 * Both of the things that scroll a freshly loaded page act too early to be
 * right. The browser resolves a fragment against the server-rendered layout,
 * where every row is a fixed 560px, so by the time @scripts/photos/gallery has
 * packed the photos into justified rows the target album has moved — thousands
 * of pixels, on a page this tall. Astro's own scroll restoration, which is what
 * returns you to your place after a reload, reads its position out of
 * history.state and applies it at the same too-early moment; worse, it calls
 * scrollTo with no behaviour, so `scroll-behavior: smooth` in global.css turns
 * it into a second-long animated slide from the top of the page to a position
 * that was already wrong.
 *
 * Redoing it here, instantly, cancels that animation and lands on the real
 * thing. Instant, not smooth: this is correcting a landing position, not
 * travelling to one.
 */
export function restoreScroll(): void {
  const album = albumFor(location.hash);
  if (album) {
    album.scrollIntoView({ behavior: "instant", block: "start" });
    return;
  }
  const saved = history.state?.scrollY;
  if (typeof saved === "number" && saved > 0) {
    window.scrollTo({ top: saved, behavior: "instant" });
  }
}

function initIndexLinks(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".album-index-card")) {
    const onClick = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      // Only the "already there" case needs help: a fragment navigation that
      // does not change the URL is a no-op, so after scrolling away from an
      // album by hand, clicking its card again would do nothing at all.
      const target = new URL(link.href).hash;
      if (target !== location.hash) return;
      event.preventDefault();
      albumFor(target)?.scrollIntoView({ block: "start" });
    };
    link.addEventListener("click", onClick);
    cleanups.push(() => link.removeEventListener("click", onClick));
  }
}

function initToTop(): void {
  const button = document.querySelector<HTMLButtonElement>(".photo-to-top");
  if (!button) return;

  let frame = 0;
  const update = () => {
    frame = 0;
    button.classList.toggle("photo-to-top-visible", window.scrollY > SHOW_TO_TOP_AFTER);
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", onScroll, { passive: true });

  const onClick = () => {
    // Drop the album fragment on the way up. It would otherwise make a link
    // copied from the top of the page point at whichever album was last
    // visited, and it would swallow the next click on that album's card.
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
    // Default behaviour, which follows `scroll-behavior: smooth` from
    // global.css, rather than forcing smooth here.
    window.scrollTo({ top: 0 });
  };
  button.addEventListener("click", onClick);

  cleanups.push(() => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("scroll", onScroll);
    button.removeEventListener("click", onClick);
  });
}

export function initAlbumIndex(): void {
  teardownAlbumIndex();
  initIndexLinks();
  initToTop();
}

/**
 * Client-side navigation keeps module state but replaces the elements these
 * listeners are attached to, so they have to go before re-initialising.
 */
export function teardownAlbumIndex(): void {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
}
