import { defineConfig } from 'vitest/config';

// No @vitejs/plugin-react here: vitest bundles vite 5 while the app uses vite 6, so the plugin
// clashes at the type level. It is unnecessary for tests — esbuild transforms TSX via the
// renderer tsconfig's `jsx: react-jsx` (automatic runtime). The plugin only adds dev HMR.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
