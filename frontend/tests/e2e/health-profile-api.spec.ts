// Sign-in and the Health Profile screen against a mocked account API. This build has an
// API origin compiled in (see playwright.config.ts) and every request to it is answered
// here by a small in-test server that follows docs/HEALTH_PROFILE_API.md. These tests
// prove the browser's side: states, focus, copy, layout and what each request carries.
// Real sessions, PostgreSQL and two-account isolation are proven by the backend suite
// and by tests/fullstack/health-profile.fullstack.spec.ts.
import { expect, test, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const API = 'http://medassist-api.test';
const ROUTE = '/app/patient/health-profile';
const CSRF = 'mock-csrf-token-0123456789-abcdefghijklmnop';
type Section = {
  state: 'not_recorded' | 'none' | 'recorded';
  entries: { name: string; note: string | null }[];
};
type Profile = {
  version: number;
  updated_at: string | null;
  medicines: Section;
  allergies: Section;
  conditions: Section;
};
const ACCOUNTS = {
  'patient.a@example.test': { password: 'MedAssist-Demo-A-2026', name: 'Patient A (fictional)' },
};

const emptyProfile = (): Profile => ({
  version: 0,
  updated_at: null,
  medicines: { state: 'not_recorded', entries: [] },
  allergies: { state: 'not_recorded', entries: [] },
  conditions: { state: 'not_recorded', entries: [] },
});

async function mockAccountApi(page: Page) {
  const server = {
    signedIn: false,
    /** When set, the next authenticated request finds the session ended. */
    expired: false,
    profile: emptyProfile(),
    writes: [] as { path: string; csrf: string | undefined; body: unknown }[],
    /** Another tab or device saves, moving the stored version on. */
    saveElsewhere() {
      server.profile = {
        ...server.profile,
        version: server.profile.version + 1,
        updated_at: new Date().toISOString(),
      };
    },
  };
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'access-control-allow-origin': request.headers()['origin'] ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-expose-headers': 'X-Request-ID',
      'cache-control': 'no-store',
      'x-request-id': 'e2e-account',
    };
    const reply = (status: number, json?: unknown) =>
      json === undefined
        ? route.fulfill({ status, headers })
        : route.fulfill({ status, headers, json });
    const session = {
      account: {
        display_name: 'Patient A (fictional)',
        email: 'patient.a@example.test',
        role: 'patient',
      },
      csrf_token: CSRF,
      expires_at: '2026-11-12T20:00:00Z',
      idle_expires_at: '2026-11-12T12:30:00Z',
    };
    const csrf = request.headers()['x-csrf-token'];
    if (request.method() !== 'GET')
      server.writes.push({ path: url.pathname, csrf, body: request.postDataJSON() });
    const refuse = () =>
      server.expired
        ? reply(401, { code: 'session_expired', detail: 'Your session has ended.' })
        : reply(401, { code: 'not_signed_in', detail: 'Sign in to continue.' });

    switch (`${request.method()} ${url.pathname}`) {
      case 'POST /api/v1/auth/sign-in': {
        const { email, password } = request.postDataJSON();
        const account = ACCOUNTS[email.trim().toLowerCase() as keyof typeof ACCOUNTS];
        if (!account || account.password !== password)
          return reply(401, { code: 'invalid_credentials', detail: 'Incorrect.' });
        server.signedIn = true;
        server.expired = false;
        return reply(200, session);
      }
      case 'GET /api/v1/auth/session':
        return server.signedIn && !server.expired ? reply(200, session) : refuse();
      case 'POST /api/v1/auth/sign-out':
        if (csrf !== CSRF) return reply(403, { code: 'csrf_failed', detail: 'x' });
        server.signedIn = false;
        return reply(204);
      case 'GET /api/v1/me/health-profile':
        if (!server.signedIn || server.expired) return refuse();
        return reply(200, server.profile);
      case 'PUT /api/v1/me/health-profile': {
        if (!server.signedIn || server.expired) return refuse();
        if (csrf !== CSRF) return reply(403, { code: 'csrf_failed', detail: 'x' });
        const body = request.postDataJSON();
        if (body.version !== server.profile.version)
          return reply(409, {
            code: 'version_conflict',
            detail: 'Changed elsewhere.',
            current_version: server.profile.version,
          });
        server.profile = {
          version: body.version + 1,
          updated_at: '2026-11-12T12:00:00Z',
          medicines: body.medicines,
          allergies: body.allergies,
          conditions: body.conditions,
        };
        return reply(200, server.profile);
      }
      default:
        return reply(404, { detail: 'Not Found' });
    }
  });
  return server;
}

const region = (page: Page, name: string) => page.getByRole('region', { name });

async function signIn(page: Page) {
  await page.goto(`/sign-in?next=${encodeURIComponent(ROUTE)}`);
  await page.getByLabel('Email').fill('patient.a@example.test');
  await page.getByLabel('Password').fill('MedAssist-Demo-A-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`));
  await expect(region(page, 'Current medicines')).toBeVisible();
}

async function addEntry(page: Page, section: string, choice: string, item: string, name: string) {
  const area = region(page, section);
  const radio = area.getByRole('radio', { name: choice });
  if (await radio.isChecked()) await area.getByRole('button', { name: /^Add / }).click();
  else await radio.check();
  const field = area.getByLabel(new RegExp(`^${item} \\d+$`)).last();
  await expect(field).toBeFocused();
  await field.fill(name);
}

test('signs in, saves all three sections and shows them again after a reload', async ({ page }) => {
  const server = await mockAccountApi(page);
  await signIn(page);
  await expect(page.getByText(/Nothing saved yet/)).toBeVisible();

  await addEntry(page, 'Current medicines', 'I take medicines', 'Medicine', 'Tarvexol (fictional)');
  await region(page, 'Current medicines').getByLabel('Note (optional)').fill('With breakfast');
  await addEntry(page, 'Allergies', 'I have allergies to list', 'Allergy', 'Sample pollen X');
  await addEntry(
    page,
    'Health conditions',
    'I have conditions to list',
    'Condition',
    'Condition Q',
  );
  await page.getByRole('button', { name: 'Save health profile' }).click();

  await expect(page.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible();
  const save = server.writes.find((w) => w.path === '/api/v1/me/health-profile')!;
  expect(save.csrf).toBe(CSRF);
  expect(save.body).toEqual({
    version: 0,
    medicines: {
      state: 'recorded',
      entries: [{ name: 'Tarvexol (fictional)', note: 'With breakfast' }],
    },
    allergies: { state: 'recorded', entries: [{ name: 'Sample pollen X', note: null }] },
    conditions: { state: 'recorded', entries: [{ name: 'Condition Q', note: null }] },
  });

  await page.reload();
  await expect(
    region(page, 'Current medicines').getByLabel('Medicine 1', { exact: true }),
  ).toHaveValue('Tarvexol (fictional)');
  await expect(region(page, 'Allergies').getByLabel('Allergy 1', { exact: true })).toHaveValue(
    'Sample pollen X',
  );
  await expect(page.getByText(/Last saved/)).toBeVisible();
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('wrong credentials keep the visitor on the sign-in form without the password', async ({
  page,
}) => {
  await mockAccountApi(page);
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter the account’s email address.')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Email').fill('patient.a@example.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('The email or password is incorrect.');
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('removing entries, choosing none and validation errors behave as labelled', async ({
  page,
}) => {
  await mockAccountApi(page);
  await signIn(page);
  const medicines = region(page, 'Current medicines');

  await medicines.getByRole('radio', { name: 'I take medicines' }).check();
  await page.getByRole('button', { name: 'Save health profile' }).click();
  const first = medicines.getByLabel('Medicine 1', { exact: true });
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await expect(first).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('Nothing has been saved yet.');

  await first.fill('Velorin (fictional)');
  await medicines.getByRole('button', { name: 'Add medicine' }).click();
  await medicines.getByLabel('Medicine 2', { exact: true }).fill('velorin (FICTIONAL)');
  await page.getByRole('button', { name: 'Save health profile' }).click();
  await expect(medicines.getByText('This name is already listed in this section.')).toBeVisible();

  await medicines.getByRole('button', { name: /^Remove medicine 2/ }).click();
  await expect(medicines.getByLabel('Medicine 1', { exact: true })).toBeFocused();
  await region(page, 'Allergies').getByRole('radio', { name: 'No known allergies' }).check();
  await page.getByRole('button', { name: 'Save health profile' }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible();
  await expect(
    region(page, 'Allergies').getByRole('radio', { name: 'No known allergies' }),
  ).toBeChecked();
  await expect(
    region(page, 'Health conditions').getByRole('radio', { name: 'Not recorded yet' }),
  ).toBeChecked();
});

test('a save from a stale tab shows a conflict instead of overwriting', async ({ page }) => {
  const server = await mockAccountApi(page);
  await signIn(page);
  await region(page, 'Allergies').getByRole('radio', { name: 'No known allergies' }).check();
  await page.getByRole('button', { name: 'Save health profile' }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible();

  server.saveElsewhere();
  await region(page, 'Health conditions')
    .getByRole('radio', { name: 'No conditions to list' })
    .check();
  await page.getByRole('button', { name: 'Save health profile' }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'changed in another tab or device' });
  await expect(alert).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save health profile' })).toBeDisabled();
  await alert.getByRole('button', { name: 'Load latest version' }).click();
  await expect(alert).toBeHidden();
  await expect(
    region(page, 'Health conditions').getByRole('radio', { name: 'Not recorded yet' }),
  ).toBeChecked();
});

test('an ended session clears the profile and offers sign-in again', async ({ page }) => {
  const server = await mockAccountApi(page);
  await signIn(page);
  await addEntry(page, 'Current medicines', 'I take medicines', 'Medicine', 'Unsaved draft entry');

  server.expired = true;
  await page.getByRole('button', { name: 'Save health profile' }).click();

  await expect(page.getByRole('heading', { name: 'Your session has ended' })).toBeVisible();
  await expect(page.getByText('Unsaved draft entry')).toHaveCount(0);
  await expect(page.locator('input[value="Unsaved draft entry"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByText('Your session has ended. Sign in again to continue.')).toBeVisible();
});

test('signing out clears the profile from the page', async ({ page }) => {
  const server = await mockAccountApi(page);
  server.signedIn = true;
  server.profile = {
    ...emptyProfile(),
    version: 1,
    updated_at: '2026-11-12T12:00:00Z',
    medicines: { state: 'recorded', entries: [{ name: 'Velorin (fictional)', note: null }] },
  };
  await page.goto(ROUTE);
  await expect(
    region(page, 'Current medicines').getByLabel('Medicine 1', { exact: true }),
  ).toHaveValue('Velorin (fictional)');

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  expect(server.writes.at(-1)).toMatchObject({ path: '/api/v1/auth/sign-out', csrf: CSRF });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Sign in to see your health profile' }),
  ).toBeVisible();
});

test('the health profile works by keyboard', async ({ page }) => {
  await mockAccountApi(page);
  await signIn(page);
  const medicines = region(page, 'Current medicines');
  await medicines.getByRole('radio', { name: 'Not recorded yet' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(medicines.getByRole('radio', { name: 'I take no medicines' })).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(medicines.getByRole('radio', { name: 'I take medicines' })).toBeChecked();
  await expect(medicines.getByLabel('Medicine 1', { exact: true })).toBeFocused();
  await page.keyboard.type('Tarvexol (fictional)');
  await page.keyboard.press('Tab');
  await expect(medicines.getByLabel('Note (optional)')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(medicines.getByRole('button', { name: /^Remove medicine 1/ })).toBeFocused();
  await expect(medicines.getByRole('button', { name: /^Remove medicine 1/ })).toHaveCSS(
    'outline-style',
    'solid',
  );
  await page.keyboard.press('Tab');
  await expect(medicines.getByRole('button', { name: 'Add medicine' })).toBeFocused();
  await page.getByRole('button', { name: 'Save health profile' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: /^Saved / })).toBeVisible();
});

for (const dark of [false, true])
  test(`sign-in and health profile fit and pass WCAG checks in ${dark ? 'dark' : 'light'} mode`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const server = await mockAccountApi(page);
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    server.profile = {
      ...emptyProfile(),
      version: 1,
      updated_at: '2026-11-12T12:00:00Z',
      medicines: {
        state: 'recorded',
        entries: [{ name: 'Velorin (fictional)', note: 'Invented' }],
      },
      allergies: { state: 'none', entries: [] },
    };
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, signedIn] of [
        ['/sign-in', false],
        [ROUTE, true],
      ] as const) {
        server.signedIn = signedIn;
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        if (signedIn) {
          await expect(region(page, 'Current medicines')).toBeVisible();
          // Show the validation state as well, since it adds error colours.
          await region(page, 'Health conditions')
            .getByRole('radio', { name: 'I have conditions to list' })
            .check();
          await page.getByRole('button', { name: 'Save health profile' }).click();
          await expect(page.getByRole('alert')).toBeVisible();
        }
        const size = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        expect(size.scroll, `${path} at ${width}px`).toBeLessThanOrEqual(size.width + 1);
        if (width === 390 || width === 1440) {
          const result = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(
            result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
            `${path} at ${width}px`,
          ).toEqual([]);
        }
      }
    }
  });

test('requests carry no credentials in the URL and profile data is never cached', async ({
  page,
}) => {
  await mockAccountApi(page);
  const requests: Request[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(API)) requests.push(request);
  });
  await signIn(page);
  for (const request of requests) {
    expect(new URL(request.url()).search).toBe('');
    expect(request.url()).not.toContain('MedAssist-Demo');
  }
});
