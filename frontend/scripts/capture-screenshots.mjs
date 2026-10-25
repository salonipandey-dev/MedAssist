import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const destination = new URL('../../docs/screenshots/', import.meta.url);
await mkdir(destination, { recursive: true });
const app = await preview({
  root: fileURLToPath(new URL('..', import.meta.url)),
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  for (const [path, filename, fullPage, dark] of [
    ['/', 'home.png', false, false],
    ['/app/patient', 'patient.png', true, false],
    ['/app/doctor/reviews', 'doctor-review.png', true, false],
    ['/app/admin', 'admin-dark.png', true, true],
  ]) {
    await page.goto(`http://127.0.0.1:4174${path}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (dark) await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await page.screenshot({ path: fileURLToPath(new URL(filename, destination)), fullPage });
    console.log(`Captured ${filename}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4174/app/patient');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('patient-mobile.png', destination)) });
  console.log('Captured patient-mobile.png');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) =>
    app.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}
