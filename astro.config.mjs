// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const gameVersion = (() => {
  try {
    return execSync('git describe --tags --always').toString().trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  site: 'https://brutenis.net',
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],

  // Astro emits a <meta http-equiv="content-security-policy"> per page, with
  // SHA-256 hashes for its own inline and bundled scripts and styles. That
  // gives a script-src with no 'unsafe-inline', which is the point: the admin
  // page is on this origin and basic auth is replayed automatically by the
  // browser, so script execution anywhere on brutenis.net otherwise reaches the
  // leaderboard admin API. Page content is rendered from READMEs fetched at
  // build time and passed through `marked`, which does not sanitise HTML.
  //
  // Consequence for markup: a hash cannot cover a style *attribute*, and
  // 'unsafe-inline' is ignored once any hash is present, so `style="..."` in a
  // template no longer applies. Use the .start-hidden class in global.css.
  // Setting `.style.foo` from JS is unaffected by CSP and still works.
  //
  // frame-ancestors is deliberately absent: browsers ignore it in a meta
  // element, so it is set as a real header in the Caddyfile instead.
  security: {
    csp: {
      directives: [
        "default-src 'none'",
        // Repo READMEs rewrite relative images to raw.githubusercontent.com.
        "img-src 'self' data: https://raw.githubusercontent.com",
        // Bare user-attachments links become <video> elements.
        "media-src 'self' https://github.com https://raw.githubusercontent.com",
        "font-src 'self'",
        // The leaderboard API is same-origin, proxied by Caddy under /api/*.
        "connect-src 'self'",
        // Game embeds: same-origin today, but any https host is acceptable —
        // the point is to exclude javascript: and data:.
        "frame-src 'self' https:",
        "base-uri 'none'",
        "form-action 'self'",
      ],
    },
  },

  vite: {
    plugins: [tailwindcss()],
    define: {
      __GAME_VERSION__: JSON.stringify(gameVersion),
    },
    server: {
      https: fs.existsSync('/tmp/cert.pem') ? {
        key: fs.readFileSync('/tmp/key.pem'),
        cert: fs.readFileSync('/tmp/cert.pem'),
      } : undefined,
    },
  },
  markdown: {
    // Prism, not Shiki: Shiki colours every token with a `style` attribute,
    // which the CSP above blocks, so code blocks would render colourless. Prism
    // emits classes instead. Nothing renders through this pipeline today — the
    // CTF writeups and the GitHub READMEs are parsed by `marked` in
    // src/lib/*-loader.ts, and src/content/blog holds no local .md files — so
    // this is not a visual change. It does mean the first local .md post with a
    // fenced code block needs a Prism theme stylesheet added to global.css to
    // get colours; without one the code is styled but monochrome.
    syntaxHighlight: 'prism',
    remarkPlugins: [],
  },
});
