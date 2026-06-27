import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no localStorage in some configs; ensure a clean store per test.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
