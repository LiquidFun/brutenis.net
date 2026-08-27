/**
 * Full-screen photo viewer for /photography: arrow navigation, wheel/pinch zoom,
 * drag to pan, swipe to change photo.
 *
 * The overlay is built in script rather than in the page markup because the CSP
 * forbids style attributes, and every transform here is per-photo state. The
 * grid links stay real <a href> to the largest rendition, so without JavaScript
 * a click still opens the photo.
 */

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const WHEEL_SENSITIVITY = 0.0015;
/** Scale a double-click / double-tap jumps to. */
const DOUBLE_TAP_SCALE = 2.5;
/** Horizontal travel that counts as a swipe to the next photo. */
const SWIPE_THRESHOLD = 60;
/** Pointer travel above which a release is a drag, not a click. */
const DRAG_SLOP = 6;

interface Slide {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Album this photo belongs to, for the caption. */
  album: string;
  /** 1-based position within that album, and the album's size. */
  positionInAlbum: number;
  albumSize: number;
}

interface Lightbox {
  root: HTMLElement;
  stage: HTMLElement;
  img: HTMLImageElement;
  counter: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
}

let ui: Lightbox | null = null;
let slides: Slide[] = [];
let index = 0;
let scale = 1;
let tx = 0;
let ty = 0;
let cleanups: (() => void)[] = [];

function button(className: string, label: string, glyph: string): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.setAttribute("aria-label", label);
  el.textContent = glyph;
  return el;
}

function build(): Lightbox {
  const root = document.createElement("div");
  root.className = "photo-lightbox photo-lightbox-closed";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Photo viewer");

  const stage = document.createElement("div");
  stage.className = "photo-lightbox-stage";

  const img = document.createElement("img");
  img.className = "photo-lightbox-img";
  img.draggable = false;
  stage.appendChild(img);

  const close = button("photo-lightbox-close", "Close", "×");
  const prev = button("photo-lightbox-nav photo-lightbox-prev", "Previous photo", "‹");
  const next = button("photo-lightbox-nav photo-lightbox-next", "Next photo", "›");

  const counter = document.createElement("div");
  counter.className = "photo-lightbox-counter";

  root.append(stage, close, prev, next, counter);
  document.body.appendChild(root);

  const box: Lightbox = { root, stage, img, counter, prev, next };

  close.addEventListener("click", closeLightbox);
  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));

  attachZoom(box);
  return box;
}

function applyTransform(): void {
  if (!ui) return;
  ui.img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  ui.img.classList.toggle("photo-lightbox-img-zoomed", scale > MIN_SCALE);
}

/** Keeps the photo from being panned away from the stage once zoomed in. */
function clampPan(): void {
  if (!ui) return;
  const maxX = Math.max(0, (ui.img.clientWidth * scale - ui.stage.clientWidth) / 2);
  const maxY = Math.max(0, (ui.img.clientHeight * scale - ui.stage.clientHeight) / 2);
  tx = Math.min(maxX, Math.max(-maxX, tx));
  ty = Math.min(maxY, Math.max(-maxY, ty));
}

/**
 * Zooms to `nextScale` keeping the point under (px, py) — viewport coordinates —
 * pinned in place. The image is centred by flex layout, so its untransformed
 * centre is the stage centre.
 */
function zoomTo(nextScale: number, px: number, py: number): void {
  if (!ui) return;
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
  const rect = ui.stage.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  tx = px - cx - ((px - cx - tx) * clamped) / scale;
  ty = py - cy - ((py - cy - ty) * clamped) / scale;
  scale = clamped;

  if (scale === MIN_SCALE) {
    tx = 0;
    ty = 0;
  }
  clampPan();
  applyTransform();
}

function resetTransform(): void {
  scale = MIN_SCALE;
  tx = 0;
  ty = 0;
  applyTransform();
}

function attachZoom(box: Lightbox): void {
  const { stage } = box;

  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomTo(scale * Math.exp(-e.deltaY * WHEEL_SENSITIVITY), e.clientX, e.clientY);
    },
    { passive: false },
  );

  stage.addEventListener("dblclick", (e) => {
    e.preventDefault();
    if (scale > MIN_SCALE) resetTransform();
    else zoomTo(DOUBLE_TAP_SCALE, e.clientX, e.clientY);
  });

  // Pointer events cover mouse drag, single-finger swipe/pan and two-finger
  // pinch with one code path.
  const active = new Map<number, { x: number; y: number }>();
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;
  let pinchDistance = 0;
  let pinchScale = 1;
  let moved = 0;

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    stage.setPointerCapture(e.pointerId);
    active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startX = e.clientX;
    startY = e.clientY;
    startTx = tx;
    startTy = ty;
    moved = 0;
    if (active.size === 2) {
      const [a, b] = [...active.values()];
      pinchDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      pinchScale = scale;
    }
  });

  stage.addEventListener("pointermove", (e) => {
    if (!active.has(e.pointerId)) return;
    active.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (active.size >= 2) {
      const [a, b] = [...active.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDistance > 0) {
        zoomTo(
          (pinchScale * distance) / pinchDistance,
          (a!.x + b!.x) / 2,
          (a!.y + b!.y) / 2,
        );
      }
      return;
    }

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    moved = Math.max(moved, Math.hypot(dx, dy));
    if (scale > MIN_SCALE) {
      tx = startTx + dx;
      ty = startTy + dy;
      clampPan();
      applyTransform();
    }
  });

  const onPointerUp = (e: PointerEvent) => {
    if (!active.delete(e.pointerId)) return;
    if (active.size < 2) pinchDistance = 0;
    // At 1x a horizontal drag is a swipe between photos.
    if (scale === MIN_SCALE && active.size === 0) {
      const dx = e.clientX - startX;
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(e.clientY - startY)) {
        show(index + (dx < 0 ? 1 : -1));
      }
    }
  };
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);

  // A click on the backdrop closes the viewer, but a pan that happens to end on
  // the backdrop must not: releasing a drag outside the photo still fires a
  // click whose target is the stage.
  stage.addEventListener("click", (e) => {
    if (e.target === stage && moved <= DRAG_SLOP) closeLightbox();
  });
}

function preload(i: number): void {
  const slide = slides[i];
  if (!slide) return;
  const img = new Image();
  img.src = slide.src;
}

function show(next: number): void {
  if (!ui || slides.length === 0) return;
  index = (next + slides.length) % slides.length;
  const slide = slides[index]!;

  ui.img.src = slide.src;
  ui.img.alt = slide.alt;
  ui.img.width = slide.width;
  ui.img.height = slide.height;
  // Named album plus the position inside it, rather than a page-wide count:
  // arrows run across album boundaries, so this is what says where you are and
  // makes crossing into the next album legible instead of abrupt.
  ui.counter.textContent = `${slide.album} · ${slide.positionInAlbum} / ${slide.albumSize}`;
  const single = slides.length < 2;
  ui.prev.classList.toggle("photo-hidden", single);
  ui.next.classList.toggle("photo-hidden", single);

  resetTransform();
  preload(index + 1);
  preload(index - 1);
}

function onKeyDown(e: KeyboardEvent): void {
  if (!ui || ui.root.classList.contains("photo-lightbox-closed")) return;
  switch (e.key) {
    case "Escape":
      closeLightbox();
      break;
    case "ArrowRight":
      show(index + 1);
      break;
    case "ArrowLeft":
      show(index - 1);
      break;
    case "+":
    case "=":
      zoomTo(scale * 1.4, innerWidth / 2, innerHeight / 2);
      break;
    case "-":
      zoomTo(scale / 1.4, innerWidth / 2, innerHeight / 2);
      break;
    case "0":
      resetTransform();
      break;
    default:
      return;
  }
  e.preventDefault();
}

/**
 * Every photo on the page, in document order, flattened across albums.
 *
 * The list deliberately spans albums: arrowing past the last photo of one album
 * continues into the first of the next, rather than looping back to where you
 * started. Only the very end of the last album wraps round to the beginning.
 */
function collectSlides(): Slide[] {
  const all: Slide[] = [];
  for (const album of document.querySelectorAll<HTMLElement>(".photo-album")) {
    const name = album.dataset.albumTitle ?? "";
    const items = [...album.querySelectorAll<HTMLElement>(".photo-item")];
    items.forEach((el, i) => {
      all.push({
        src: el.dataset.full ?? "",
        alt: el.querySelector("img")?.alt ?? "",
        width: Number(el.dataset.fullWidth) || 0,
        height: Number(el.dataset.fullHeight) || 0,
        album: name,
        positionInAlbum: i + 1,
        albumSize: items.length,
      });
    });
  }
  return all;
}

function openLightbox(start: number): void {
  ui ??= build();
  slides = collectSlides();

  ui.root.classList.remove("photo-lightbox-closed");
  document.documentElement.classList.add("photo-lightbox-open");
  show(start);
}

export function closeLightbox(): void {
  if (!ui) return;
  ui.root.classList.add("photo-lightbox-closed");
  document.documentElement.classList.remove("photo-lightbox-open");
  // Dropping the source stops a large in-flight rendition from downloading
  // after the viewer is gone.
  ui.img.removeAttribute("src");
  resetTransform();
}

export function initLightbox(): void {
  teardownLightbox();

  // One page-wide index, so the viewer opens at the right photo in a list that
  // already spans every album.
  const items = [...document.querySelectorAll<HTMLElement>(".photo-album .photo-item")];
  items.forEach((item, i) => {
    const onClick = (e: MouseEvent) => {
      // Let modified clicks open the rendition in a new tab as usual.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openLightbox(i);
    };
    item.addEventListener("click", onClick);
    cleanups.push(() => item.removeEventListener("click", onClick));
  });

  document.addEventListener("keydown", onKeyDown);
  cleanups.push(() => document.removeEventListener("keydown", onKeyDown));
}

/**
 * Client-side navigation keeps this module's state but replaces <body>, which
 * detaches the overlay. Dropping the reference forces the next visit to build a
 * fresh one; keeping it would leave `ui` pointing at an element that is no
 * longer in the document, and the viewer would silently never appear.
 */
export function teardownLightbox(): void {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
  closeLightbox();
  ui?.root.remove();
  ui = null;
  slides = [];
}
