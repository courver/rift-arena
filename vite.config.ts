import { defineConfig } from 'vite';

// base './' so the build works from any sub-path (GitHub Pages, itch.io).
// es2018 keeps older phones and in-app browsers (WeChat, QQ) working.
export default defineConfig({
  base: './',
  build: { target: 'es2018', chunkSizeWarningLimit: 2000 },
});
