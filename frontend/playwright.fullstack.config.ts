import { defineConfig } from '@playwright/test';

// End-to-end checks against a real FastAPI server and PostgreSQL database. Unlike the
// default suite, nothing is mocked: the build in dist-fullstack is compiled with
// VITE_API_BASE_URL pointing at a running API. The "Health profile (full stack)"
// workflow starts that API, runs the phases below in order and restarts FastAPI
// between them:
//   npx playwright test -c playwright.fullstack.config.ts --grep @before-restart
//   (restart FastAPI)
//   npx playwright test -c playwright.fullstack.config.ts --grep @after-restart
//   (expire Patient B's sessions in PostgreSQL)
//   npx playwright test -c playwright.fullstack.config.ts --grep @expired
//   npx playwright test -c playwright.fullstack.config.ts --grep @medication-check
//   (import the fictional pilot fixture twice, then a failing file)
//   npx playwright test -c playwright.fullstack.config.ts --grep @consultation-demo
//   (restart FastAPI with MEDASSIST_CONSULTATION_PILOT=on)
//   npx playwright test -c playwright.fullstack.config.ts --grep @consultation-pilot
export default defineConfig({
  testDir: './tests/fullstack',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort --outDir dist-fullstack',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
