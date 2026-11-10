# Launch checklist: take the site live and run the event

One page to work from. Written 10 November 2026. Event: The REset Executive Training, RD Training Systems, 15 to 16 December 2026, The Ritz-Carlton, Tysons Corner, McLean, VA. Talk: "You Don't Need to Buy Leads. You Need to Be Findable." Deck v7.9.

Tick each box as it is done. Items marked (Aly) are Aly's; (Liz) are Liz's.

## A. Settings only a person can change

### Netlify environment variables
Path: Netlify > the zerocostvisibility project > Project configuration > Environment variables > Add a variable.

- [ ] `TOOLKIT_CODES` = `RDTraining2026,STARPOWER` (comma between, no spaces; both codes open the toolkit)
- [ ] `TOOLKIT_SECRET` = a random string of 32 or more characters. To make one, run in any terminal: `openssl rand -hex 32`. Paste the result. This signs the "already entered the code" cookie. Changing it later signs everyone out, so set it once and do not touch it.
- [ ] `BOOKING_PROVIDER` = `cal`
- [ ] Redeploy after saving (Deploys > Trigger deploy), because variables only apply to new builds.

### Cal.com naming
- [ ] Rename the Cal.com event to "Zero-Cost Visibility Session" (it currently reads "1:1 Visibility Session").
- [ ] Set the Cal.com host display name to "Liz Turnbaugh Federman" (no hyphen).

### Netlify Forms notifications
Path: Netlify > Forms > Form notifications > Add notification > Email notification.

- [ ] Add an email notification for `booking` only to Liz's address.
- [ ] Add an email notification for `contact` only to Liz's address.
- [ ] Do NOT add a notification for `toolkit-access`. Every attendee who opens the toolkit would send an email during the talk. The Netlify database is the list, not the inbox.

### Cal.com (Liz's account)
Path: Event Types > 1:1 Visibility Session.

- [ ] Advanced > Booking questions: the four in `docs/cal-booking-questions.md`:
  1. Your brokerage and the towns you sell in (short text, required)
  2. Links to your Zillow and Google Business profiles (long text, optional)
  3. What would you most like help with? (More referrals / More reviews / More repeat business / Not sure yet) (short text, required)
  4. How did you hear about this? (RD talk / binder / other) (short text, optional)
- [ ] Event description (Setup tab) contains the booking terms:
  - Cancel at least 48 hours before the session for a full refund.
  - One reschedule per booking.
  - A missed session without notice is not refunded.
  - If Liz cancels, you choose a new time or a full refund.
  Liz must approve this wording first (see section G). Publish the same four lines on the book page.
- [ ] Limits > Minimum notice: 24 hours.
- [ ] Limits > Weekly cap: a number Liz can honor (Liz chooses, see section G).
- [ ] Availability > Date overrides: block 15 to 17 December, and 24 December to 1 January.
- [ ] Apps > Stripe connected, event price set to $297.
- [ ] Settings > Developer > API keys: revoke the key that was pasted into chat in October and create a new one only if something still needs it. Check that Stripe and Netlify have no leftover tokens from the same period.

### Second admin on every account
- [ ] Netlify: add a second owner or member (Team settings > Members).
- [ ] Cal.com: add a second admin (or a team with two admins).
- [ ] Stripe: Settings > Team and security > add a user with Administrator role.
- [ ] GA4: Admin > Account access management > add a second user with Administrator role.
- [ ] Why: the toolkit list can only be exported from Netlify, and one lost login would lock out everything during the event.

### GA4 key events
Path: GA4 > Admin > Data display > Events > turn on Mark as key event.

- [ ] `toolkit_unlock` (someone entered a valid code)
- [ ] `generate_lead` (booking or contact form sent; Cal.com bookings arrive here with `method = cal`)
- [ ] `book_cta` (someone clicked a book button)
- [ ] Also confirm cal.com is on the unwanted referrals list (Admin > Data streams > Configure tag settings > List unwanted referrals).

## B. Go-live

### Merge order
- [ ] Open the pull request from branch `claude/findable-golive` into `main`. Read the changed-files list once. Merge it. Every push to `main` deploys automatically; do not drag a folder into Netlify.
- [ ] Do the Netlify settings in section A before or immediately after the merge, then redeploy once so the variables are live.
- [ ] Do not change the primary domain or `siteUrl` before 17 December. The printed addresses use zerocostvisibility.netlify.app.

### Verify after the deploy finishes (use the production address, https://zerocostvisibility.netlify.app)
- [ ] `/setup` forwards to `/book` (the address bar ends in `/book`).
- [ ] `/rd` opens the toolkit page (code form if signed out).
- [ ] `/reviews` opens the review request page.
- [ ] `/starpower` still forwards to the toolkit page.
- [ ] `/rd-binder` opens the toolkit page.
- [ ] `/book-rd` opens the booking page.
- [ ] Code `RDTraining2026` opens the toolkit. Use a private window.
- [ ] Code `STARPOWER` opens the toolkit. Use a second private window.
- [ ] `/privacy` and `/terms` load, and both are linked in the footer.
- [ ] Home page shows one offer ($297 session), no $997 or $1,497.
- [ ] The word "Starpower" appears nowhere on a visible page (the `/starpower` path and the code are the only survivors).
- [ ] GA4 Realtime shows your visit and a `toolkit_unlock` event.

## C. $1 end-to-end booking test (on a phone)

Do this once, on a phone, on cellular. Allow 20 minutes.

- [ ] In Cal.com, set the Stripe price on the event to $1. Note that you must set it back.
- [ ] On the phone, open `/book`, choose a time, answer the four questions, pay with a real card.
- [ ] Confirm all of these arrived: the calendar invite with the Google Meet link, the Cal.com confirmation email, the Stripe receipt, and Liz's notification email.
- [ ] Open the invite on the phone and confirm the Meet link works.
- [ ] Refund the $1 in Stripe (Payments > the charge > Refund).
- [ ] Cancel the test booking in Cal.com so the slot reopens.
- [ ] Set the price back to $297 and check the event page shows $297. Write down the date and result here: ______

## D. Dec 12 rehearsal test (on cellular)

Turn Wi-Fi off on the phone. Use a screen, not a printout, from a few meters away.

- [ ] Scan the slide 30 QR code. It must land on the toolkit page. (Slide 30 QR points to `/rd`.)
- [ ] Type `RD Training 2026` with a space in the code box. It must open the toolkit.
- [ ] Copy three templates and paste them into a text message. Check that each pasted correctly.
- [ ] Scan the slide 25 QR code. It must land on the review request page. (Slide 25 QR points to `/reviews`.)
- [ ] Open the book page and go through the booking flow up to the payment screen. Do not pay.
- [ ] Repeat the slide 30 scan once from a second phone to check the site holds when two people arrive together.
- [ ] Check GA4 Realtime showed the visits and the `toolkit_unlock` event.

## E. Event days (15 and 16 December)

- [ ] Name one person who watches the inbox (Liz's address and the Netlify form emails) and the Netlify status page (netlifystatus.com) during both days: ______ . Give them Liz's cell number and both admin logins.
- [ ] They check the site on cellular at 8:30 AM each day, and again right after Liz's slot.
- [ ] Liz's slot time within the two days is not confirmed yet. Get it from RD and write it here: ______
- [ ] If the site is down: do not troubleshoot on stage. The binder has every template in the appendix (A-01 to A-13). Tell the room, "Everything is printed in your binder. The web address and the code are on the last page: zerocostvisibility.netlify.app, code RDTraining2026." Read the address and the code aloud, then spell the code once. Fix the site afterward and send the Dec 17 email as planned.
- [ ] Do not change settings, redeploy, or rotate secrets on 15 or 16 December unless the site is down.

## F. After the event

- [ ] 17 December: send the first email of the sequence in `docs/EMAILS.md` (day 1). Day 4 is 20 December. Day 8 is 24 December: consider moving the session email to 28 December if Liz is away, and check that the weekly cap and blocked dates still match.
- [ ] Read GA4 by `utm_content` (Reports > Acquisition > Traffic acquisition, add the secondary dimension Session manual ad content). The slide 30 QR, the binder QR and the typed address should show as separate sources. Add the booking question 4 answers (RD talk / binder / other) from Cal.com.
- [ ] Export the toolkit list: Netlify > Database > `toolkit_access` > export, or Forms > `toolkit-access` if the database export is not available. Remove duplicate emails. Load the list into the email service chosen in section G.
- [ ] Get the room headcount from RD to use as the denominator for scans, unlocks and bookings.
- [ ] Write the result of the first week here: scans ____ , unlocks ____ , bookings ____ .

## G. Decisions still open

| # | Decision | Owner | Needed by |
|---|---|---|---|
| 1 | Board2Door closing board offer on slide 12 ("30% off, code in your toolkit"). The code and discount are not confirmed, so the toolkit has none. If Liz gets a code or commission, it must be disclosed. | Aaron | Before 15 December |
| 2 | May Liz mention the session from RD's stage? Ask RD in writing. If no, the toolkit page carries the session banner and slide 30 stays toolkit only. | Liz, RD | This week |
| 3 | Session fee split between Liz and whoever runs the site and bookings, and who is the Stripe payee. | Liz, Aly | Before first booking |
| 4 | Weekly cap on sessions (a number Liz can honor, over the holidays especially). | Liz | Before Cal.com is set |
| 5 | Counsel review of the privacy and terms pages and of the results wording ("These are my results with a team behind me. I can't promise yours."). | Liz, counsel | Before 15 December |
| 6 | Broker approval to sell a marketing service under her licence with RE/MAX Suburban, and whether income must route through the brokerage. | Liz, managing broker | Before 15 December |
| 7 | Current numbers before 15 December. The year-to-date figures stop at 16 October ($40.1M closed, $46.5M on track). Refresh the deck and the site together. | Liz, Aly | Before 15 December |
| 8 | Email service (ESP). It must supply the unsubscribe link and a mailing address. Use the team's existing one if there is one. | Aly | Before 17 December |
| 9 | Approve the booking terms wording (section A) and the four emails in `docs/EMAILS.md`. | Liz | Before 17 December |

## Reference
- Facts and rules: the numbers, the code, and the copy rules in this project's brief. The deck text wins over anything older.
- Setup detail: `readme-setup.md`. Master record: `docs/MASTER.md`. Emails: `docs/EMAILS.md`. Booking questions: `docs/cal-booking-questions.md`.
