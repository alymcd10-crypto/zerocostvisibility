# zerocostvisibility.com: launch checklist

The site lives in `site/`. There is no build step for the pages. The booking calendar's backend is a Netlify Function (`netlify/functions/bookings.ts`) backed by Netlify Database; its table is created automatically on deploy. The `netlify.toml` at the repo root tells Netlify to publish `site/`, so every push to `main` deploys automatically.

## Pages
- `/` Home
- `/book` Book a session (calendar) + contact form
- `/toolkit/` Starpower attendee toolkit (attendee code + email, then every template with copy buttons)
- `/thanks.html` Fallback thank-you page for the contact form
- Short links for the deck QR codes: `/starpower` (closing slide) and `/reviews` (slide 14)

## Go live (about 30 minutes)
1. **Buy the domain** zerocostvisibility.com (about $11/yr), or add it in Netlify > Domain management > Buy a domain.
2. **Netlify:** app.netlify.com > Add new project > Deploy manually > drag this folder in. You get a preview URL ending in netlify.app; test there first.
3. **Domain:** in Netlify, Domain management > Add a domain > zerocostvisibility.com, then follow the DNS steps. HTTPS turns on automatically.
4. **Form emails:** Netlify > Forms > Form notifications > Email notification for `booking`, `contact` and `toolkit-access` to the address that should receive them. `booking` holds the day and time someone picked on the Book page calendar.
5. **Booking calendar:** the Book page has a built-in calendar. Visitors pick an open day and time, and that time is saved in the site's database so nobody else can take it (taken times show as crossed out). Liz gets each request by email through the `booking` form and confirms with the Zoom link and payment. Open days, times, notice and days off are in the `BOOKING` settings near the top of `site/assets/site.js` (Tue/Wed/Thu at 9:00, 11:00, 1:30 and 4:00 Central to start). To free up a time after a cancellation, set that booking's status to `cancelled` in the database (Netlify > Database).
   **Later, for instant booking and payment (optional):** create the "1:1 Visibility Session" event in Cal.com (60 min, Zoom, price), connect Stripe in the Cal.com app store, then set `var CAL_LINK = '';` in the same file to your Cal.com link (for example `'liz-federman/visibility-session'`). Cal.com then replaces the built-in calendar.
6. **Attendee code:** it's `STARPOWER` (not case sensitive). To change it, find `var ACCESS_CODE = 'STARPOWER';` in the same file.

## Test before Nov 7
- Scan both QR codes from a printed slide, on cellular, not Wi-Fi.
- Enter a wrong code, then the right one. Copy a template and paste it into a text.
- Scan the slide 14 QR code on a fresh phone: after the code it should land on the review request.
- Request a time on the Book page calendar and confirm the email arrives.
- Submit the contact form and confirm the email arrives.
- Book and pay a $1 test session, then refund it in Stripe.

## Notes
- The attendee code is a speed bump, not a real lock. For a true password, move `/toolkit/` to its own Netlify project on Netlify Pro and turn on Password visibility.
- Founding price on the Book page says $297 for the first 10 sessions, then $397. Edit `site/book.html` if that changes.
- Client photos (both closing selfies) need each client's OK before launch.
