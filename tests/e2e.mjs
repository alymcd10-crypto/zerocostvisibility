// End-to-end check of every link, tab and button. Start tests/dev-server.ts first.
// __SITE_LIVE__ makes site.js submit forms and send events as it does on Netlify.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Uses the project's Playwright if installed, else a global one (NODE_PATH=$(npm root -g)).
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = process.env.PORT || 8888;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || '';
const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n').filter(Boolean).slice(0, 8).join(' | ')]); }
}
const events = (page) => page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a)).filter((a) => a[0] === 'event').map((a) => [a[1], a[2] || {}]));
const state = async () => (await fetch(`http://localhost:${PORT}/__test/state`)).json();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => { window.__SITE_LIVE__ = true; });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`${page.url()}: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text()) && !/status of 401/.test(m.text())) consoleErrors.push(`${page.url()}: ${m.text()}`); });

// ---- 1. The toolkit is locked: QR link for slide 14 shows the code page at the same URL
await step('slide 14 QR (/reviews) lands on the code page, toolkit HTML not sent', async () => {
  await page.goto(`${BASE}/reviews`);
  assert.match(page.url(), /\/toolkit\/\?utm_source=starpower.*utm_content=slide14#step3$/);
  assert.equal(await page.locator('#gate-title').innerText(), 'Enter your attendee code');
  assert.ok(await page.locator('#gate-hint').isVisible(), 'deep-link hint visible');
  const html = await (await fetch(`http://localhost:${PORT}/toolkit/`)).text();
  assert.ok(!html.includes('tpl-review'), 'toolkit content leaked without cookie');
  assert.ok(!html.includes('STARPOWER'), 'code leaked into the page');
});

await step('wrong code shows an error and is tracked', async () => {
  await page.fill('#gate-email', 'agent@example.com');
  await page.fill('#gate-code', 'nope');
  await page.click('#gate-form button[type=submit]');
  await page.locator('#gate-error').waitFor({ state: 'visible' });
  assert.match(await page.locator('#gate-error').innerText(), /doesn't match/);
  assert.ok((await events(page)).some(([n]) => n === 'toolkit_code_fail'));
});

await step('right code (lower case) unlocks and lands on the review request (#step3)', async () => {
  await page.fill('#gate-code', ' starpower ');
  await Promise.all([page.waitForURL(/#step3$/), page.waitForLoadState('load'), page.click('#gate-form button[type=submit]')]);
  await page.locator('#tpl-review').waitFor();
  await page.waitForTimeout(400);
  const top = await page.locator('#step3').evaluate((el) => el.getBoundingClientRect().top);
  assert.ok(top > -5 && top < 200, `#step3 top at ${top}`);
  const s = await state();
  assert.ok(s.forms.some((f) => f['form-name'] === 'toolkit-access' && f.email === 'agent@example.com'), 'Netlify form submitted');
  assert.deepEqual(s.access.at(-1), { email: 'agent@example.com', source: 'slide14' });
});

await step('closing-slide QR (/starpower) opens the toolkit directly once unlocked', async () => {
  await page.goto(`${BASE}/starpower`);
  assert.match(page.url(), /utm_content=closing-slide/);
  assert.ok(await page.locator('#tk-title').isVisible());
});

// ---- 2. Every internal link resolves, and every #anchor exists on its target page
const pages = ['/', '/book', '/thanks', '/attendee/', '/toolkit/'];
const linkProblems = [];
let linkCount = 0;
for (const p of pages) {
  await page.goto(BASE + p);
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  for (const href of new Set(hrefs)) {
    if (/^(tel|mailto):/.test(href)) continue;
    linkCount++;
    const url = new URL(href, BASE + p);
    if (url.host !== new URL(BASE).host) { linkProblems.push(`${p}: external link ${href}`); continue; }
    const res = await ctx.request.get(url.toString());
    if (res.status() !== 200) { linkProblems.push(`${p}: ${href} → ${res.status()}`); continue; }
    if (url.hash) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!(await res.text()).includes(`id="${id}"`)) linkProblems.push(`${p}: ${href} → no #${id} on target`);
    }
  }
  const missingCopy = await page.$$eval('[data-copy]', (bs) => bs.filter((b) => !document.getElementById(b.dataset.copy)).map((b) => b.dataset.copy));
  missingCopy.forEach((id) => linkProblems.push(`${p}: copy button target #${id} missing`));
  const untyped = await page.$$eval('button:not([type])', (bs) => bs.length);
  if (untyped) linkProblems.push(`${p}: ${untyped} button(s) without type`);
}
await step(`all ${linkCount} internal links and anchors resolve`, async () => assert.deepEqual(linkProblems, []));

// ---- 3. Header navigation, clicked for real on every page
await step('header links go where they say on every page', async () => {
  const expected = [['How it works', /\/#method$/], ['Attendee toolkit', /\/toolkit\/$/], ['Contact', /\/book#contact$/], ['Book a session', /\/book$/]];
  for (const p of pages) {
    for (const [text, re] of expected) {
      await page.goto(BASE + p);
      await page.locator('.site-header nav a', { hasText: text }).click();
      await page.waitForLoadState('load');
      assert.match(page.url(), re, `${p} → ${text}`);
    }
    await page.goto(BASE + p);
    await page.locator('.brand').click();
    await page.waitForLoadState('load');
    assert.equal(new URL(page.url()).pathname, '/', `${p} → logo`);
  }
});

await step('home page buttons go to the right place', async () => {
  const buttons = [['Book a 1:1 session', /\/book$/], ['Saw me speak? Open the toolkit', /\/toolkit\/$/], ['See times and pricing', /\/book$/],
    ['Open the toolkit', /\/toolkit\/$/], ['Send a note', /\/book#contact$/]];
  for (const [text, re] of buttons) {
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: text, exact: false }).first().click();
    await page.waitForLoadState('load');
    assert.match(page.url(), re, text);
  }
  await page.goto(BASE + '/');
  await page.locator('#meet-title ~ .actions a').click();
  await page.waitForLoadState('load');
  assert.match(page.url(), /\/book$/);
  const ev = await events(page);
  assert.ok(Array.isArray(ev));
});

// ---- 4. Toolkit tabs, copy buttons, print, CTA
await step('each toolkit tab scrolls to its section and highlights', async () => {
  await page.goto(BASE + '/toolkit/');
  for (const id of ['step1', 'step2', 'step3', 'ai', 'calendar']) {
    await page.locator(`.tk-tabs a[href="#${id}"]`).click();
    await page.waitForTimeout(700);
    const top = await page.locator('#' + id).evaluate((el) => el.getBoundingClientRect().top);
    assert.ok(top > -5 && top < 200, `#${id} top ${top}`);
    assert.equal(await page.locator(`.tk-tabs a[href="#${id}"]`).getAttribute('aria-current'), 'true', `${id} tab highlighted`);
  }
});

await step('all 13 copy buttons copy the exact template text', async () => {
  await page.goto(BASE + '/toolkit/');
  const ids = await page.$$eval('[data-copy]', (bs) => bs.map((b) => b.dataset.copy));
  assert.equal(ids.length, 13);
  for (const id of ids) {
    const btn = page.locator(`[data-copy="${id}"]`);
    await btn.click();
    await page.waitForFunction((el) => el.textContent === 'Copied', await btn.elementHandle(), { timeout: 2000 });
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const text = (await page.locator('#' + id).innerText()).trim();
    assert.equal(clip, text, `${id} clipboard`);
  }
  const copies = (await events(page)).filter(([n]) => n === 'copy_template');
  assert.equal(copies.length, 13);
  assert.ok(copies.every(([, d]) => d.template_name && d.section), 'events carry template name and section');
});

await step('print button and bottom CTA work', async () => {
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.locator('[data-print]').click();
  assert.ok(await page.evaluate(() => window.__printed));
  await page.locator('.cta-band').click();
  await page.waitForLoadState('load');
  assert.match(page.url(), /\/book$/);
});

// ---- 5. Booking and contact forms
await step('built-in calendar: request a time, then it shows as taken', async () => {
  await page.goto(BASE + '/book');
  await page.locator('.cal-grid button.cal-day').first().waitFor();
  const day = page.locator('.cal-grid button.cal-day[aria-pressed="true"]');
  const dayLabel = await day.getAttribute('aria-label');
  await day.click();
  const slot = page.locator('.slot-list .slot:not([disabled])').first();
  const time = await slot.innerText();
  await slot.click();
  await page.fill('#b-name', 'Test Agent');
  await page.fill('#b-email', 'test@example.com');
  await page.click('#booking-form button[type=submit]');
  await page.locator('#booking-status').waitFor({ state: 'visible' });
  assert.match(await page.locator('#booking-status').innerText(), /Your time is held/);
  assert.ok((await events(page)).some(([n, d]) => n === 'generate_lead' && d.form === 'booking'));
  assert.ok((await state()).forms.some((f) => f['form-name'] === 'booking'), 'Liz notified');
  await page.reload();
  await page.locator('.cal-grid button.cal-day').first().waitFor();
  const sameDay = page.locator(`.cal-grid button[aria-label="${dayLabel}"]`);
  if (await sameDay.count()) {
    await sameDay.click();
    const slots = await page.locator('.slot-list .slot').allInnerTexts();
    assert.ok(slots.includes(`${time} · Taken`), `slot shows taken: ${slots}`);
  } // otherwise that booking filled the day, and the day is correctly no longer offered
});

await step('with a Cal.com link set, the Book page uses Cal.com instead of the built-in calendar', async () => {
  const cal = await ctx.newPage();
  await cal.route('**/assets/config.js', (r) => r.fulfill({ contentType: 'text/javascript',
    body: "window.SITE_CONFIG = { ga4Id: '', bookingProvider: 'cal', bookingUrl: 'liz-federman/visibility-session' };" }));
  await cal.route('https://app.cal.com/**', (r) => r.abort());
  await cal.goto(BASE + '/book');
  assert.ok(await cal.locator('#booker').isHidden(), 'built-in calendar hidden');
  const queued = await cal.evaluate(() => (window.Cal && window.Cal.q || []).map((args) => Array.from(args)));
  const inline = queued.find(([cmd]) => cmd === 'inline');
  assert.deepEqual(inline && [inline[1].elementOrSelector, inline[1].calLink], ['#booking-embed', 'liz-federman/visibility-session']);
  assert.ok(queued.some(([cmd, o]) => cmd === 'on' && o.action === 'bookingSuccessfulV2'), 'booking tracked');
  assert.match(await cal.locator('#booking-note').innerText(), /Google Meet link/);
  await cal.close();
});

await step('server rejects a Sunday and a far-future date', async () => {
  for (const date of ['2026-11-01', '2099-01-06']) {
    const r = await ctx.request.post(`${BASE}/api/bookings`, { data: { date, time: '9:00 AM', name: 'x', email: 'x@y.co' } });
    assert.equal(r.status(), 400, date);
  }
});

await step('contact form sends and is tracked', async () => {
  await page.goto(BASE + '/book#contact');
  await page.fill('#c-name', 'Test Agent');
  await page.fill('#c-email', 'test@example.com');
  await page.click('#contact-form button[type=submit]');
  await page.locator('#contact-status').waitFor({ state: 'visible' });
  assert.match(await page.locator('#contact-status').innerText(), /on its way/);
  assert.ok((await state()).forms.some((f) => f['form-name'] === 'contact'));
  assert.ok((await events(page)).some(([n, d]) => n === 'generate_lead' && d.form === 'contact'));
});

// ---- 6. Phone layout, accessibility
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.addCookies(await ctx.cookies());
const mp = await phone.newPage();
for (const p of pages) {
  await step(`phone ${p}: no sideways scroll, no axe violations`, async () => {
    await mp.goto(BASE + p);
    await mp.waitForTimeout(300);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.equal(overflow, 0, `overflow ${overflow}px`);
    await mp.addScriptTag({ content: axe });
    const v = await mp.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`));
    assert.deepEqual(v, []);
  });
}
if (SHOTS) {
  await mp.goto(BASE + '/toolkit/'); await mp.screenshot({ path: `${SHOTS}/toolkit-phone.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/toolkit/'); await page.screenshot({ path: `${SHOTS}/toolkit-desktop.png`, fullPage: true });
  const anon = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await anon.goto(BASE + '/toolkit/'); await anon.screenshot({ path: `${SHOTS}/gate-desktop.png`, fullPage: true });
  await page.goto(BASE + '/'); await page.screenshot({ path: `${SHOTS}/home-desktop.png` });
  await page.goto(BASE + '/book'); await page.locator('.cal-grid button').first().waitFor(); await page.screenshot({ path: `${SHOTS}/book-desktop.png`, fullPage: true });
}

await step('no JavaScript errors on any page', async () => assert.deepEqual(consoleErrors, []));
await browser.close();

for (const r of results) console.log(r.join('  '));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
