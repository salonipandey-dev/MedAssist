// The reviewed Mathura listings against the real API and PostgreSQL, on a 375px phone
// (see playwright.fullstack.config.ts). The listings are real services recorded from
// official pages on 2026-11-17 (backend/app/datasets/mathura) and imported with
// `python -m app.import_consultations`.
//   @consultation-mathura  The fictional fixture was removed, the three Mathura files were
//                          imported, and FastAPI was restarted with
//                          MEDASSIST_CONSULTATION_PILOT=on and MEDASSIST_PILOT_AS_OF=2026-11-17.
import { expect, test, type Page } from '@playwright/test';

const API = process.env.FULLSTACK_API_ORIGIN ?? 'http://127.0.0.1:8000';
const ROUTE = '/app/patient/consultations';
const DIRECTORY = `${API}/api/v1/consultations`;
const ESANJEEVANI = [
  'eSanjeevani OPD: Government Medical Colleges (U.P.) Dermatology',
  'eSanjeevani OPD: Government Medical Colleges (U.P.) Obstetrics and Gynaecology',
  'eSanjeevani OPD: Government Medical Colleges (U.P.) Paediatrics',
  'eSanjeevani OPD: Government Medical Colleges (U.P.) Psychiatry',
  'eSanjeevani OPD: Uttar Pradesh General OPD',
];

const listings = (page: Page) =>
  page.getByRole('list', { name: 'Consultation listings' }).getByRole('listitem');
const listing = (page: Page, name: string) => listings(page).filter({ hasText: name });
const names = (page: Page) => listings(page).locator('strong');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search consultations' });

async function openDirectory(page: Page) {
  const response = page.waitForResponse(
    (r) => r.url().startsWith(DIRECTORY) && r.request().method() === 'GET',
  );
  await page.goto(ROUTE);
  const received = await response;
  expect(received.status()).toBe(200);
  return received.json();
}

async function expectNoSidewaysScroll(page: Page) {
  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

test.use({ viewport: { width: 375, height: 812 } });

test.describe('@consultation-mathura', () => {
  test('the browser reads the reviewed listings from PostgreSQL through FastAPI', async ({
    page,
  }) => {
    const body = await openDirectory(page);
    expect(body.dataset).toMatchObject({ mode: 'pilot', pilot_enabled: true, as_of: '2026-11-17' });
    expect(
      body.dataset.sources.map((s: { id: string; listing_count: number }) => [
        s.id,
        s.listing_count,
      ]),
    ).toEqual([
      ['mathura-esanjeevani-up', 5],
      ['mathura-esic', 1],
      ['mathura-tele-manas', 1],
    ]);
    expect(body.total).toBe(7);
    expect(body.items.every((item: { is_fictional: boolean }) => !item.is_fictional)).toBe(true);

    await expect(listings(page)).toHaveCount(7);
    const bar = page.locator('.consult-source');
    await expect(bar).toContainText('Pilot');
    await expect(bar).not.toContainText('fictional');
    await expect(bar).toContainText('Pilot listings for Mathura, Uttar Pradesh from 3 sources');
    await expect(bar).toContainText(API);
    await expect(page.getByText(/Fictional/)).toHaveCount(0);
    await expect(listings(page).locator('.consult-source-name')).toHaveCount(7);
    await expect(listings(page).locator('.consult-checked')).toHaveText(
      Array(7).fill('Checked 17 Nov 2026'),
    );
    await expectNoSidewaysScroll(page);
  });

  test('fee labels, eligibility, source links and reuse terms', async ({ page }) => {
    await openDirectory(page);

    const esic = listing(page, 'ESI Dispensary, Mathura');
    await expect(esic.locator('.consult-fee')).toHaveText('Free');
    await expect(esic.locator('.consult-eligibility')).toContainText(
      'Only for people insured under the ESI scheme',
    );
    await expect(esic.locator('.consult-source-name')).toHaveText(
      'Source: ESIC dispensary directory and Medical Benefit page',
    );
    const teleManas = listing(page, 'Tele MANAS mental health helpline');
    await expect(teleManas.locator('.consult-fee')).toHaveText('Fee not listed');
    await expect(teleManas).not.toContainText('Free');
    for (const name of ESANJEEVANI)
      await expect(listing(page, name).locator('.consult-fee')).toHaveText('Free');

    await esic.getByRole('button', { name: 'Details' }).click();
    const dialog = page.getByRole('dialog', { name: /ESI Dispensary, Mathura/ });
    await expect(dialog.getByRole('link', { name: /Open the source page/ })).toHaveAttribute(
      'href',
      'https://esic.gov.in/dispensaries',
    );
    await expect(dialog.getByRole('link', { name: /reuse terms/ })).toHaveAttribute(
      'href',
      'https://esic.gov.in/copyright-policy',
    );
    await expect(dialog).toContainText('Last checked 17 Nov 2026 · current until 15 Feb 2027');
    await expect(dialog).toContainText('ESIC Benefits page (reviewed 2026-10-09)');
    await page.keyboard.press('Escape');

    await listing(page, 'Uttar Pradesh General OPD')
      .getByRole('button', { name: 'Details' })
      .click();
    const opd = page.getByRole('dialog', { name: /Uttar Pradesh General OPD/ });
    await expect(opd.getByRole('link', { name: /Open the source page/ })).toHaveAttribute(
      'href',
      'https://esanjeevani.mohfw.gov.in/#/opd-timing',
    );
    await expect(opd).toContainText('Monday to Saturday, 9:00 AM to 5:00 PM');
    await expect(opd).toContainText("you don't have to pay anything");
  });

  test('search and combined filters are answered by the server', async ({ page }) => {
    await openDirectory(page);

    await search(page).fill('dermatology');
    await expect(names(page)).toHaveText([ESANJEEVANI[0]]);

    await search(page).fill('esanjeevani');
    await page.getByLabel('Mode').selectOption('Video');
    await page.getByLabel('Fee').selectOption({ label: 'Free (current source)' });
    await expect(names(page)).toHaveText(ESANJEEVANI);
    await page.getByLabel('Specialty').selectOption('Psychiatry');
    await expect(names(page)).toHaveText([ESANJEEVANI[3]]);

    await search(page).fill('');
    await page.getByLabel('Specialty').selectOption('All specialties');
    await page.getByLabel('Mode').selectOption('Phone');
    await page.getByLabel('Fee').selectOption('Fee not listed');
    await expect(names(page)).toHaveText(['Tele MANAS mental health helpline']);

    await page.getByLabel('Mode').selectOption('In person');
    await expect(listings(page)).toHaveCount(0);
    await expect(page.getByText('No listings match')).toBeVisible();
    await page.getByLabel('Fee').selectOption('Up to ₹300');
    await expect(names(page)).toHaveText(['ESI Dispensary, Mathura']);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(listings(page)).toHaveCount(7);
  });

  test('compare three and the fourth-selection message at 375px', async ({ page }) => {
    await openDirectory(page);
    for (const name of [
      'ESI Dispensary, Mathura',
      'Tele MANAS mental health helpline',
      'Uttar Pradesh General OPD',
    ])
      await listing(page, name)
        .getByRole('button', { name: /^Compare / })
        .click();

    const table = page.getByRole('table', { name: 'consultation comparison' });
    await expect(table.getByRole('columnheader')).toHaveCount(4);
    await expect(table).toContainText('Fee not listed');
    await expect(table).toContainText('Only for people insured under the ESI scheme');
    await expect(table).toContainText('Last checked 17 Nov 2026 · current until 15 Feb 2027');

    const fourth = listing(page, ESANJEEVANI[2]);
    await fourth.getByRole('button', { name: /^Compare / }).click();
    await expect(fourth.getByRole('status')).toContainText('You can compare up to 3 options');
    await expect(table.getByRole('columnheader')).toHaveCount(4);
    await expectNoSidewaysScroll(page);
  });
});
