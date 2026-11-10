# zerocostvisibility.com: setup and launch checklist

The pages live in `site/` (plain HTML). On every deploy, `scripts/build.mjs` copies them to `dist/` and fills in the site address (see **Site address** below). Server code lives in `netlify/`:
- `functions/bookings.ts`: the built-in booking calendar.
- `functions/toolkit-access.ts`: checks the attendee code.
- `edge-functions/toolkit-gate.ts`: keeps `/toolkit/` locked.

Data lives in Netlify Database. Its tables are created and updated automatically on deploy from `netlify/database/migrations/`.

**Deploys come from GitHub.** Every push to `main` deploys automatically. Don't drag a folder into Netlify: a manual upload doesn't include the server code or run the database migrations.

## Phase 1 and Phase 2
This branch is **Phase 1**: the site offers only the 1:1 session with Liz. The Visibility Setup page is saved in `phase2/setup.html` (not published), and `/setup` forwards to `/book`. The full version with the Setup is what's on `main` today; to bring it back, restore `phase2/setup.html` to `site/`, re-add the Setup card, menu link, contact topic, credit line and JSON-LD offer, and remove the `/setup` redirect in `netlify.toml`.

## Pages
| URL | What it is |
|---|---|
| `/` | Home |
| `/book` | Book the Visibility Audit (Cal.com calendar) and the contact form. `/book?topic=setup#contact` preselects the Setup in the contact form |
| `/toolkit/` | Attendee toolkit for RD Training Systems sessions and other talks. Locked; visitors without access see the code page at the same address |
| `/attendee/` | The code page itself |
| `/thanks.html` | Fallback thank-you page for the contact form |
| `/starpower` | Short link for the QR code printed on the closing slide (keep: the QR is already in the deck) |
| `/rd` | Short link to say out loud or print in RD Training Systems materials |
| `/reviews` | Short link for the QR code on slide 14 (opens the review request) |

## One-time setup in Netlify (about 20 minutes)
1. **Connect the repo.** Project configuration > Build & deploy > Link repository > GitHub > `zerocostvisibility`. Set branch `main`. Leave the build settings alone: `netlify.toml` sets the build command (`node scripts/build.mjs`) and publish directory (`dist`).
2. **Attendee code.** Project configuration > Environment variables > Add:
   - `TOOLKIT_CODE` = `STARPOWER` (or whatever is on the closing slide; not case sensitive)
   - `TOOLKIT_SECRET` = any long random text, 32+ characters. A password manager's generator works. This signs the "already entered the code" cookie.

   Changing either value signs everyone out, so they'd need the code again.
3. **Form emails.** Forms > Form notifications > Email notification for `booking`, `contact` and `toolkit-access`, sent to the address that should receive them.
4. **Domain (later).** See **Site address and domains** below.

## Site address and domains
The site's address is set in one place: `siteUrl` in `site.config.json`, currently `https://zerocostvisibility.netlify.app`. The build fills it into every canonical link, Open Graph tag, the JSON-LD business details, `sitemap.xml` and `robots.txt` (written as `{{SITE_URL}}` in the files under `site/`).

**Switching to zerocostvisibility.com:**
1. Netlify > Domain management > add `zerocostvisibility.com` and make it the **primary domain**.
2. Change `siteUrl` in `site.config.json` to `https://zerocostvisibility.com` (one line) and push.
3. Add the new domain to the GA4 data stream and to Search Console, and resubmit `sitemap.xml`.

**Extra domains:** `netlify.toml` already forwards `lizturnbaughfederman.com`, `lizfederman.com` (with and without `www`) and `www.zerocostvisibility.com` to `https://zerocostvisibility.com` with a 301. These rules do nothing until each domain is added under Domain management > **Add a domain alias**, so buy and attach them whenever you're ready.

## Booking: Cal.com with Google Calendar and Google Meet (recommended)
`site/assets/config.js` is already set to Cal.com. Until its link is pasted in, the Book page falls back to the built-in calendar.

**Set up Cal.com (about 15 minutes, free plan):**
1. Sign up at cal.com **with Liz's Google account** and pick a username (e.g. `liz-federman`).
2. Apps > install **Google Calendar**, so it reads her real availability and adds each booking to her calendar. Then install **Google Meet**, so each booking gets a Meet link.
3. Event Types > New. Name it "1:1 Visibility Session". Set the length to 60 minutes and the location to **Google Meet**, set the hours Liz wants to offer, and set Limits > minimum notice to 2 days.
4. Apps > install **Stripe** and connect the account that should get paid. In the event's Apps tab, turn on Stripe and set the price to $297.
   Then add the booking questions from `docs/cal-booking-questions.md` (the Book page tells visitors they'll answer them).
5. Paste the event link into `bookingUrl` in `site/assets/config.js` (e.g. `'liz-federman/visibility-session'`), or send it to Claude.
6. In GA4: Admin > Data streams > Website > Configure tag settings > List unwanted referrals > add `cal.com`. Then bookings credit the QR code or link the person came from, not Cal.com.
7. Test: set the price to $1, book, check that the invite with the Meet link and Liz's email arrive, refund in Stripe, then set the price back.

**Other options** in the same file:
- **Built-in** (`bookingUrl: ''`): visitors pick an open time and it's held so nobody else can take it. Liz gets an email (the `booking` form) and confirms by hand with the Google Meet link and payment. Open days, times, notice period and days off are set in `netlify/lib/booking-rules.ts`. To free a time after a cancellation, set that booking's `status` to `cancelled` in Netlify > Database.
- **Calendly** (`bookingProvider: 'calendly'`, `bookingUrl: 'https://calendly.com/…'`): taking payment at booking needs Calendly Standard ($10/mo).

## Google Analytics 4 and Search Console
1. **GA4:** analytics.google.com > Admin > Create property > Web data stream for zerocostvisibility.com. Copy the measurement ID (`G-…`) into `ga4Id` in `site/assets/config.js`. Tracking only runs on the live site.
2. **Key events:** in GA4 > Admin > Data display > Events, turn on **Mark as key event** for `generate_lead` (booking or contact form sent; contact forms carry the `topic`, so Setup inquiries show up as `topic = The Visibility Setup`), `toolkit_unlock` (attendee entered the code) and `booking_time_selected` (a visitor picked a time). Note: Cal.com's embed doesn't report a time being picked, so with Cal.com `booking_time_selected` stays at zero, and finished Cal.com bookings arrive as `generate_lead` with `method = cal`.
3. **Events the site sends:**

   | Event | When | Details |
   |---|---|---|
   | `toolkit_unlock` | Attendee entered the right code | `source` = which QR code |
   | `toolkit_code_fail` | Wrong code entered | |
   | `copy_template` | A template was copied | `template_name`, `section` |
   | `print_toolkit` | Print or save PDF | |
   | `setup_cta`, `book_cta`, `toolkit_cta`, `contact_cta` | Button clicked | `location` = which button (header, hero, options, setup, book, about…) |
   | `view_setup_pricing` | The price block on /setup scrolled into view (once per page view) | |
   | `booking_embed_fallback` | The Cal.com calendar didn't load within 8 seconds and the fallback showed | `reason` = `timeout` or `link_failed` |
   | `booking_time_selected` | A time was picked | `method` |
   | `generate_lead` | Booking or contact form sent | `form`, `method` |
   | `contact_click` | Phone or email link tapped | `method` |

   **UTM convention for QR codes and links:** `utm_source` = where it was shown (`starpower`), `utm_medium` = the channel (`qr`), `utm_campaign` = the event and year (`starpower2026`), `utm_content` = the exact spot (`closing-slide`, `slide14`). The short links `/starpower` and `/reviews` add these tags; reuse the pattern for future talks (for example `/rotary` → `utm_source=rotary&utm_medium=qr&utm_campaign=rotary2027&utm_content=closing-slide`). Scans show up in Acquisition > Traffic acquisition under the campaign name, and the toolkit unlock event carries `utm_content` as `source`.
4. **Search Console:** while the site is on netlify.app, use Add property > **URL prefix** > `https://zerocostvisibility.netlify.app/`, verified with the HTML tag method: paste the `<meta>` tag at the marked spot in `site/index.html`. Then go to Sitemaps and submit `sitemap.xml`. Once you own a domain, add it as a Domain property and verify it with a DNS TXT record.

## Who opened the toolkit
Netlify > Database > `toolkit_access` lists every email that entered the right code, with the QR code it came from. The same people also appear under Forms > `toolkit-access`.

## Test before Nov 7
- Scan both QR codes from a printed slide, on cellular, not Wi-Fi. Slide 14 should land on the review request after the code.
- Enter a wrong code, then the right one. Copy a template and paste it into a text.
- Request a time on the Book page and confirm the email arrives. Then set that booking to `cancelled` and check the time opens up again.
- Submit the contact form and confirm the email arrives.
- If using Calendly or Cal.com: book and pay a $1 test session, then refund it.
- In GA4 > Reports > Realtime, check that your own visit and events show up.

## Automated checks
`npm run build` builds `dist/`. `npm test` runs the unit tests. `npm run test:e2e` builds, then starts a local stand-in for Netlify and clicks every link, tab, copy button and form in Chromium. It also checks phone layout, accessibility, the palette, the copy rules (no em dashes or banned words, nothing from the gated toolkit on public pages) and the Cal.com fallback. Playwright must be installed (`npm i -D playwright`, or a global install with `NODE_PATH=$(npm root -g)`).

## Notes
- Founding price on the Book page says $297 for the first 10 sessions, then $397. Edit `site/book.html` if that changes.
- The Setup's price ($997 founding for the first 5 agents, then $1,497) is on `site/setup.html` and in the home page options; the JSON-LD offers are in `site/index.html`.
- Client photos (both closing selfies) need each client's OK before launch.
