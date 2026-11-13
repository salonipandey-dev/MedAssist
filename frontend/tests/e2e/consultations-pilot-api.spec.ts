// Find Consultations with the consultation pilot switched on, against a mocked API.
// Every request to the compiled-in API origin is answered from
// fixtures/consultations-pilot.json: the page the real endpoint returns for the
// FICTIONAL pilot fixture (backend/app/fixtures/consultation_pilot_fixture.json) with
// MEDASSIST_CONSULTATION_PILOT=on and MEDASSIST_PILOT_AS_OF=2026-11-13. A backend
// PostgreSQL test keeps that file identical to the API output. No listing here is real.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fixture from './fixtures/consultations-pilot.json' with { type: 'json' };

const API = 'http://medassist-api.test';
const ROUTE = '/app/patient/consultations';
type Listing = (typeof fixture.items)[number];

/** The server's filter rules. A stale "free" listing is already served as unknown. */
function search(params: URLSearchParams) {
  const terms = (params.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const specialty = params.get('specialty')?.toLowerCase();
  const mode = params.get('mode');
  const feeState = params.get('fee_state');
  const maxFee = params.get('max_fee_minor');
  const items = fixture.items.filter((item: Listing) => {
    const text = `${item.provider_name} ${item.specialty} ${item.area}`.toLowerCase();
    return (
      terms.every((term) => text.includes(term)) &&
      (!specialty || item.specialty.toLowerCase() === specialty) &&
      (!mode || item.modes.includes(mode)) &&
      (!feeState || item.fee.state === feeState) &&
      (maxFee === null || (item.fee.amount_minor !== null && item.fee.amount_minor <= +maxFee))
    );
  });
  return { ...fixture, items, total: items.length, limit: 50 };
}

async function mockPilot(page: Page) {
  const queries: string[] = [];
  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    queries.push(`${route.request().method()} ${url.pathname}${url.search}`);
    return route.fulfill({
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'X-Request-ID',
        'x-request-id': `pilot-${queries.length}`,
      },
      json: search(url.searchParams),
    });
  });
  return queries;
}

const listings = (page: Page) =>
  page.getByRole('list', { name: 'Consultation listings' }).getByRole('listitem');
const listing = (page: Page, name: string) => listings(page).filter({ hasText: name });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test('pilot fixture: known fee, current free fee with eligibility, unknown fee and a stale listing', async ({
  page,
}) => {
  const queries = await mockPilot(page);
  await page.goto(ROUTE);

  await expect(listings(page)).toHaveCount(6);
  const source = page.locator('.consult-source');
  await expect(source).toContainText('Pilot · fictional fixture');
  await expect(source).toContainText('Sample District (fictional)');
  await expect(source).toContainText('Pilot test fixture (fictional), version 2026.11-fixture-1');
  await expect(page.getByText('Fictional pilot fixture.')).toBeVisible();
  await expect(listings(page).getByText('Fictional test fixture')).toHaveCount(6);
  expect(queries).toEqual(['GET /api/v1/consultations?limit=50']);

  const known = listing(page, 'Fixture Civil Hospital OPD');
  await expect(known.locator('.consult-fee')).toHaveText('₹10 (fixture)');
  await expect(known).toContainText('Checked 2 Nov 2026');

  const free = listing(page, 'Fixture Health and Wellness Centre');
  await expect(free.locator('.consult-fee')).toHaveText('Free (fixture)');
  await expect(free.locator('.consult-eligibility')).toHaveText(
    'Eligibility: Free for residents of Ward 4 who register with an identity document (fixture condition).',
  );

  await expect(
    listing(page, 'Fixture Teleconsultation Service').locator('.consult-fee'),
  ).toHaveText('Fee not listed (fixture)');

  const stale = listing(page, 'Fixture Child Health Camp');
  await expect(stale.locator('.consult-fee')).toHaveText('Needs recheck (fixture)');
  await expect(stale.locator('.consult-recheck')).toHaveText('Needs recheck');
  await expect(stale).not.toContainText('Free');
  await expect(stale.locator('.consult-eligibility')).toContainText('Children under 12 only');
  await expect(listing(page, 'Fixture ENT Outpatient').locator('.consult-recheck')).toBeVisible();

  // The Free filter is labelled for current sources and never returns the stale camp.
  await page.getByLabel('Fee').selectOption({ label: 'Free (current source)' });
  await expect(listings(page)).toHaveCount(1);
  await expect(listings(page)).toContainText('Fixture Health and Wellness Centre');
  expect(queries.at(-1)).toBe('GET /api/v1/consultations?fee_state=free&limit=50');

  await page.getByLabel('Fee').selectOption('Fee not listed');
  await expect(listings(page)).toHaveCount(2);
  await expect(listings(page).locator('strong')).toHaveText([
    'Fixture Child Health Camp (fictional)',
    'Fixture Teleconsultation Service (fictional)',
  ]);
});

test('pilot fixture: details show the source link, check date and reuse basis', async ({
  page,
}) => {
  await mockPilot(page);
  await page.goto(ROUTE);

  await listing(page, 'Fixture Health and Wellness Centre')
    .getByRole('button', { name: 'Details' })
    .click();
  let dialog = page.getByRole('dialog', { name: /Fixture Health and Wellness Centre/ });
  await expect(dialog).toContainText('Fictional pilot fixture · invented test values');
  const link = dialog.getByRole('link', { name: /Open the source page/ });
  await expect(link).toHaveAttribute(
    'href',
    'https://pilot-source.example.org/facilities/wellness-ward-4',
  );
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(dialog).toContainText('Last checked 2 Nov 2026 · current until 31 Jan 2027');
  await expect(dialog).toContainText('Free (fixture)');
  await expect(dialog).toContainText('Free for residents of Ward 4');
  await expect(dialog).toContainText('Reuse basis: FICTIONAL TEST DATA');
  await page.keyboard.press('Escape');

  await listing(page, 'Fixture Child Health Camp').getByRole('button', { name: 'Details' }).click();
  dialog = page.getByRole('dialog', { name: /Fixture Child Health Camp/ });
  await expect(dialog.getByRole('link', { name: /Open the source page/ })).toHaveAttribute(
    'href',
    'https://pilot-source.example.org/facilities/child-camp',
  );
  await expect(dialog).toContainText('Last checked 1 Jun 2026 · Needs recheck');
  await expect(dialog).toContainText('hides the Free label until the listing is rechecked');
});

test('pilot fixture: compare three on a 390px phone without page overflow', async ({ page }) => {
  await mockPilot(page);
  await page.goto(ROUTE);
  for (const name of [
    'Fixture Civil Hospital OPD',
    'Fixture Health and Wellness Centre',
    'Fixture Child Health Camp',
  ])
    await listing(page, name)
      .getByRole('button', { name: /^Compare / })
      .click();

  const table = page.getByRole('table', { name: 'consultation comparison' });
  await expect(table.getByRole('columnheader')).toHaveCount(4);
  await expect(table).toContainText('₹10 (fixture)');
  await expect(table).toContainText('Free (fixture)');
  await expect(table).toContainText('Needs recheck (fixture)');
  await expect(table).toContainText('Children under 12 only (fixture condition).');
  await expect(table).toContainText('Last checked 1 Jun 2026 · Needs recheck');

  const fourth = listing(page, 'Fixture Skin Clinic');
  await fourth.getByRole('button', { name: /^Compare / }).click();
  await expect(fourth.getByRole('status')).toContainText('You can compare up to 3 options');
  await expect(page.getByRole('button', { name: /^Comparing / })).toHaveCount(3);

  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});

for (const dark of [false, true])
  test(`pilot fixture page and details pass WCAG checks in ${dark ? 'dark' : 'light'} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await mockPilot(page);
    await page.goto(ROUTE);
    await expect(listings(page)).toHaveCount(6);
    await listing(page, 'Fixture Child Health Camp')
      .getByRole('button', { name: /^Compare / })
      .click();

    const axe = () =>
      new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const violations = (result: Awaited<ReturnType<typeof axe>>) =>
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
    expect(violations(await axe())).toEqual([]);

    await listing(page, 'Fixture Child Health Camp')
      .getByRole('button', { name: 'Details' })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(violations(await axe())).toEqual([]);
  });
