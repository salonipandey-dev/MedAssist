import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicRoutes = [
  '/',
  '/platform',
  '/how-it-works',
  '/patients',
  '/professionals',
  '/security',
  '/about',
  '/demo',
];
const roleRoutes = {
  patient: [
    '',
    'profile',
    'history',
    'assessments',
    'cases',
    'appointments',
    'reports',
    'notifications',
    'settings',
  ],
  doctor: ['', 'cases', 'patients', 'reviews', 'appointments', 'schedule', 'activity', 'settings'],
  admin: [
    '',
    'users',
    'doctors',
    'cases',
    'appointments',
    'reports',
    'analytics',
    'audit',
    'settings',
  ],
};
const allRoutes = [
  ...publicRoutes,
  ...Object.entries(roleRoutes).flatMap(([role, paths]) =>
    paths.map((p) => `/app/${role}${p ? '/' + p : ''}`),
  ),
];

test('public navigation and the interactive workflow connect to demo access', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Healthcare');
  await page.getByRole('button', { name: /Professional review Keep people/ }).click();
  await expect(page.locator('.workflow-caption')).toContainText(
    'AI assistance remains unavailable',
  );
  await page.getByRole('link', { name: 'Explore Demo', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Choose your perspective');
  await page.getByRole('link', { name: 'Explore patient demo', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back, Mira.');
});

test('profile validates, saves, cancels and resets on reload', async ({ page }) => {
  await page.goto('/app/patient/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('Fictional display alias').fill('');
  await page.getByRole('button', { name: 'Save demo profile' }).click();
  await expect(page.locator('#alias-error')).toBeVisible();
  await page.getByLabel('Fictional display alias').fill('River Vale (Demo)');
  await page.getByRole('button', { name: 'Save demo profile' }).click();
  await expect(page.getByRole('heading', { name: 'River Vale (Demo)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('Fictional display alias').fill('Cancel This (Demo)');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'River Vale (Demo)', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mira Chen (Demo)', exact: true })).toBeVisible();
});

test('assessment accepts only predefined samples and creates a trackable case', async ({
  page,
}) => {
  await page.goto('/app/patient/assessments');
  await expect(page.locator('input,textarea,select')).toHaveCount(1); // Role selector only.
  await page.getByRole('button', { name: 'Begin sample walkthrough' }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review the predefined sample.' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit predefined sample' }).click();
  await expect(
    page.getByRole('heading', { name: 'A new sample case, ready to follow.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'View sample case' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample assessment walkthrough');
  await expect(page.locator('.case-id-row')).toContainText('Submitted');
  await expect(
    page.getByText('No professional review recorded for this fictional case.'),
  ).toBeVisible();
  await expect(page.getByText('AI assistance not yet available.', { exact: false })).toBeVisible();
});

test('fictional appointment request, conflict prevention and cancellation work', async ({
  page,
}) => {
  await page.goto('/app/patient/appointments');
  await page.getByRole('button', { name: 'Next sample month' }).click();
  await page.getByRole('button', { name: /Monday,? 2 November 2026/, exact: true }).click();
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await page.getByRole('button', { name: 'Request sample appointment' }).click();
  await expect(page.getByRole('dialog')).toContainText('No appointment message is sent');
  await page.getByRole('button', { name: 'Confirm sample request' }).click();
  await expect(page.getByRole('button', { name: /09:00 Unavailable/ })).toBeDisabled();
  await page.getByRole('button', { name: 'View details', exact: true }).first().click();
  await page.getByRole('button', { name: 'Cancel sample appointment', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.badge')).toHaveText('Cancelled');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '09:00', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByRole('table', { name: 'appointments' })).toContainText('Cancelled');
});

test('doctor review validates confirmation and stays separate from AI output', async ({ page }) => {
  await page.goto('/app/doctor/reviews/MA-2402');
  await page.getByRole('button', { name: 'Record sample review' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Confirm that this is a fictional workflow review',
  );
  await page.getByLabel('I understand this records a fictional workflow review only.').check();
  await page.getByRole('button', { name: 'Record sample review' }).click();
  await expect(page.locator('.case-id-row .badge')).toHaveText('Reviewed');
  await expect(page.locator('.review-record')).toContainText('No clinical conclusion');
  await expect(page.locator('.ai-concept')).toContainText('AI assistance not yet available');
  await page.getByLabel('Demo role').selectOption('admin');
  await page.getByRole('link', { name: 'Cases', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search cases' }).fill('MA-2402');
  await expect(page.getByRole('table', { name: 'cases' })).toContainText('Reviewed');
});

test('tables search, filter, sort, paginate and show reversible demo controls', async ({
  page,
}) => {
  await page.goto('/app/admin/users');
  await page.getByRole('textbox', { name: 'Search users' }).fill('no-matching-sample');
  await expect(page.getByText('No matching records')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Name', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Ada Wells');
  await page.getByRole('button', { name: 'Next users page' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await page.getByLabel('Filter users').selectOption('doctor');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'View user' }).first().click();
  await page.getByRole('button', { name: 'Pause demo availability' }).click();
  await page.getByRole('button', { name: 'Confirm demo change' }).click();
  await expect(page.getByRole('dialog')).toContainText('Paused');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('table', { name: 'users' })).toContainText('Paused');
  await page.getByRole('link', { name: 'Audit Activity' }).click();
  await page.getByRole('textbox', { name: 'Search audit events' }).fill('availability toggled');
  await expect(page.getByRole('table', { name: 'audit events' })).toContainText(
    'sample account availability toggled',
  );
});

test('analytics date range recalculates charts and exports the same sample counts', async ({
  page,
}) => {
  await page.goto('/app/admin/analytics');
  await expect(page.locator('.stat').nth(1).locator('strong')).toHaveText('36');
  await page.getByLabel('Sample date range').selectOption('October');
  await expect(page.locator('.stat').nth(1).locator('strong')).toHaveText('16');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.segmented button.active')).toHaveText('Compare');
  await page.locator('.chart-data').first().locator('summary').click();
  await expect(page.locator('.chart-data').first()).toContainText('Oct');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sample' }).click();
  expect((await download).suggestedFilename()).toBe('medassist-sample-activity.csv');
});

test('safe document preview, unavailable uploads and dialog focus work', async ({ page }) => {
  await page.goto('/app/patient/reports');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  const preview = page.getByRole('button', { name: 'Preview', exact: true }).first();
  await preview.click();
  await expect(page.getByRole('dialog')).toContainText('SAMPLE · NOT A MEDICAL RECORD');
  await page.keyboard.press('Escape');
  await expect(preview).toBeFocused();
  await page.getByRole('button', { name: 'Upload unavailable' }).click();
  await expect(page.getByRole('dialog')).toContainText('No file picker is rendered');
});

test('mock workflows do not use network mutations or browser storage', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error('Unexpected persistent storage write');
    };
    const original = window.fetch;
    window.fetch = function (input, init) {
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (method !== 'GET' && method !== 'HEAD') throw new Error('Unexpected network mutation');
      return original(input, init);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const apiRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/health') || r.method() === 'POST') apiRequests.push(r.url());
  });
  await page.goto('/app/patient/assessments');
  await page.getByRole('button', { name: 'Begin sample walkthrough' }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Submit predefined sample' }).click();
  await page.getByLabel('Demo role').selectOption('admin');
  await page.getByRole('link', { name: 'System Settings' }).click();
  await page.getByRole('button', { name: 'Check API liveness' }).click();
  await expect(page.getByRole('alert')).toContainText('API is not configured');
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reset demo data', exact: true })
    .click();
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('mobile navigation traps focus, closes with Escape and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/app/patient');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  const nav = page.getByRole('dialog', { name: 'patient navigation' });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'MedAssist home' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(nav.getByRole('link', { name: 'Back to website' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await nav.getByRole('link', { name: 'Appointments', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My appointments' })).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('no-JavaScript and legacy pages preserve nonclinical boundaries', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('heading', { name: 'MedAssist academic prototype' })).toBeVisible();
  expect(await page.locator('noscript').textContent()).toContain('No clinical assessment');
  await page.goto('http://127.0.0.1:4173/legacy/index.html');
  await expect(page.locator('#triageAvailability')).toContainText('not available');
  await expect(page.locator('#triage input,#triage textarea,#triage select')).toHaveCount(0);
  await context.close();
});

for (const width of [320, 375, 768, 1024, 1440])
  test(`every public and role route renders without overflow at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const route of allRoutes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll, route).toBeLessThanOrEqual(dimensions.width + 1);
    }
    expect(errors).toEqual([]);
  });

for (const dark of [false, true])
  test(`key screens pass automated WCAG checks in ${dark ? 'dark' : 'light'} mode`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    for (const path of [
      '/',
      '/demo',
      '/app/patient/profile',
      '/app/patient/appointments',
      '/app/doctor/reviews',
      '/app/admin',
      '/app/admin/users',
      '/app/admin/analytics',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (dark) await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 30));
        }
        window.scrollTo(0, 0);
      });
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        path,
      ).toEqual([]);
    }
  });

test('dark validation errors remain readable and connected to their controls', async ({ page }) => {
  for (const path of ['/app/patient/profile', '/app/doctor/reviews']) {
    await page.goto(path);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    if (path.includes('profile')) {
      await page.getByRole('button', { name: 'Edit profile' }).click();
      await page.getByLabel('Fictional display alias').fill('');
      await page.getByRole('button', { name: 'Save demo profile' }).click();
    } else {
      await page.getByRole('button', { name: 'Record sample review' }).click();
    }
    await expect(page.getByRole('alert')).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
});
