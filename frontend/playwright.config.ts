import { defineConfig } from '@playwright/test';

// The "directory-api" project serves a second build with an API origin compiled in.
// The origin never resolves, and its tests answer every request to it themselves, so
// the browser suite needs no backend and cannot reach a real one by accident. It runs
// the consultation directory (demo and pilot fixture) and the sign-in / health profile
// specs. The full-stack
// checks against a real FastAPI and PostgreSQL use playwright.fullstack.config.ts.
const E2E_API_ORIGIN = 'http://medassist-api.test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 5000 },
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'demo',
      testMatch: 'workflows.spec.ts',
      use: { baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'directory-api',
      testMatch:
        /(consultations|consultations-pilot|health-profile|medication-check)-api\.spec\.ts$/,
      use: { baseURL: 'http://127.0.0.1:4176' },
    },
  ],
  webServer: [
    {
      command: 'npm run preview -- --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'npm run preview:e2e-api',
      url: 'http://127.0.0.1:4176',
      reuseExistingServer: false,
      timeout: 120000,
      env: { VITE_API_BASE_URL: E2E_API_ORIGIN },
    },
  ],
});
