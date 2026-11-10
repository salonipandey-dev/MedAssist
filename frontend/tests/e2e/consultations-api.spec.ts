// Find Consultations against a mocked directory API. This build has an API origin
// compiled in (see playwright.config.ts); every request to it is answered here from a
// payload captured from the real endpoint, so these tests prove the browser's side of
// the contract, not PostgreSQL.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fixture from './fixtures/consultations.json' with { type: 'json' };

const API = 'http://medassist-api.test';
const ROUTE = '/app/patient/consultations';
type Listing = (typeof fixture.items)[number];

/** The server's documented filter rules, applied to the captured records. */
function search(items: Listing[], params: URLSearchParams) {
  const terms = (params.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const specialty = params.get('specialty')?.toLowerCase();
  const mode = params.get('mode');
  const feeState = params.get('fee_state');
  const maxFee = params.get('max_fee_minor');
  const matches = items.filter((item) => {
    const text = `${item.provider_name} ${item.specialty} ${item.area}`.toLowerCase();
    return (
      terms.every((term) => text.includes(term)) &&
      (!specialty || item.specialty.toLowerCase() === specialty) &&
      (!mode || item.modes.includes(mode)) &&
      (!feeState || item.fee.state === feeState) &&
      (maxFee === null || (item.fee.amount_minor !== null && item.fee.amount_minor <= +maxFee))
    );
  });
  return { items: matches, total: matches.length, limit: 50, offset: 0 };
}

async function mockDirectory(page: Page) {
  const directory = {
    items: structuredClone(fixture.items) as Listing[],
    /** 'ok' answers from `items`; the others fail the next requests. */
    mode: 'ok' as 'ok' | 'unavailable' | 'offline',
    requests: [] as { method: string; url: URL }[],
    queries: () => directory.requests.map((request) => request.url.search),
  };
  let served = 0;
  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    directory.requests.push({ method: route.request().method(), url });
    if (directory.mode === 'offline') return route.abort('connectionrefused');
    const requestId = `e2e-request-${++served}`;
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'X-Request-ID',
      'x-request-id': requestId,
    };
    if (directory.mode === 'unavailable')
      return route.fulfill({
        status: 503,
        headers,
        json: {
          detail: 'The consultation directory is temporarily unavailable. Please try again later.',
          request_id: requestId,
        },
      });
    return route.fulfill({ headers, json: search(directory.items, url.searchParams) });
  });
  return directory;
}

const listings = (page: Page) =>
  page.getByRole('list', { name: 'Consultation listings' }).getByRole('listitem');
const names = (page: Page) => listings(page).locator('strong').allTextContents();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
});

test('lists API records, labels them fictional and filters on the server', async ({ page }) => {
  const directory = await mockDirectory(page);
  await page.goto(ROUTE);

  await expect(listings(page)).toHaveCount(9);
  await expect(page.getByRole('heading', { name: 'Consultation directory' })).toBeVisible();
  await expect(page.locator('.consult-source')).toContainText(API);
  await expect(page.locator('.panel-heading p').first()).toHaveText('9 listings');
  await expect(listings(page).getByText('Fictional record')).toHaveCount(9);
  expect(directory.queries()).toEqual(['?limit=50']);

  // "Up to ₹300" includes the ₹300 listing and the free examples, never unknown fees.
  await page.getByLabel('Fee').selectOption('Up to ₹300');
  await expect(listings(page)).toHaveCount(4);
  expect(await names(page)).toEqual([
    'Riverside Family Clinic (fictional)',
    'Lakeview Teleconsult (fictional)',
    'Sample Community Health Camp (fictional)',
    'Civic Polyclinic OPD (fictional)',
  ]);
  await expect(listings(page).first()).toContainText('₹300 (illustrative)');
  await expect(page.locator('.panel-heading p').first()).toHaveText('4 matching listings');
  expect(directory.queries().at(-1)).toBe('?max_fee_minor=30000&limit=50');

  await page.getByLabel('Fee').selectOption('Free (illustrative)');
  await expect(listings(page)).toHaveCount(2);
  await expect(listings(page).first()).toContainText('Free (illustrative, not verified)');
  expect(directory.queries().at(-1)).toBe('?fee_state=free&limit=50');

  await page.getByLabel('Fee').selectOption('Fee not listed');
  await expect(listings(page)).toHaveCount(2);
  await expect(listings(page).first()).toContainText('Not listed in sample');
  expect(directory.queries().at(-1)).toBe('?fee_state=unknown&limit=50');

  await page.getByLabel('Specialty').selectOption('Dermatology');
  await page.getByLabel(/^Mode/).selectOption('Video');
  await expect(listings(page)).toHaveCount(1);
  await expect(listings(page)).toContainText('Brightline Online Dermatology (fictional)');
  expect(directory.queries().at(-1)).toBe(
    '?specialty=Dermatology&mode=video&fee_state=unknown&limit=50',
  );
});

test('debounces search, shows an empty result and resets with one control', async ({ page }) => {
  const directory = await mockDirectory(page);
  await page.goto(ROUTE);
  await expect(listings(page)).toHaveCount(9);

  const searchBox = page.getByRole('searchbox', { name: 'Search consultations' });
  await searchBox.pressSequentially('Riverside  CLINIC', { delay: 20 });
  await expect(listings(page)).toHaveCount(2);
  expect(await names(page)).toEqual([
    'Riverside Family Clinic (fictional)',
    'Little Steps Children’s Clinic (fictional)',
  ]);
  // One request for the finished text, not one per keystroke.
  expect(directory.queries()).toEqual(['?limit=50', '?q=Riverside+CLINIC&limit=50']);

  await searchBox.fill('no-such-provider');
  await expect(page.getByRole('heading', { name: 'No listings match' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.panel-heading p').first()).toHaveText('0 matching listings');

  const clear = page.getByRole('button', { name: 'Clear filters', exact: true });
  await expect(clear).toHaveCount(1);
  await clear.press('Enter');
  await expect(listings(page)).toHaveCount(9);
  await expect(searchBox).toBeFocused();
});

test('shows a changed record after the page is refreshed', async ({ page }) => {
  const directory = await mockDirectory(page);
  await page.goto(ROUTE);
  await expect(listings(page).filter({ hasText: 'Harbour ENT Centre' })).toContainText(
    'Harbour Road, Sample City',
  );

  directory.items.find((item) => item.id === 'c-07')!.area = 'Lighthouse Quay, Sample City';
  await page.reload();

  await expect(listings(page).filter({ hasText: 'Harbour ENT Centre' })).toContainText(
    'Lighthouse Quay, Sample City',
  );
});

test('keeps a failure visible in the API view and recovers on Retry', async ({ page }) => {
  const directory = await mockDirectory(page);
  directory.mode = 'unavailable';
  await page.goto(ROUTE);

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Directory temporarily unavailable');
  await expect(alert).toContainText('Request ID: e2e-request-1');
  await expect(page.getByRole('list')).toHaveCount(0);
  await expect(page.getByText('Offline demo directory')).toHaveCount(0);
  await expect(page.locator('.consult-source')).toContainText('Directory API');
  const failed = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(failed.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );

  // Still failing: the error stays, with the new request's ID.
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(alert).toContainText('Request ID: e2e-request-2');

  directory.mode = 'ok';
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(listings(page)).toHaveCount(9);
  await expect(page.getByRole('alert')).toHaveCount(0);

  // A later request that cannot connect replaces the list instead of leaving stale rows.
  directory.mode = 'offline';
  await page.getByLabel('Specialty').selectOption('ENT');
  await expect(page.getByRole('alert')).toContainText('Could not reach the directory API');
  await expect(page.getByRole('list')).toHaveCount(0);
  directory.mode = 'ok';
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(listings(page)).toHaveCount(1);
});

test('keeps a failing API apart from the offline demo', async ({ page }) => {
  const directory = await mockDirectory(page);
  directory.mode = 'unavailable';
  await page.goto(ROUTE);
  await expect(page.getByRole('alert')).toBeVisible();

  await page.getByRole('button', { name: 'Open offline demo' }).click();
  await expect(page).toHaveURL(/source=offline$/);
  await expect(page.getByRole('heading', { name: 'Offline demo directory' })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Sample consultation options' }).getByRole('listitem'),
  ).toHaveCount(9);
  const before = directory.requests.length;
  await page.getByLabel('Fee').selectOption('Up to ₹300');
  expect(directory.requests).toHaveLength(before);

  await page.getByRole('button', { name: 'Use directory API' }).click();
  await expect(page.getByRole('alert')).toContainText('Directory temporarily unavailable');
});

test('limits comparison to three at 375px and keeps selections across filters', async ({
  page,
}) => {
  await mockDirectory(page);
  await page.goto(ROUTE);
  const compare = page.getByRole('button', { name: /^Compare / });
  for (let i = 0; i < 3; i++) await compare.first().click();
  const table = page.getByRole('table', { name: 'consultation comparison' });
  await expect(table.getByRole('columnheader')).toHaveCount(4);
  await expect(table).toContainText('Illustrative fee for a first consultation.');

  const fourth = listings(page).filter({ hasText: 'Northgate Hospital Outpatients' });
  await fourth.getByRole('button', { name: /^Compare / }).click();
  const limitMessage = fourth.getByRole('status');
  await expect(limitMessage).toContainText('You can compare up to 3 options');
  await expect(limitMessage).toBeInViewport();
  await expect(page.getByRole('button', { name: /^Comparing / })).toHaveCount(3);

  // The selected listings stay in the comparison when a filter hides them.
  await page.getByLabel('Specialty').selectOption('Dermatology');
  await expect(listings(page)).toHaveCount(2);
  await expect(table.getByRole('columnheader')).toHaveCount(4);
  await expect(table).toContainText('Riverside Family Clinic (fictional)');
  await expect(page.getByRole('button', { name: /^Comparing / })).toHaveCount(0);
  const hidden = listings(page).filter({ hasText: 'Brightline Online Dermatology' });
  await hidden.getByRole('button', { name: /^Compare / }).click();
  await expect(hidden.getByRole('status')).toContainText('You can compare up to 3 options');

  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Comparing / })).toHaveCount(3);
  await page
    .getByRole('button', { name: /^Remove .* from comparison$/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /^Comparing / })).toHaveCount(2);
  await expect(table.getByRole('columnheader')).toHaveCount(3);

  const scroll = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scroll[0]).toBeLessThanOrEqual(scroll[1] + 1);
});

test('explains the limit inside the details dialog at 375px and allows a retry', async ({
  page,
}) => {
  await mockDirectory(page);
  await page.goto(ROUTE);
  const compare = page.getByRole('button', { name: /^Compare / });
  for (let i = 0; i < 3; i++) await compare.first().click();

  const details = listings(page)
    .filter({ hasText: 'Northgate Hospital Outpatients' })
    .getByRole('button', { name: 'Details' });
  const dialog = page.getByRole('dialog', { name: /Northgate Hospital Outpatients/ });
  const add = dialog.getByRole('button', { name: 'Add to comparison' });
  const status = dialog.getByRole('status');
  await details.click();
  await expect(dialog).toContainText('Illustrative registration and consultation fee.');
  await expect(dialog).toContainText('fictional record, not externally verified');
  await add.click();
  await expect(status).toContainText('You can compare up to 3 options');
  await expect(status).toBeInViewport();

  await page.keyboard.press('Escape');
  await expect(details).toBeFocused();
  await expect(listings(page).getByRole('button', { pressed: true })).toHaveCount(3);

  await page
    .getByRole('button', { name: /^Remove .* from comparison$/ })
    .first()
    .click();
  await details.click();
  await expect(status).toBeEmpty();
  await add.click();
  await expect(dialog.getByRole('button', { name: 'Remove from comparison' })).toBeVisible();
  await expect(status).toBeEmpty();
});

test('API view only reads: GET requests, no storage and accessible in both themes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error('Unexpected persistent storage write');
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const directory = await mockDirectory(page);
  await page.goto(ROUTE);
  await expect(listings(page)).toHaveCount(9);
  await page.getByLabel(/^Mode/).selectOption('Phone');
  await expect(listings(page)).toHaveCount(1);
  await listings(page)
    .getByRole('button', { name: /^Compare / })
    .click();

  for (const dark of [false, true]) {
    if (dark) await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      dark ? 'dark' : 'light',
    ).toEqual([]);
  }

  expect(errors).toEqual([]);
  expect(directory.requests.length).toBeGreaterThan(0);
  for (const request of directory.requests) {
    expect(request.method).toBe('GET');
    expect(request.url.pathname).toBe('/api/v1/consultations');
  }
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});
