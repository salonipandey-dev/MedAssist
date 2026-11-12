// Health profile proof against the real API and PostgreSQL (see playwright.fullstack.config.ts).
// Every account and entry is fictional. Phases are selected with --grep and share state
// through files in FULLSTACK_STATE_DIR, because FastAPI is restarted between them.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

const API = process.env.FULLSTACK_API_ORIGIN ?? 'http://127.0.0.1:8000';
const STATE_DIR = process.env.FULLSTACK_STATE_DIR ?? 'fullstack-state';
const PATIENT_A_ID = Number(process.env.PATIENT_A_ID ?? '1');
const ROUTE = '/app/patient/health-profile';
const A = { email: 'patient.a@example.test', password: 'MedAssist-Demo-A-2026' };
const B = { email: 'patient.b@example.test', password: 'MedAssist-Demo-B-2026' };
const statePath = (name: string) => join(STATE_DIR, `${name}.json`);

const region = (page: Page, name: string) => page.getByRole('region', { name });

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto(`/sign-in?next=${encodeURIComponent(ROUTE)}`);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`));
  await expect(region(page, 'Current medicines')).toBeVisible();
}

async function addEntry(page: Page, section: string, choice: string, item: string, name: string) {
  const area = region(page, section);
  const radio = area.getByRole('radio', { name: choice });
  if (await radio.isChecked()) await area.getByRole('button', { name: /^Add / }).click();
  else await radio.check();
  await area
    .getByLabel(new RegExp(`^${item} \\d+$`))
    .last()
    .fill(name);
}

async function expectPatientAProfile(page: Page) {
  const medicines = region(page, 'Current medicines');
  await expect(medicines.getByLabel('Medicine 1', { exact: true })).toHaveValue(
    'Tarvexol (fictional)',
  );
  await expect(medicines.getByLabel('Medicine 2', { exact: true })).toHaveValue(
    'Mirelune (fictional)',
  );
  await expect(medicines.getByLabel('Note (optional)').first()).toHaveValue('With breakfast');
  await expect(region(page, 'Allergies').getByLabel('Allergy 1', { exact: true })).toHaveValue(
    'Sample pollen X',
  );
  await expect(
    region(page, 'Health conditions').getByLabel('Condition 1', { exact: true }),
  ).toHaveValue('Sample condition Q');
}

/** A request made by the page itself, so it carries the page's Origin and cookie. */
async function apiFromPage(
  page: Page,
  method: string,
  path: string,
  options: { body?: unknown; csrf?: boolean } = {},
) {
  return page.evaluate(
    async ({ api, method, path, body, csrf }) => {
      let token: string | undefined;
      if (csrf) {
        const session = await fetch(`${api}/api/v1/auth/session`, { credentials: 'include' });
        token = session.ok ? (await session.json()).csrf_token : undefined;
      }
      const response = await fetch(`${api}${path}`, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { 'X-CSRF-Token': token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        cacheControl: response.headers.get('Cache-Control'),
        text: await response.text(),
      };
    },
    { api: API, method, path, body: options.body, csrf: options.csrf ?? false },
  );
}

async function newPage(browser: Browser, state?: string) {
  const context = await browser.newContext(state ? { storageState: statePath(state) } : {});
  return { context, page: await context.newPage() };
}

test.describe('@before-restart', () => {
  test('Patient A saves all three sections and they survive a browser refresh', async ({
    page,
  }) => {
    mkdirSync(STATE_DIR, { recursive: true });
    await signIn(page, A);
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible();

    await addEntry(
      page,
      'Current medicines',
      'I take medicines',
      'Medicine',
      'Tarvexol (fictional)',
    );
    await region(page, 'Current medicines').getByLabel('Note (optional)').fill('With breakfast');
    await addEntry(
      page,
      'Current medicines',
      'I take medicines',
      'Medicine',
      'Mirelune (fictional)',
    );
    await addEntry(page, 'Allergies', 'I have allergies to list', 'Allergy', 'Sample pollen X');
    await addEntry(
      page,
      'Health conditions',
      'I have conditions to list',
      'Condition',
      'Sample condition Q',
    );
    await page.getByRole('button', { name: 'Save health profile' }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible();

    await page.reload();
    await expectPatientAProfile(page);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    await page.context().storageState({ path: statePath('patient-a') });
  });
});

test.describe('@after-restart', () => {
  test('Patient A’s session and saved profile survive the FastAPI restart', async ({ browser }) => {
    const { context, page } = await newPage(browser, 'patient-a');
    await page.goto(ROUTE);
    await expect(page.getByText('Signed in as')).toContainText('Patient A (fictional)');
    await expectPatientAProfile(page);
    await context.close();
  });

  test('Patient B sees only B’s profile and cannot read or change A’s', async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await signIn(page, B);
    await expect(page.getByText('Signed in as')).toContainText('Patient B (fictional)');
    await expect(
      region(page, 'Current medicines').getByLabel('Medicine 1', { exact: true }),
    ).toHaveValue('Velorin (fictional)');
    await expect(
      region(page, 'Allergies').getByRole('radio', { name: 'No known allergies' }),
    ).toBeChecked();
    await expect(page.locator('input[value="Tarvexol (fictional)"]')).toHaveCount(0);

    const own = await apiFromPage(page, 'GET', '/api/v1/me/health-profile');
    expect(own.status).toBe(200);
    expect(own.cacheControl).toBe('no-store');
    expect(own.text).not.toContain('Tarvexol');
    const version = JSON.parse(own.text).version;
    const overwrite = {
      version,
      medicines: { state: 'recorded', entries: [{ name: 'Overwritten by B', note: null }] },
      allergies: { state: 'none', entries: [] },
      conditions: { state: 'none', entries: [] },
    };

    // Tampered requests from B's signed-in page.
    for (const field of ['account_id', 'profile_id', 'owner_id', 'patient_id']) {
      const result = await apiFromPage(page, 'PUT', '/api/v1/me/health-profile', {
        body: { ...overwrite, [field]: PATIENT_A_ID },
        csrf: true,
      });
      expect(result.status, field).toBe(422);
    }
    for (const query of [`account_id=${PATIENT_A_ID}`, `profile_id=${PATIENT_A_ID}`]) {
      const result = await apiFromPage(page, 'GET', `/api/v1/me/health-profile?${query}`);
      expect(result.status, query).toBe(400);
      expect(result.text).not.toContain('Tarvexol');
    }
    const byPath = await apiFromPage(page, 'GET', `/api/v1/me/health-profile/${PATIENT_A_ID}`);
    expect(byPath.status).toBe(404);
    const noCsrf = await apiFromPage(page, 'PUT', '/api/v1/me/health-profile', {
      body: overwrite,
    });
    expect(noCsrf.status).toBe(403);
    await context.close();

    // A's data is untouched.
    const a = await newPage(browser, 'patient-a');
    await a.page.goto(ROUTE);
    await expectPatientAProfile(a.page);
    await a.context.close();
  });

  test('a stale save from a second tab gets a conflict', async ({ browser }) => {
    const { context, page: first } = await newPage(browser, 'patient-a');
    const second = await context.newPage();
    await first.goto(ROUTE);
    await second.goto(ROUTE);
    await expectPatientAProfile(first);
    await expectPatientAProfile(second);

    await region(first, 'Health conditions')
      .getByLabel('Condition 1', { exact: true })
      .fill('Sample condition Q (edited in tab 1)');
    await first.getByRole('button', { name: 'Save health profile' }).click();
    await expect(first.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible();

    await region(second, 'Health conditions')
      .getByLabel('Condition 1', { exact: true })
      .fill('Sample condition Q (edited in tab 2)');
    await second.getByRole('button', { name: 'Save health profile' }).click();
    const alert = second.getByRole('alert').filter({ hasText: 'changed in another tab or device' });
    await expect(alert).toBeVisible();

    await alert.getByRole('button', { name: 'Load latest version' }).click();
    await expect(
      region(second, 'Health conditions').getByLabel('Condition 1', { exact: true }),
    ).toHaveValue('Sample condition Q (edited in tab 1)');
    // Put A's condition back so later phases see the original values.
    await region(second, 'Health conditions')
      .getByLabel('Condition 1', { exact: true })
      .fill('Sample condition Q');
    await second.getByRole('button', { name: 'Save health profile' }).click();
    await expect(second.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible();
    await context.close();
  });

  test('signed-out visitors are refused, and a signed-out session cannot be replayed', async ({
    browser,
  }) => {
    const anonymous = await newPage(browser);
    // Load the app first so the request carries the frontend's origin.
    await anonymous.page.goto('/');
    const refused = await apiFromPage(anonymous.page, 'GET', '/api/v1/me/health-profile');
    expect(refused.status).toBe(401);
    expect(JSON.parse(refused.text).code).toBe('not_signed_in');
    await anonymous.page.goto(ROUTE);
    await expect(
      anonymous.page.getByRole('heading', { name: 'Sign in to see your health profile' }),
    ).toBeVisible();
    await anonymous.context.close();

    const { context, page } = await newPage(browser);
    await signIn(page, A);
    const [cookie] = (await context.cookies(`${API}/api/v1/me/health-profile`)).filter(
      (c) => c.name === 'medassist_session',
    );
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible();
    await expect(page.locator('input')).toHaveCount(0);

    // Replay the cookie captured before sign-out in a fresh browser context.
    const replay = await browser.newContext();
    await replay.addCookies([cookie]);
    const replayPage = await replay.newPage();
    await replayPage.goto('/');
    const result = await apiFromPage(replayPage, 'GET', '/api/v1/me/health-profile');
    expect(result.status).toBe(401);
    expect(JSON.parse(result.text).code).toBe('session_expired');
    await replay.close();
    await context.close();
  });

  test('health check and consultation search still work without signing in', async ({ page }) => {
    const health = await page.request.get(`${API}/health`);
    expect(health.status()).toBe(200);
    expect((await health.json()).status).toBe('ok');

    await page.goto('/app/patient/consultations');
    const listings = page
      .getByRole('list', { name: 'Consultation listings' })
      .getByRole('listitem');
    await expect(listings).toHaveCount(9);
    await page.getByRole('searchbox', { name: 'Search consultations' }).fill('skin');
    await expect(listings).toHaveCount(1);
  });

  test('Patient B signs in again for the expiry phase', async ({ page }) => {
    await signIn(page, B);
    await page.context().storageState({ path: statePath('patient-b') });
  });
});

test.describe('@expired', () => {
  test('an expired session is refused and the page asks to sign in again', async ({ browser }) => {
    // Each context starts from the saved cookie; the first refusal clears it.
    const api = await newPage(browser, 'patient-b');
    await api.page.goto('/');
    const result = await apiFromPage(api.page, 'GET', '/api/v1/me/health-profile');
    expect(result.status).toBe(401);
    expect(JSON.parse(result.text).code).toBe('session_expired');
    await api.context.close();

    const ui = await newPage(browser, 'patient-b');
    await ui.page.goto(ROUTE);
    await expect(ui.page.getByRole('heading', { name: 'Your session has ended' })).toBeVisible();
    await expect(ui.page.locator('input')).toHaveCount(0);
    await ui.context.close();
  });
});
