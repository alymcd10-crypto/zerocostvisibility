// End-to-end check of private mode (OFFERS_LIVE unset or anything but "true"): no offer pages,
// no booking, a Contact page instead. Build with OFFERS_LIVE=false and start tests/dev-server.ts
// with the same value first (npm run test:e2e:private does both).
// Run with --experimental-strip-types: the attendee code is imported, never written here.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_CODE, EVENT_CODES } from '../netlify/lib/access-token.ts';
// Uses the project's Playwright if installed, else a global one (NODE_PATH=$(npm root -g)).
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = process.env.PORT || 8889;
const BASE = `http://localhost:${PORT}`;
const { siteUrl } = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n').filter(Boolean).slice(0, 8).join(' | ')]); }
}
const state = async () => (await fetch(`${BASE}/__test/state`)).json();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// __SITE_LIVE__ makes site.js submit forms and send events as it does on Netlify.
await ctx.addInitScript(() => { window.__SITE_LIVE__ = true; });
await ctx.route('https://www.googletagmanager.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
const page = await ctx.newPage();

// JS errors, and any file of ours that fails to load. The made-up address is meant to be a 404.
const MADE_UP = '/no-such-page-xyz';
const jsErrors = [];
function watch(p) {
  p.on('pageerror', (e) => jsErrors.push(`${p.url()}: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.g/.test(m.text()) && !/status of 40[134]/.test(m.text())) jsErrors.push(`${p.url()}: ${m.text()}`);
  });
  p.on('response', (r) => {
    const u = new URL(r.url());
    // A wrong attendee code is tried on purpose below; its 401 is the right answer.
    const expected = u.pathname === MADE_UP || (u.pathname === '/api/toolkit-access' && r.status() === 401);
    if (u.origin === BASE && r.status() >= 400 && !expected) jsErrors.push(`${p.url()}: ${r.status()} ${u.pathname}`);
  });
}
watch(page);

const get = (path) => ctx.request.get(BASE + path, { maxRedirects: 0 });

// ---- 1. The addresses that are gone
for (const path of ['/book', '/book?topic=speaking']) {
  await step(`${path} returns 302 to /contact`, async () => {
    const r = await get(path);
    assert.equal(r.status(), 302);
    assert.equal(r.headers().location, '/contact');
  });
}
for (const path of ['/setup', '/api/bookings', MADE_UP]) {
  await step(`${path} returns 404`, async () => {
    const r = await get(path);
    assert.equal(r.status(), 404);
    assert.equal(r.headers().location, undefined, 'no redirect');
  });
}
await step('POST /api/bookings returns 404 and holds no time', async () => {
  const r = await ctx.request.post(`${BASE}/api/bookings`, { data: { date: '2099-01-06', time: '9:00 AM', name: 'x', email: 'x@y.co' } });
  assert.equal(r.status(), 404);
  assert.deepEqual((await state()).bookings, []);
});

// ---- 2. Sitemap and robots.txt
await step('sitemap lists only / and /contact', async () => {
  const xml = await (await get('/sitemap.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [`${siteUrl}/`, `${siteUrl}/contact`]);
});
await step('robots.txt keeps its rules and adds Disallow: /book', async () => {
  const lines = (await (await get('/robots.txt')).text()).split('\n').map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(lines, [
    'User-agent: *',
    'Disallow: /toolkit/',
    'Disallow: /attendee/',
    'Disallow: /thanks',
    'Disallow: /book',
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ]);
});

// ---- 3. The toolkit is locked, then unlocks with the attendee code
await step('toolkit is locked without the code, and the code is not in the page', async () => {
  const html = await (await fetch(`${BASE}/toolkit/`)).text();
  assert.ok(!html.includes('tpl-review'), 'toolkit content sent without the cookie');
  for (const code of [DEFAULT_CODE, ...EVENT_CODES.map((e) => e.code)]) {
    assert.ok(!html.toUpperCase().includes(code.toUpperCase()), 'an attendee code is in the code page');
  }
});
await step('toolkit unlocks with the attendee code', async () => {
  await page.goto(`${BASE}/toolkit/`);
  assert.equal(await page.locator('#gate-title').innerText(), 'Enter your attendee code');
  await page.fill('#gate-email', 'agent@example.com');
  await page.fill('#gate-code', 'nope');
  await page.click('#gate-form button[type=submit]');
  await page.locator('#gate-error').waitFor({ state: 'visible' });
  await page.fill('#gate-code', DEFAULT_CODE);
  await Promise.all([page.waitForLoadState('load'), page.click('#gate-form button[type=submit]')]);
  await page.locator('#tk-title').waitFor();
  await page.locator('#tpl-review').waitFor({ state: 'attached' });
  assert.equal((await state()).access.at(-1).email, 'agent@example.com');
});
await step('unlocked toolkit has no /book link', async () => {
  const r = await ctx.request.get(`${BASE}/toolkit/`);
  const html = await r.text();
  assert.ok(html.includes('tpl-review'), 'this is the unlocked toolkit');
  assert.ok(!/\/book\b/i.test(html), '/book is in the toolkit HTML');
  await page.goto(`${BASE}/toolkit/`);
  const hrefs = await page.$$eval('[href], [action], [data-href]', (els) => els.map((e) => e.getAttribute('href') || e.getAttribute('action') || e.getAttribute('data-href')));
  assert.deepEqual(hrefs.filter((h) => /(^|\/)(book|setup)([/?#.]|$)/.test(h)), []);
});

// ---- 4. Every page: nav, JSON-LD, internal links
// /toolkit/ is the unlocked toolkit from here on (the cookie is set); /attendee/ is the code page.
const pages = ['/', '/contact', '/thanks', '/attendee/', '/toolkit/', MADE_UP];
const linkProblems = [];
const checked = new Map();
let linkCount = 0;
for (const p of pages) {
  await page.goto(BASE + p);
  await step(`${p}: nav is only "Attendee toolkit" and "Contact"`, async () => {
    // The site menu. (The unlocked toolkit also has its own row of section tabs, all #anchors,
    // which the link check below covers.)
    const navs = await page.$$eval('.site-header nav, nav[aria-label="Main"]', (ns) => ns.map((n) => Array.from(n.querySelectorAll('a')).map((a) => [a.textContent.trim(), a.getAttribute('href')])));
    assert.equal(navs.length, 1, 'page has one site menu');
    for (const links of navs) assert.deepEqual(links, [['Attendee toolkit', '/toolkit/'], ['Contact', '/contact']]);
  });
  await step(`${p}: JSON-LD has no Offer, Service or price`, async () => {
    const blocks = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent));
    if (p === '/') assert.ok(blocks.length >= 1, 'home page has JSON-LD');
    const bad = [];
    const walk = (node, at) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${at}[${i}]`));
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (/price|offer/i.test(key)) bad.push(`${at}.${key}`);
        if (key === '@type' && [value].flat().some((t) => /offer|service/i.test(String(t)))) bad.push(`${at}.@type=${value}`);
        walk(value, `${at}.${key}`);
      }
    };
    for (const text of blocks) {
      walk(JSON.parse(text), '$');
      assert.ok(!/"(Offer|Service)"|price/i.test(text), 'Offer, Service or price in the JSON-LD text');
    }
    assert.deepEqual(bad, []);
  });

  const links = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  for (const href of new Set(links)) {
    if (/^(tel|mailto):/.test(href)) continue;
    const url = new URL(href, BASE + p);
    if (url.origin !== BASE) continue;
    linkCount++;
    if (href.startsWith('#')) {
      // A jump within the page that is open (also right on the 404 page, whose address has no file)
      if (href.length > 1 && !(await page.$(`[id="${href.slice(1)}"]`))) linkProblems.push(`${p}: ${href} → no such id on the page`);
      continue;
    }
    if (/^\/(book|setup)(\/|\.html)?$/.test(url.pathname)) { linkProblems.push(`${p}: links to ${href}`); continue; }
    const key = url.pathname + url.search;
    if (!checked.has(key)) {
      const r = await ctx.request.get(url.href);
      checked.set(key, { status: r.status(), html: /html/.test(r.headers()['content-type'] || '') ? await r.text() : '' });
    }
    const { status, html } = checked.get(key);
    if (status !== 200) linkProblems.push(`${p}: ${href} → ${status}`);
    else if (url.hash.length > 1 && !new RegExp(`id=["']${url.hash.slice(1)}["']`).test(html)) linkProblems.push(`${p}: ${href} → no #${url.hash.slice(1)} on the page`);
  }
}
await step(`all ${linkCount} internal links and anchors resolve, none to /book or /setup`, async () => assert.deepEqual(linkProblems, []));

// ---- 5. The contact form
await step('/contact form has the six fields and two topics', async () => {
  await page.goto(`${BASE}/contact`);
  const form = page.locator('#contact-form');
  assert.equal(await form.getAttribute('name'), 'contact');
  assert.equal((await form.getAttribute('method')).toUpperCase(), 'POST');
  assert.ok(await form.getAttribute('data-netlify'), 'a Netlify form');
  assert.equal(await form.locator('input[name="form-name"]').getAttribute('value'), 'contact');
  const honeypot = await form.getAttribute('netlify-honeypot');
  const names = await form.locator('[name]').evaluateAll((els) => els.map((e) => e.getAttribute('name')));
  assert.deepEqual(names.filter((n) => n !== 'form-name' && n !== honeypot), ['name', 'email', 'phone', 'market', 'topic', 'message']);
  assert.equal(await form.locator('select[name=topic] option').count(), 2);
});
await step('/contact form posts form-name=contact with every field', async () => {
  const sent = { name: 'Test Agent', email: 'test@example.com', phone: '555-0100', market: 'Compass, Lake Forest', message: 'Hello from the private test' };
  const topic = await page.locator('#c-topic option').nth(1).innerText();
  await page.fill('#c-name', sent.name);
  await page.fill('#c-email', sent.email);
  await page.fill('#c-phone', sent.phone);
  await page.fill('#c-market', sent.market);
  await page.selectOption('#c-topic', { index: 1 });
  await page.fill('#c-msg', sent.message);
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'POST'),
    page.click('#contact-form button[type=submit]'),
  ]);
  const posted = Object.fromEntries(new URLSearchParams(request.postData()));
  assert.equal(posted['form-name'], 'contact');
  for (const [k, v] of Object.entries({ ...sent, topic })) assert.equal(posted[k], v, k);
  await page.locator('#contact-status').waitFor({ state: 'visible' });
  const stored = (await state()).forms.find((f) => f['form-name'] === 'contact' && f.email === sent.email);
  assert.ok(stored, 'the stand-in for Netlify Forms received it');
  assert.equal(stored.topic, topic);
});

// ---- 6. Phone width: layout and accessibility
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.route('https://www.googletagmanager.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
await phone.addCookies(await ctx.cookies());
const mp = await phone.newPage();
watch(mp);
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

// ---- 7. No JS errors anywhere above
await step('no JS errors or missing files on any page', async () => assert.deepEqual(jsErrors, []));

await browser.close();
for (const [status, name, why] of results) console.log(`${status}  ${name}${why ? `\n      ${why}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
