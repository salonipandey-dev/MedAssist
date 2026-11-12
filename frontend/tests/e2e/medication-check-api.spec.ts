// "Check my saved profile" on Medication Info against a mocked account API (see
// playwright.config.ts). The answers below follow docs/MEDICATION_CHECK_API.md; the real
// rules, sessions and saved profiles are proven by the backend suite and the full-stack run.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const API = 'http://medassist-api.test';
const ROUTE = '/app/patient/medications';
const fixture = {
  id: 'medassist-fictional-medication-rules',
  version: '1.0.0',
  is_fictional: true,
};
const entry = (section: string, name: string, id: string) => ({
  section,
  entry: name,
  matched_id: id,
  matched_name: name,
});
const WARNING_AND_GAP = {
  fixture,
  profile_version: 3,
  outcome: 'matches_found',
  complete: false,
  matches: [
    {
      rule_id: 'DEMO-DUP-001',
      check: 'duplicate_ingredient',
      title: 'Same ingredient in two recorded medicines',
      explanation: 'Two recorded medicines list the same invented ingredient in the demo dataset.',
      entries: [
        entry('medicines', 'Brivanol 250 tablets', 'prd-brivanol-250'),
        entry('medicines', 'Coldaway Day Relief', 'prd-coldaway-day'),
      ],
      ingredients: ['brivanol'],
    },
  ],
  unresolved: [
    {
      section: 'medicines',
      entry: 'Coldaway',
      reason: 'ambiguous',
      candidates: ['Coldaway Day Relief', 'Coldaway Night Relief'],
    },
  ],
  missing: [
    { section: 'conditions', reason: 'not_recorded', affected_checks: ['medicine_condition'] },
  ],
  recognised: [
    entry('medicines', 'Brivanol 250 tablets', 'prd-brivanol-250'),
    entry('medicines', 'Coldaway Day Relief', 'prd-coldaway-day'),
  ],
};

async function mockApi(page: Page, signedIn = true) {
  const requests: string[] = [];
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}${url.search}`);
    const headers = {
      'access-control-allow-origin': request.headers()['origin'] ?? '*',
      'access-control-allow-credentials': 'true',
      'cache-control': 'no-store',
    };
    if (!signedIn)
      return route.fulfill({
        status: 401,
        headers,
        json: { code: 'not_signed_in', detail: 'Sign in to continue.' },
      });
    if (url.pathname === '/api/v1/auth/session')
      return route.fulfill({
        headers,
        json: {
          account: {
            display_name: 'Patient A (fictional)',
            email: 'patient.a@example.test',
            role: 'patient',
          },
          csrf_token: 'mock-csrf-token-0123456789-abcdefghijklmnop',
          expires_at: '2026-11-12T20:00:00Z',
          idle_expires_at: '2026-11-12T12:30:00Z',
        },
      });
    if (url.pathname === '/api/v1/me/medication-check')
      return route.fulfill({ headers, json: WARNING_AND_GAP });
    return route.fulfill({ status: 404, headers, json: { detail: 'Not Found' } });
  });
  return requests;
}

const checkPanel = (page: Page) => page.getByRole('region', { name: 'Check my saved profile' });

test('shows the matched rule, the gaps and the way back to the Health Profile', async ({
  page,
}) => {
  const requests = await mockApi(page);
  await page.goto(ROUTE);
  const panel = checkPanel(page);
  await expect(panel.getByText('Signed in as')).toContainText('Patient A (fictional)');
  expect(requests).not.toContain('GET /api/v1/me/medication-check');

  await panel.getByRole('button', { name: 'Check my saved profile' }).click();

  await expect(panel.getByRole('heading', { name: '1 demo rule matched' })).toBeVisible();
  const warning = panel.getByRole('list', { name: 'Matched demo rules' }).getByRole('listitem');
  await expect(warning).toContainText('Brivanol 250 tablets (medicine) · Coldaway Day Relief');
  await expect(warning).toContainText('DEMO-DUP-001');
  await expect(panel.getByRole('heading', { name: 'More information needed' })).toBeVisible();
  await expect(
    panel.getByRole('list', { name: 'What the demo rules could not check' }),
  ).toContainText('could mean Coldaway Day Relief or Coldaway Night Relief');
  await expect(panel.getByText('Fictional demo').first()).toBeVisible();
  await expect(panel).toContainText('ask a pharmacist or clinician');
  expect(requests.filter((r) => r.startsWith('GET /api/v1/me/medication-check'))).toEqual([
    'GET /api/v1/me/medication-check',
  ]);

  await panel.getByRole('link', { name: 'Update your Health Profile' }).click();
  await expect(page).toHaveURL(/\/app\/patient\/health-profile$/);
});

test('a signed-out visitor is offered sign-in and the scripted examples still work', async ({
  page,
}) => {
  const requests = await mockApi(page, false);
  await page.goto(ROUTE);

  await expect(checkPanel(page).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/sign-in?next=%2Fapp%2Fpatient%2Fmedications',
  );
  await expect(page.getByText('Possible issue (scripted)')).toBeVisible();
  expect(requests).toEqual(['GET /api/v1/auth/session']);
});

for (const dark of [false, true])
  test(`the check result fits and passes WCAG checks in ${dark ? 'dark' : 'light'} mode`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await mockApi(page);
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ROUTE);
      await checkPanel(page).getByRole('button', { name: 'Check my saved profile' }).click();
      await expect(
        checkPanel(page).getByRole('heading', { name: '1 demo rule matched' }),
      ).toBeVisible();
      const size = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(size.scroll, `${width}px`).toBeLessThanOrEqual(size.width + 1);
      if (width === 390 || width === 1440) {
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(
          result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          `${width}px`,
        ).toEqual([]);
      }
    }
  });
