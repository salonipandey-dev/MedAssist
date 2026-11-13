// Consultation pilot proof against the real API and PostgreSQL (see
// playwright.fullstack.config.ts). The pilot data is the FICTIONAL fixture
// backend/app/fixtures/consultation_pilot_fixture.json, imported with
// `python -m app.import_consultations`; no listing here is a real provider.
//   @consultation-demo  FastAPI runs with the pilot off (the default).
//   @consultation-pilot FastAPI was restarted with MEDASSIST_CONSULTATION_PILOT=on and
//                       MEDASSIST_PILOT_AS_OF=2026-11-13 after the fixture was imported.
import { expect, test, type Page } from '@playwright/test';

const API = process.env.FULLSTACK_API_ORIGIN ?? 'http://127.0.0.1:8000';
const ROUTE = '/app/patient/consultations';
const DIRECTORY = `${API}/api/v1/consultations`;

const listings = (page: Page) =>
  page.getByRole('list', { name: 'Consultation listings' }).getByRole('listitem');
const listing = (page: Page, name: string) => listings(page).filter({ hasText: name });

/** Open the screen and return the directory response the browser received. */
async function openDirectory(page: Page) {
  const response = page.waitForResponse(
    (r) => r.url().startsWith(DIRECTORY) && r.request().method() === 'GET',
  );
  await page.goto(ROUTE);
  const received = await response;
  expect(received.status()).toBe(200);
  return received.json();
}

test.describe('@consultation-demo', () => {
  test('with the pilot off the server and browser show only the fictional demo', async ({
    page,
  }) => {
    const body = await openDirectory(page);
    expect(body.dataset).toMatchObject({ mode: 'demo', pilot_enabled: false });
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([
      'c-01',
      'c-02',
      'c-03',
      'c-04',
      'c-05',
      'c-06',
      'c-07',
      'c-08',
      'c-09',
    ]);

    await expect(listings(page)).toHaveCount(9);
    await expect(page.locator('.consult-source')).toContainText('Fictional demo');
    await expect(listings(page).getByText('Fictional record')).toHaveCount(9);
    expect(JSON.stringify(body)).not.toContain('pilot-fixture');

    const pilot = await page.request.get(`${DIRECTORY}?dataset=pilot`);
    expect(pilot.status()).toBe(404);
  });
});

test.describe('@consultation-pilot', () => {
  test('the browser loads the imported fixture listings from PostgreSQL through FastAPI', async ({
    page,
  }) => {
    const body = await openDirectory(page);
    expect(body.dataset).toMatchObject({
      mode: 'pilot',
      pilot_enabled: true,
      freshness_days: 90,
      as_of: '2026-11-13',
    });
    // Written by the import, in the same transaction as the rows.
    expect(body.dataset.sources).toHaveLength(1);
    expect(body.dataset.sources[0]).toMatchObject({
      id: 'pilot-fixture-sample-district',
      kind: 'pilot_fixture',
      listing_count: 6,
    });
    expect(body.dataset.sources[0].imported_at).toEqual(expect.any(String));

    await expect(listings(page)).toHaveCount(6);
    await expect(page.locator('.consult-source')).toContainText('Pilot · fictional fixture');
    await expect(page.locator('.consult-source')).toContainText(API);
    await expect(listings(page).getByText('Fictional test fixture')).toHaveCount(6);

    // The demo stays available on request.
    const demo = await (await page.request.get(`${DIRECTORY}?dataset=demo`)).json();
    expect(demo.dataset.mode).toBe('demo');
    expect(demo.total).toBe(9);
  });

  test('known, verified free with eligibility, unknown and stale fees', async ({ page }) => {
    await openDirectory(page);

    await expect(listing(page, 'Fixture Civil Hospital OPD').locator('.consult-fee')).toHaveText(
      '₹10 (fixture)',
    );
    const free = listing(page, 'Fixture Health and Wellness Centre');
    await expect(free.locator('.consult-fee')).toHaveText('Free (fixture)');
    await expect(free.locator('.consult-eligibility')).toContainText(
      'Free for residents of Ward 4',
    );
    await expect(
      listing(page, 'Fixture Teleconsultation Service').locator('.consult-fee'),
    ).toHaveText('Fee not listed (fixture)');
    const stale = listing(page, 'Fixture Child Health Camp');
    await expect(stale.locator('.consult-fee')).toHaveText('Needs recheck (fixture)');
    await expect(stale.locator('.consult-recheck')).toHaveText('Needs recheck');
    await expect(stale).not.toContainText('Free');

    // The server applies the freshness rule in SQL: Free never returns the stale camp.
    await page.getByLabel('Fee').selectOption({ label: 'Free (current source)' });
    await expect(listings(page)).toHaveCount(1);
    await expect(listings(page)).toContainText('Fixture Health and Wellness Centre');
    await page.getByLabel('Fee').selectOption('Fee not listed');
    await expect(listings(page)).toHaveCount(2);

    await page.getByLabel('Fee').selectOption('Any');
    await listing(page, 'Fixture Child Health Camp')
      .getByRole('button', { name: 'Details' })
      .click();
    const dialog = page.getByRole('dialog', { name: /Fixture Child Health Camp/ });
    await expect(dialog.getByRole('link', { name: /Open the source page/ })).toHaveAttribute(
      'href',
      'https://pilot-source.example.org/facilities/child-camp',
    );
    await expect(dialog).toContainText('Last checked 1 Jun 2026 · Needs recheck');
    await expect(dialog).toContainText('Children under 12 only (fixture condition).');
  });

  test('comparison of three works on a 390px phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDirectory(page);
    for (const name of [
      'Fixture Civil Hospital OPD',
      'Fixture Health and Wellness Centre',
      'Fixture Teleconsultation Service',
    ])
      await listing(page, name)
        .getByRole('button', { name: /^Compare / })
        .click();

    const table = page.getByRole('table', { name: 'consultation comparison' });
    await expect(table.getByRole('columnheader')).toHaveCount(4);
    await expect(table).toContainText('Last checked 2 Nov 2026 · current until 31 Jan 2027');
    await expect(table).toContainText('Fee not listed (fixture)');
    const fourth = listing(page, 'Fixture Skin Clinic');
    await fourth.getByRole('button', { name: /^Compare / }).click();
    await expect(fourth.getByRole('status')).toContainText('You can compare up to 3 options');

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
