import { defineConfig } from 'vite';

// base './' so the build works from any sub-path (GitHub Pages, itch.io)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
