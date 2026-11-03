import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 确保在 GitHub Pages 相对路径下开箱即用静态部署
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});

