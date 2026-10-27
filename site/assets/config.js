// ---- Site settings: the only file to edit for tracking and booking ------------
window.SITE_CONFIG = {
  // Google Analytics 4 measurement ID, from GA4 > Admin > Data streams > Web.
  // Looks like 'G-ABC123XYZ'. Leave empty to turn tracking off.
  ga4Id: '',

  // How the Book page takes bookings:
  //   'built-in'  the site's own calendar (Liz gets an email per request, confirms by hand)
  //   'calendly'  Calendly inline scheduler; bookingUrl like 'https://calendly.com/liz-federman/visibility-session'
  //   'cal'       Cal.com inline scheduler; bookingUrl like 'liz-federman/visibility-session'
  // Calendly and Cal.com send the calendar invite and the email notifications themselves.
  // If bookingUrl is empty the built-in calendar is used.
  // Recommended: Cal.com connected to Liz's Google Calendar and Google Meet, with Stripe.
  // Paste the event link (e.g. 'liz-federman/visibility-session') once it exists.
  bookingProvider: 'cal',
  bookingUrl: 'liz-turnbaugh-federman-realtor-n8x6v9/visibility-session'
};
