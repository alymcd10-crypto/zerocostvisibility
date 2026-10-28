# UI review: Phase 1 site

Reviewed 2026-10-28 on branch `claude/zen-wright-wn09ji` (PR #3, commit `7fc67ba`).
Pages: Home, Book, Toolkit gate, unlocked Toolkit. Viewports: 390px phone and 1440px desktop,
from a local build of the site. Contrast ratios computed from the palette in `site/assets/site.css`.

Scores run 1 to 4: 1 = broken, 2 = needs work, 3 = good, 4 = excellent.

| Pillar | Score | One line |
|---|---|---|
| Copywriting | 3 | Specific and short. One label is inconsistent and the toolkit tabs get cut off. |
| Visuals | 3 | Real photos, well cropped. Three photos of Liz on one page is one too many. |
| Color | 3 | Palette is consistent and readable. Pink barely shows on the public pages. |
| Typography | 3 | Clear hierarchy. The 10px header tagline is too small. |
| Spacing | 3 | Even rhythm after the phone fixes. Book page has a large empty block when the calendar is slow. |
| Experience | 3 | Clear paths to book. A few links are too small to tap. |

**Overall: 3 / 4.** Nothing is broken. The fixes below are small and most take a few minutes each.

## What was checked

- Full-page screenshots of every page at both widths.
- Heading order, image alt text, tap-target sizes, font sizes in use, horizontal overflow.
- WCAG contrast for every text/background pair the palette uses.
- Word count per page (Home 282, Book 442, Toolkit gate 171, unlocked Toolkit 1,455).
- The method stays behind the code: no step name appears on a public page (the browser tests enforce this).

## Copywriting: 3

Works well
- Every page opens with a specific claim and a number: "$379K to $45M+", "$297", "115+ reviews".
- The Book page sells the hour (why book, who it's for, proof, FAQ) without describing the method.
- Short sentences, no jargon, no filler words.

Fix
1. **Button labels disagree.** The hero says "Book a 1:1 session"; the header, option card and About section say "Book a session". Use one label. Recommend "Book a session" everywhere.
2. **Toolkit tabs are cut off on phones.** The tab row scrolls sideways and the second tab reads "02 The ninety-second as". Shorten the tab labels (for example "01 Posts · 02 Groups · 03 Reviews · 04 AI · 05 Year after") or let them wrap to two rows.
3. **"Pick a time" box text is small.** On desktop the only copy in the booking card is 13px grey. Raise it to 15px so people read the "send a note" fallback.

## Visuals: 3

Works well
- All photos are real-looking, cropped so faces stay in frame on phones, and each appears once.
- The stage photo on the session card and the "Just Closed" family photo earn their place.
- Every image has alt text (decorative ones are empty, as they should be).

Fix
1. **Three photos of Liz on the home page** (hero, session card, About). The About headshot and the hero are both front-facing portraits in white tops. Swap the About photo for the second closing photo (`closing-2.jpg`, a family at their new door), which currently isn't used anywhere.
2. **The band photo is low resolution** (1000×750) and shows soft edges at 1440px. If a larger original exists, replace it.
3. **The envelopes photo** on "Ask a question first" reads as stock. It's fine, but a photo of Liz's actual handwritten cards would fit the story better.

## Color: 3

Works well
- One palette on every page: paper, navy, gold, blush. Buttons, links and focus rings all use it.
- Contrast passes comfortably for body text: ink on paper 13:1, muted grey on paper 7:1, paper on navy 14:1.
- Gold italic headings (`#8A6A37` on paper) hit 4.6:1, which passes AA for text.

Fix
1. **The lighter gold (`#A88445`) is 3.2:1 on paper.** It's only used for hairlines and focus outlines today, which is fine. Don't use it for text.
2. **Pink is almost invisible on public pages.** It appears as a 2px underline under the current nav item and a 1px line above the footer. If pink is part of the brand, give it one deliberate place per page (for example the eyebrow labels or the "Is this a fit?" rules). If not, that's fine too; just know it's effectively absent.
3. **The error red (`#9B2C2C`)** on the gate form is fine (6.7:1), no change.

## Typography: 3

Works well
- Two families with clear jobs: Cormorant Garamond for headings and big numbers, Libre Franklin for everything else.
- Headline sizes scale from 44px on phones to 76px on desktop and never wrap awkwardly.
- Lining numerals in headings, so "$45M+" and "115+" sit on the baseline.

Fix
1. **Header tagline is 10px** ("Visibility strategy for agents"). Minimum should be 12px. Raise it to 12px or drop the tagline on phones.
2. **17 distinct size/weight combinations** on the home page. It reads fine, but 12px, 13px, 13.5px and 14px are all in use for small text. Collapse to 13px and 14px.
3. **Cormorant at 21–24px for FAQ questions** is on the small side for a display serif. Raise FAQ summaries to 26px on desktop.

## Spacing: 3

Works well
- Consistent 1180px container, 24px side gutters, and no horizontal overflow at any width.
- Phone section padding was cut from 72px to 40px; the session card now appears right after the hero.
- Cards, list rows and detail tables share the same hairline rhythm.

Fix
1. **Book page right column.** Until the Cal.com calendar loads, the "Pick a time" card is a small white box next to a long text column, leaving a tall empty area on desktop. Give the booking card a minimum height (about 520px) with a light placeholder, so the layout doesn't shift when the calendar arrives.
2. **"Is this a fit?" and "Why listen to Liz"** are capped at 860px and left-aligned, leaving the right third of the screen empty on desktop. Either centre them or add a photo in the empty space. Centring is the simpler fix.
3. **Toolkit page is 10,000px tall on phones.** The tab row at the top is the only navigation. Make it sticky so people can jump between steps without scrolling back up.

## Experience: 3

Works well
- One primary action on every page, always "Book a session", always navy.
- Skip link, visible focus rings, labelled form fields, a honeypot instead of a captcha.
- The gate explains where the code is ("on the last slide") and the error says what went wrong.
- Phone first: Liz's photo leads, then the headline, then the button.

Fix
1. **Small tap targets.** "Saw me speak? Open the toolkit" is 23px tall and the inline "Send a note" link in the booking card is 16px. Apple and Google both ask for 44px. Add vertical padding to both, or turn the hero link into a secondary button.
2. **Form submissions aren't reaching anyone yet.** This is a Netlify setting, not a code bug: turn on form detection, redeploy, and add an email notification. Until then the contact form shows "sent" but no one receives it.
3. **The booking card depends on Cal.com loading.** The 8-second fallback works (tested), but 8 seconds is long. Cut it to 4.
4. **Toolkit "Copy template" gives no feedback beyond the label change.** It works, but a brief "Copied" toast would be clearer on phones where the button may be off-screen after tapping.

## Suggested order

Do these first (under an hour total):
1. One button label: "Book a session".
2. Header tagline 10px → 12px.
3. Tap targets: hero text link and booking-card link.
4. About photo → `closing-2.jpg`.
5. Shorten toolkit tab labels and make the tab row sticky.

Then:
6. Booking card minimum height and 4-second fallback.
7. Centre the "fit" and "proof" sections on desktop.
8. Netlify forms (settings, not code).

Not recommended: adding more copy to the home page. At 282 words it's doing its job, and the Book page carries the detail.
