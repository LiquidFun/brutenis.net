/**
 * Font families for canvas drawing.
 *
 * CSS reads these from the --font-* custom properties in global.css, but a
 * canvas 2d context needs a plain font string, so the family has to be repeated
 * here. Keeping it in one place is the point: the family used to be spelled out
 * in every ctx.font assignment across the game and the animated logo, so
 * changing the site's heading font left the canvases silently falling back to a
 * generic cursive.
 *
 * Must match --font-heading in src/styles/global.css.
 */
export const CANVAS_HEADING_FONT = "Kalam, cursive";
