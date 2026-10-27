# zerocostvisibility.com: setup and launch checklist

The pages live in `site/` (plain HTML, no build step). Server code lives in `netlify/`:
- `functions/bookings.ts`: the built-in booking calendar.
- `functions/toolkit-access.ts`: checks the attendee code.
- `edge-functions/toolkit-gate.ts`: keeps `/toolkit/` locked.

Data lives in Netlify Database. Its tables are created and updated automatically on deploy from `netlify/database/migrations/`.

**Deploys come from GitHub.** Every push to `main` deploys automatically. Don't drag a folder into Netlify: a manual upload doesn't include the server code or run the database migrations.

## Pages
| URL | What it is |
|---|---|
| `/` | Home |
| `/book` | Book a session (calendar) and contact form |
| `/toolkit/` | Starpower attendee toolkit. Locked; visitors without access see the code page at the same address |
| `/attendee/` | The code page itself |
| `/thanks.html` | Fallback thank-you page for the contact form |
| `/starpower` | Short link for the QR code on the closing slide |
| `/reviews` | Short link for the QR code on slide 14 (opens the review request) |

## One-time setup in Netlify (about 20 minutes)
1. **Connect the repo.** Project configuration > Build & deploy > Link repository > GitHub > `zerocostvisibility`. Set branch `main`, leave the build command empty, publish directory `site`.
2. **Attendee code.** Project configuration > Environment variables > Add:
   - `TOOLKIT_CODE` = `STARPOWER` (or whatever is on the closing slide; not case sensitive)
   - `TOOLKIT_SECRET` = any long random text, 32+ characters. A password manager's generator works. This signs the "already entered the code" cookie.

   Changing either value signs everyone out, so they'd need the code again.
3. **Form emails.** Forms > Form notifications > Email notification for `booking`, `contact` and `toolkit-access`, sent to the address that should receive them.
4. **Domain (later).** The site currently uses https://zerocostvisibility.netlify.app everywhere: canonical URLs, link previews, sitemap, robots.txt and the business details. Once you buy a domain, add it under Domain management and make it the primary domain. Then ask Claude to switch those addresses over, and add the new domain to the GA4 data stream and Search Console.

## Booking: Cal.com with Google Calendar and Google Meet (recommended)
`site/assets/config.js` is already set to Cal.com. Until its link is pasted in, the Book page falls back to the built-in calendar.

**Set up Cal.com (about 15 minutes, free plan):**
1. Sign up at cal.com **with Liz's Google account** and pick a username (e.g. `liz-federman`).
2. Apps > install **Google Calendar**, so it reads her real availability and adds each booking to her calendar. Then install **Google Meet**, so each booking gets a Meet link.
3. Event Types > New. Name it "1:1 Visibility Session". Set the length to 60 minutes and the location to **Google Meet**, set the hours Liz wants to offer, and set Limits > minimum notice to 2 days.
4. Apps > install **Stripe** and connect the account that should get paid. In the event's Apps tab, turn on Stripe and set the price to $297.
5. Paste the event link into `bookingUrl` in `site/assets/config.js` (e.g. `'liz-federman/visibility-session'`), or send it to Claude.
6. In GA4: Admin > Data streams > Website > Configure tag settings > List unwanted referrals > add `cal.com`. Then bookings credit the QR code or link the person came from, not Cal.com.
7. Test: set the price to $1, book, check that the invite with the Meet link and Liz's email arrive, refund in Stripe, then set the price back.

**Other options** in the same file:
- **Built-in** (`bookingUrl: ''`): visitors pick an open time and it's held so nobody else can take it. Liz gets an email (the `booking` form) and confirms by hand with the Google Meet link and payment. Open days, times, notice period and days off are set in `netlify/lib/booking-rules.ts`. To free a time after a cancellation, set that booking's `status` to `cancelled` in Netlify > Database.
- **Calendly** (`bookingProvider: 'calendly'`, `bookingUrl: 'https://calendly.com/…'`): taking payment at booking needs Calendly Standard ($10/mo).

## Google Analytics 4 and Search Console
1. **GA4:** analytics.google.com > Admin > Create property > Web data stream for zerocostvisibility.com. Copy the measurement ID (`G-…`) into `ga4Id` in `site/assets/config.js`. Tracking only runs on the live site.
2. **Key events:** in GA4 > Admin > Events, mark `generate_lead` (booking or contact form sent) and `toolkit_unlock` as key events.
3. **Events the site sends:**

   | Event | When | Details |
   |---|---|---|
   | `toolkit_unlock` | Attendee entered the right code | `source` = which QR code |
   | `toolkit_code_fail` | Wrong code entered | |
   | `copy_template` | A template was copied | `template_name`, `section` |
   | `print_toolkit` | Print or save PDF | |
   | `book_cta`, `toolkit_cta`, `contact_cta` | Button clicked | `location` = which button |
   | `booking_time_selected` | A time was picked | `method` |
   | `generate_lead` | Booking or contact form sent | `form`, `method` |
   | `contact_click` | Phone or email link tapped | `method` |

   Scans from each QR code show up in Acquisition > Traffic acquisition under campaign `starpower2026`. The content dimension is `closing-slide` or `slide14`.
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
`npm test` runs the unit tests. `npm run test:e2e` starts a local stand-in for Netlify and clicks every link, tab, copy button and form in Chromium. It also checks phone layout and accessibility. Playwright must be installed (`npm i -D playwright`, or a global install with `NODE_PATH=$(npm root -g)`).

## Notes
- Founding price on the Book page says $297 for the first 10 sessions, then $397. Edit `site/book.html` if that changes.
- Client photos (both closing selfies) need each client's OK before launch.
