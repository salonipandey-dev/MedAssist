// Release-candidate consultation journey (MA-07) against the real API and PostgreSQL,
// on a 375px phone screen with the pilot off (the default). Every listing is the
// fictional seed. See docs/RELEASE_CANDIDATE.md for the same steps by hand on Windows.
//
// The outage test stops and restarts FastAPI itself. It needs:
//   RC_API_PID_FILE  file holding the running uvicorn process ID (rewritten on restart)
//   RC_BACKEND_DIR   the backend folder, to start uvicorn from
//   RC_API_LOG       where the restarted server writes its log
// Without RC_API_PID_FILE that test is skipped.
import { spawn } from 'node:child_process';
import { openSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const API = process.env.FULLSTACK_API_ORIGIN ?? 'http://127.0.0.1:8000';
const ROUTE = '/app/patient/consultations';
const PID_FILE = process.env.RC_API_PID_FILE;

const listings = (page: Page) =>
  page.getByRole('list', { name: 'Consultation listings' }).getByRole('listitem');
const listing = (page: Page, name: string) => listings(page).filter({ hasText: name });
const names = (page: Page) => listings(page).locator('strong');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search consultations' });

async function expectNoSidewaysScroll(page: Page) {
  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

async function apiAnswers() {
  try {
    return (await fetch(`${API}/health`, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
}

test.use({ viewport: { width: 375, height: 812 } });

test.describe('@rc-consultations', () => {
  test('search, combined filters, compare three and the fourth-selection message at 375px', async ({
    page,
  }) => {
    await page.goto(ROUTE);
    await expect(listings(page)).toHaveCount(9);
    await expect(page.locator('.consult-source')).toContainText('Fictional demo');

    // Search alone, then search combined with two filters.
    await search(page).fill('sample city');
    await expect(listings(page)).toHaveCount(7);
    await page.getByLabel('Specialty').selectOption('General practice');
    await expect(names(page)).toHaveText([
      'Riverside Family Clinic (fictional)',
      'Sample Community Health Camp (fictional)',
    ]);
    await page.getByLabel('Fee').selectOption('Free (illustrative)');
    await expect(names(page)).toHaveText(['Sample Community Health Camp (fictional)']);
    await expect(listings(page).locator('.consult-fee')).toHaveText(
      'Free (illustrative, not verified)',
    );

    await page.getByLabel('Specialty').selectOption('Internal medicine');
    await expect(names(page)).toHaveText(['Civic Polyclinic OPD (fictional)']);
    await page.getByLabel('Specialty').selectOption('ENT');
    await expect(listings(page)).toHaveCount(0);
    await expect(page.getByText('No listings match')).toBeVisible();

    await search(page).fill('');
    await page.getByLabel('Specialty').selectOption('All specialties');
    await page.getByLabel('Fee').selectOption('Any');
    await expect(listings(page)).toHaveCount(9);

    // Compare three, then try a fourth.
    for (const name of [
      'Riverside Family Clinic',
      'Lakeview Teleconsult',
      'Sample Community Health Camp',
    ])
      await listing(page, name)
        .getByRole('button', { name: /^Compare / })
        .click();
    const table = page.getByRole('table', { name: 'consultation comparison' });
    await expect(table.getByRole('columnheader')).toHaveCount(4);
    await expect(table).toContainText('₹300 (illustrative)');
    await expect(table).toContainText('₹199 (illustrative)');
    await expect(table).toContainText('Free (illustrative, not verified)');

    const fourth = listing(page, 'Northgate Hospital Outpatients');
    await fourth.getByRole('button', { name: /^Compare / }).click();
    await expect(fourth.getByRole('status')).toContainText(
      'You can compare up to 3 options. Remove one to add another.',
    );
    await expect(page.getByRole('button', { name: /^Comparing / })).toHaveCount(3);
    await expect(table.getByRole('columnheader')).toHaveCount(4);
    await expectNoSidewaysScroll(page);
  });

  test('with FastAPI stopped the screen shows an error, and Retry loads listings once it is back', async ({
    page,
  }) => {
    test.skip(!PID_FILE, 'RC_API_PID_FILE is not set; stop and start FastAPI by hand instead.');
    await page.goto(ROUTE);
    await expect(listings(page)).toHaveCount(9);

    const oldPid = Number(readFileSync(PID_FILE!, 'utf8').trim());
    process.kill(oldPid);
    await expect.poll(apiAnswers, { timeout: 30000 }).toBe(false);

    await search(page).fill('skin');
    const error = page.getByRole('heading', { name: 'Could not reach the directory API' });
    await expect(error).toBeVisible();
    await expect(
      page.getByText('No listings are shown until the directory responds.'),
    ).toBeVisible();
    await expect(listings(page)).toHaveCount(0);

    // Still down: Retry asks again and reports the same problem.
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(error).toBeVisible();
    await expect(listings(page)).toHaveCount(0);

    const log = openSync(process.env.RC_API_LOG ?? 'api-rc-restart.log', 'a');
    const server = spawn(
      process.env.RC_PYTHON ?? 'python',
      ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
      {
        cwd: process.env.RC_BACKEND_DIR ?? '../backend',
        detached: true,
        stdio: ['ignore', log, log],
      },
    );
    server.unref();
    writeFileSync(PID_FILE!, `${server.pid}\n`);
    await expect.poll(apiAnswers, { timeout: 30000 }).toBe(true);

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(names(page)).toHaveText(['Meadow Skin Clinic (fictional)']);
    await expect(error).toHaveCount(0);
    await search(page).fill('');
    await expect(listings(page)).toHaveCount(9);
  });
});
