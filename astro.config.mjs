import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync } from 'node:fs';

// /writing stays out of the sitemap until there's a post in it.
let hasWriting = false;
try {
  hasWriting = readdirSync('./src/content/writing').some((f) => f.endsWith('.md'));
} catch {
  /* no writing folder yet */
}

export default defineConfig({
  site: 'https://umarkhatana.com',
  // Cloudflare serves /work.html at /work — keeps canonical, sitemap and served URL identical.
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap({ filter: (page) => hasWriting || !page.includes('/writing') })],
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
