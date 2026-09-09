/**
 * Nav dark-mode toggle.
 *
 * The class on <html> is *not* set here — it is set by the head-inline
 * bootstrap injected from astro.config.mjs, which runs before first paint and
 * before this module is even fetched. This file only owns the click and the
 * button's accessible state.
 *
 * Everything is bound off `document` rather than off the button: the button is
 * part of the swapped body, so a per-element listener would need re-binding on
 * every `astro:page-load`, and the module scope survives navigation, so the old
 * listeners would pile up. Delegation binds once per real page load and is
 * indifferent to how many times the body is replaced under it.
 */

const STORAGE_KEY = "theme";

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Mirrors the current theme onto the button, for screen readers and tooltips. */
function syncButton(): void {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const dark = isDark();
  btn.setAttribute("aria-pressed", String(dark));
  btn.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest("#theme-toggle")) return;

  const next = !isDark();
  document.documentElement.classList.toggle("dark", next);
  try {
    // Explicit choice from here on: the OS preference no longer applies, which
    // is the whole point of having a toggle over a media query.
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  } catch {
    // Private mode / storage disabled. The theme still flips, it just will not
    // survive a reload.
  }
  syncButton();
});

syncButton();
document.addEventListener("astro:page-load", syncButton);
