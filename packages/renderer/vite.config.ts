import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      // Overridable so a worktree copy can point at its own server instance without
      // colliding with a cockpit already running on the standard ports.
      '/api': process.env.COCKPIT_API_TARGET ?? 'http://127.0.0.1:3040',
    },
  },
});
