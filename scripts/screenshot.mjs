/**
 * Capture screenshots of the Dolmenwood Beyond app for the dev blog.
 * Run: node scripts/screenshot.mjs
 * Requires the app on http://localhost:3001 and Supabase on http://127.0.0.1:54321
 */

import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'docs', 'blog', 'screenshots');
const BASE = 'http://localhost:3001';
const EMAIL = 'testplayer@dolmenwood.test';
const PASS  = 'TestPassword123!';

mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

async function shot(page, name) {
  const file = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✅  ${name}.png`);
}

async function waitAndShot(page, selector, name) {
  try {
    await page.waitForSelector(selector, { timeout: 8000 });
  } catch {
    console.warn(`  ⚠️  selector "${selector}" not found — shooting anyway`);
  }
  await new Promise(r => setTimeout(r, 800)); // let animations settle
  await shot(page, name);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // ── 1. Sign-in page ──────────────────────────────────────────────────────────
  console.log('Capturing sign-in page…');
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'form', '01-sign-in');

  // ── 2. Sign-up page ──────────────────────────────────────────────────────────
  console.log('Capturing sign-up page…');
  await page.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'form', '02-sign-up');

  // ── 3. Sign in via UI ────────────────────────────────────────────────────────
  console.log('Signing in…');
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.type('input[type="email"]', EMAIL, { delay: 40 });
  await page.type('input[type="password"]', PASS, { delay: 40 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log('  Signed in →', page.url());

  // ── 4. Characters (empty roster) ─────────────────────────────────────────────
  console.log('Capturing characters page…');
  await page.goto(`${BASE}/characters`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'main', '03-characters-empty');

  // ── 5. Mode select (new character) ───────────────────────────────────────────
  console.log('Capturing character creation mode select…');
  await page.goto(`${BASE}/characters/new`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'main', '04-character-new-mode');

  // ── 6. Wizard Step 1 — ability scores ────────────────────────────────────────
  console.log('Capturing wizard step 1…');
  await page.goto(`${BASE}/characters/new/auto/1`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'main', '05-wizard-step1-ability-scores');

  // ── 7. Wizard Step 2 — kindred ───────────────────────────────────────────────
  console.log('Capturing wizard step 2 (kindred)…');
  await page.goto(`${BASE}/characters/new/auto/2`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'main', '06-wizard-step2-kindred');

  // ── 8. Wizard Step 3 — class ─────────────────────────────────────────────────
  console.log('Capturing wizard step 3 (class)…');
  await page.goto(`${BASE}/characters/new/auto/3`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'main', '07-wizard-step3-class');

  // ── 9. Settings ──────────────────────────────────────────────────────────────
  console.log('Capturing settings page…');
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'main', '08-settings');

  // ── 10. News page ────────────────────────────────────────────────────────────
  console.log('Capturing news page…');
  await page.goto(`${BASE}/news`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'main', '09-news');

  // ── 11. Campaign stub ────────────────────────────────────────────────────────
  console.log('Capturing campaign page…');
  await page.goto(`${BASE}/campaign`, { waitUntil: 'networkidle2' });
  await waitAndShot(page, 'main', '10-campaign');

  await browser.close();
  console.log(`\nAll done — ${OUT_DIR}`);
})().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
