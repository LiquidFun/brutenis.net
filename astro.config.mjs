// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';

export default defineConfig({
  site: 'https://brutenis.net',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
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
