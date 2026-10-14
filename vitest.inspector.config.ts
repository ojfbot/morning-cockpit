import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';
const server = createRequire(
  new URL('./packages/server/package.json', import.meta.url),
);
export default defineConfig({
  resolve: { alias: { 'mysql2/promise': server.resolve('mysql2/promise') } },
  test: {
    environment: 'node',
    include: ['tests/inspector.integration.test.ts'],
  },
});
