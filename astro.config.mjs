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
  integrations: [sitemap()],
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
    shikiConfig: {
      theme: 'dracula',
    },
    remarkPlugins: [],
  },
});
