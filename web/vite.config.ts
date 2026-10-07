import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow importing ../contracts/bones.json from outside the web/ root.
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:8787',
      '/files': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  test: {
    environment: 'node',
    // Installation scripts use Node's test runner through npm run test:assets.
    exclude: [...configDefaults.exclude, 'scripts/**', 'e2e/**'],
  },
});
