// Captures the agreed report screenshots (SS01–SS12) from the built application and writes
// docs/screenshots/report/*.png, docs/screenshots/report/manifest.json and
// docs/SCREENSHOT_MANIFEST.md from what was actually captured.
//
// Usage (from frontend/):  npm run build && npm run screenshots:report
// Options:
//   --base-url=http://host:port  use an already running server instead of `vite preview`
//   --out=path                   write images and manifests somewhere else (no Markdown manifest)
//   --allow-dirty                capture from a working tree with uncommitted changes (marked)
// The historical captures in docs/screenshots/*.png (25 October 2026) are left untouched.
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
const repo = fileURLToPath(new URL('../../', import.meta.url));
const git = (cmd) => execSync(`git ${cmd}`, { cwd: repo, encoding: 'utf8' }).trim();
const commit = git('rev-parse HEAD');
const dirty = git('status --porcelain').length > 0;
if (dirty && !args['allow-dirty']) {
  console.error('Working tree has uncommitted changes. Commit first, or pass --allow-dirty.');
  process.exit(1);
}
const outDir = args.out ? String(args.out) : join(repo, 'docs/screenshots/report');
const writeMarkdown = !args.out;
await mkdir(outDir, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** Close confirmation toasts with their own close button so they never cover the captured state. */
async function waitForToasts(page) {
  const toasts = page.locator('[data-sonner-toast]');
  for (let attempt = 0; attempt < 5 && (await toasts.count()) > 0; attempt++) {
    const close = page.getByRole('button', { name: /close toast/i });
    if (await close.count())
      await close
        .first()
        .click({ force: true })
        .catch(() => {});
    await page.waitForTimeout(400);
  }
  await toasts
    .first()
    .waitFor({ state: 'detached', timeout: 8000 })
    .catch(() => {
      throw new Error('A confirmation toast is still visible; refusing to capture over it.');
    });
}

/** Each step mirrors an interaction exercised by tests/e2e/workflows.spec.ts. */
const SHOTS = [
  {
    id: 'SS01',
    file: 'ss01-home.png',
    route: '/',
    state: 'Initial viewport',
    caption: 'Public homepage of the MedAssist academic prototype.',
    status: 'Implemented interface',
    limitation: 'Interface only; not a deployed clinical service.',
  },
  {
    id: 'SS02',
    file: 'ss02-demo-access.png',
    route: '/demo',
    state: 'Initial viewport',
    caption: 'Demo access page for choosing a fictional patient, doctor or administrator view.',
    status: 'Demonstration only',
    limitation: 'Role choice is not registration, login or authentication.',
  },
  {
    id: 'SS03',
    file: 'ss03-patient-overview.png',
    route: '/app/patient',
    state: 'Fresh seeded state',
    caption: 'Patient overview summarising fictional cases, an appointment and documents.',
    status: 'Demonstration only',
    limitation: 'Records are fictional and held in page memory; they reset on reload.',
  },
  {
    id: 'SS04',
    file: 'ss04-profile.png',
    route: '/app/patient/profile',
    state: 'Edit profile opened',
    steps: async (page) => page.getByRole('button', { name: 'Edit profile' }).click(),
    caption:
      'Profile editor: only a fictional display alias and a language-preference label can be changed.',
    status: 'Demonstration only',
    limitation:
      'No personal, contact or medical details are collected; the language label does not translate the interface.',
  },
  {
    id: 'SS05',
    file: 'ss05-assessment.png',
    route: '/app/patient/assessments',
    state: 'Step 5 of 6, “Review the predefined sample.”',
    steps: async (page) => {
      await page.getByRole('button', { name: 'Begin sample walkthrough' }).click();
      for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('heading', { name: 'Review the predefined sample.' }).waitFor();
    },
    caption: 'Review step of the fixed assessment walkthrough with predefined content.',
    status: 'Demonstration only',
    limitation: 'No symptom analysis, urgency classification or advice is produced.',
  },
  {
    id: 'SS06',
    file: 'ss06-cases.png',
    route: '/app/patient/cases',
    state: 'Fresh seeded state',
    caption: 'Case tracking with temporary sample records and workflow statuses.',
    status: 'Demonstration only',
    limitation: 'Status is coordination progress, not medical urgency; changes reset on reload.',
  },
  {
    id: 'SS07',
    file: 'ss07-doctor-review.png',
    route: '/app/doctor/reviews/MA-2402',
    state: 'Confirmation ticked and sample review recorded',
    steps: async (page) => {
      await page.getByLabel('I understand this records a fictional workflow review only.').check();
      await page.getByRole('button', { name: 'Record sample review' }).click();
      await page.locator('.review-record').first().waitFor();
      await waitForToasts(page);
    },
    crop: '.review-right',
    caption: 'Demonstration review recorded for fictional case MA-2402 with a predefined note.',
    status: 'Demonstration only',
    limitation:
      'No authenticated clinician and no clinical conclusion; AI assistance is not available.',
  },
  {
    id: 'SS08',
    file: 'ss08-appointments.png',
    route: '/app/patient/appointments',
    state: 'Monday 2 November 2026, 09:00 selected; request confirmation dialog open',
    steps: async (page) => {
      await page.getByRole('button', { name: 'Next sample month' }).click();
      await page.getByRole('button', { name: /Monday,? 2 November 2026/, exact: true }).click();
      await page.getByRole('button', { name: '09:00', exact: true }).click();
      await page.getByRole('button', { name: 'Request sample appointment' }).click();
      await page.getByRole('dialog').waitFor();
    },
    caption: 'Confirmation step for a fictional appointment request.',
    status: 'Demonstration only',
    limitation: 'Fictional availability; nothing is booked and no message is sent.',
  },
  {
    id: 'SS09',
    file: 'ss09-admin-analytics.png',
    route: '/app/admin/analytics',
    state: 'All months',
    crop: '.admin-chart-grid',
    caption: 'Administrator analytics calculated from synthetic sample records.',
    status: 'Demonstration only',
    limitation: 'Figures are not real patient or hospital statistics.',
  },
  {
    id: 'SS10',
    file: 'ss10-consultation-comparison.png',
    route: '/app/patient/consultations?source=offline',
    state: 'First three fictional options added to the comparison',
    steps: async (page) => {
      for (let i = 0; i < 3; i++)
        await page
          .getByRole('button', { name: /^Compare / })
          .first()
          .click();
      await page.getByRole('table', { name: 'consultation comparison' }).waitFor();
    },
    crop: '.consult-compare',
    caption: 'Comparison of three fictional consultation options with illustrative fees.',
    status: 'Demonstration only',
    limitation:
      'Providers and fees are invented; no verified free service, real availability or booking.',
  },
  {
    id: 'SS11',
    file: 'ss11-medication-information.png',
    route: '/app/patient/medications',
    state: 'Scripted example “Same ingredient in two products”',
    crop: '.med-layout',
    caption: 'Scripted medication-information example with invented medicine names.',
    status: 'Demonstration only',
    limitation:
      'Notices are written in advance; nothing is checked and no notice does not mean a combination is safe.',
  },
  {
    id: 'SS11b',
    file: 'ss11b-medication-incomplete.png',
    route: '/app/patient/medications',
    state: 'Scripted example “Incomplete information”',
    steps: async (page) => page.getByRole('button', { name: /^Incomplete information/ }).click(),
    crop: '.med-layout',
    caption: 'Scripted example showing missing information kept separate from possible issues.',
    status: 'Demonstration only',
    limitation: '“Not recorded” is shown as different from “none”; no assessment is performed.',
  },
  {
    id: 'SS12',
    file: 'ss12-patient-overview-mobile.png',
    route: '/app/patient',
    viewport: MOBILE,
    state: 'Fresh seeded state, 390 × 844',
    caption: 'Patient overview at a mobile viewport, showing the responsive layout.',
    status: 'Demonstration only',
    limitation: 'Chromium emulation, not a physical-device test.',
  },
];

let app;
let baseUrl = args['base-url'] ? String(args['base-url']).replace(/\/$/, '') : '';
if (!baseUrl) {
  const { preview } = await import('vite');
  app = await preview({
    root: fileURLToPath(new URL('..', import.meta.url)),
    preview: { host: '127.0.0.1', port: 4175, strictPort: true },
  });
  baseUrl = 'http://127.0.0.1:4175';
}
const results = [];
let browser;
try {
  browser = await chromium.launch();
  const browserVersion = browser.version();
  for (const shot of SHOTS) {
    const viewport = shot.viewport ?? DESKTOP;
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(baseUrl + shot.route);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (shot.steps) await shot.steps(page);
    await waitForToasts(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(outDir, shot.file) });
    const files = [shot.file];
    if (shot.crop) {
      const crop = shot.file.replace('.png', '-crop.png');
      await page
        .locator(shot.crop)
        .first()
        .screenshot({ path: join(outDir, crop) });
      files.push(crop);
    }
    results.push({
      ...shot,
      steps: undefined,
      files,
      viewport: `${viewport.width} × ${viewport.height} (device scale factor 2)`,
      theme: 'light',
      capturedAt: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      commit,
      dirty,
      browser: `Chromium ${browserVersion}`,
    });
    console.log(`Captured ${files.join(', ')}`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (app)
    await new Promise((resolve, reject) =>
      app.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
}

await writeFile(join(outDir, 'manifest.json'), JSON.stringify(results, null, 2) + '\n');
if (writeMarkdown) {
  const rows = results
    .map(
      (r) =>
        `| ${r.id} | ${r.files.map((f) => `\`screenshots/report/${f}\``).join('<br>')} | \`${r.route}\` | ${r.state} | ${r.viewport} | ${r.capturedAt.replace('T', ' ').slice(0, 19)} UTC | \`${r.commit.slice(0, 12)}\`${r.dirty ? ' (uncommitted changes)' : ''} | ${r.caption} | ${r.status}. ${r.limitation} |`,
    )
    .join('\n');
  const md = `# Screenshot manifest

Generated by \`frontend/scripts/capture-report-screenshots.mjs\` from the built application. Captured in ${results[0]?.browser ?? 'Chromium'}, light theme, with fictional seeded records and a fresh browser context for each screenshot.

Screenshots show interface states. They cannot prove authentication, persistence, clinical accuracy, real availability or production readiness.

| ID | File(s) | Route | Visible state | Viewport | Captured | Source version | Caption | Status and limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Historical captures

\`docs/screenshots/home.png\`, \`patient.png\`, \`doctor-review.png\`, \`admin-dark.png\` and \`patient-mobile.png\` belong to the 25 October 2026 verification record (referred to as H01–H05 in the report control packet). They predate the minimal redesign and are kept unchanged.
`;
  await writeFile(join(repo, 'docs/SCREENSHOT_MANIFEST.md'), md);
  console.log('Wrote docs/SCREENSHOT_MANIFEST.md');
}
