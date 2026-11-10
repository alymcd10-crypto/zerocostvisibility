(function () {
  // Settings live in assets/config.js (GA4 ID, booking provider). Booking rules for the
  // built-in calendar live in netlify/lib/booking-rules.ts and arrive from /api/bookings.
  var CONFIG = window.SITE_CONFIG || {};
  var CONTACT_EMAIL = 'liz@listingsbyleslie.com';

  // Forms and analytics only run on the real site (or when the end-to-end test sets __SITE_LIVE__)
  var isLive = window.__SITE_LIVE__ === true || /(^|\.)zerocostvisibility\.com$|netlify\.app$/.test(location.hostname);
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);

  // ---- Analytics (GA4) -----------------------------------------------------
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  if (CONFIG.ga4Id && isLive) {
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.ga4Id);
    document.head.appendChild(tag);
    gtag('js', new Date());
    gtag('config', CONFIG.ga4Id);
  }
  function track(name, data) {
    try { window.gtag('event', name, data || {}); } catch (e) {}
  }

  // Any link or button with data-track="event_name" (and optional data-track-location) is tracked.
  // Phone and email links are tracked as contact_click.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track], a[href^="tel:"], a[href^="mailto:"]');
    if (!el) return;
    if (el.hasAttribute('data-track')) {
      track(el.getAttribute('data-track'), { location: el.getAttribute('data-track-location') || '', link_text: el.textContent.trim().slice(0, 60) });
    } else {
      track('contact_click', { method: el.getAttribute('href').slice(0, el.getAttribute('href').indexOf(':')) });
    }
  });

  function encode(form) {
    return new URLSearchParams(new FormData(form)).toString();
  }

  function submitToNetlify(form) {
    if (!isLive) return Promise.resolve('preview');
    return fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encode(form)
    }).then(function (r) { if (!r.ok) throw new Error('Form error ' + r.status); return 'sent'; });
  }

  function scrollToEl(el) {
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  // ---- Copy buttons: <button class="copy-btn" data-copy="element-id"> -----------
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var label = btn.textContent;
    var reset = function () { btn.textContent = label; btn.classList.remove('done'); };
    btn.addEventListener('click', function () {
      var src = document.getElementById(btn.getAttribute('data-copy'));
      if (!src) return;
      var text = src.innerText.trim();
      var card = btn.closest('[data-template]');
      track('copy_template', {
        template_id: btn.getAttribute('data-copy'),
        template_name: card ? card.getAttribute('data-template') : '',
        section: (btn.closest('section[id]') || {}).id || ''
      });
      var done = function () {
        btn.textContent = 'Copied';
        btn.classList.add('done');
        setTimeout(reset, 2200);
      };
      var fallback = function () {
        var range = document.createRange();
        range.selectNodeContents(src);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = 'Selected. Press Ctrl+C or Cmd+C';
        setTimeout(reset, 4000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });

  // ---- Attendee code page (/attendee/, also shown at /toolkit/ until unlocked) ----
  var gate = document.getElementById('gate-form');
  if (gate) {
    if (location.hash && location.pathname.indexOf('/toolkit') === 0) {
      var hint = document.getElementById('gate-hint');
      if (hint) hint.hidden = false;
    }
    gate.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = document.getElementById('gate-error');
      var btn = gate.querySelector('button[type="submit"]');
      var f = gate.elements;
      var source = params.get('utm_content') || '';
      btn.disabled = true;
      err.hidden = true;
      fetch('/api/toolkit-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: f['email'].value, code: f['code'].value, source: source, 'company-website': f['company-website'].value })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.ok) {
            track('toolkit_unlock', { source: source });
            // Adds the attendee to Liz's Netlify form list; the unlock never waits on it.
            var sent = submitToNetlify(gate).catch(function () {});
            var go = function () {
              // Reloading would put the visitor back where they were on the code page;
              // the toolkit scrolls to the #section itself.
              try { history.scrollRestoration = 'manual'; } catch (e2) {}
              if (location.pathname.indexOf('/toolkit') === 0) location.reload();
              else location.href = '/toolkit/';
            };
            Promise.race([sent, new Promise(function (res) { setTimeout(res, 1500); })]).then(go);
            return;
          }
          if (r.status === 401) track('toolkit_code_fail');
          showError(data.error || (r.status === 429 ? 'Too many tries. Please wait a minute and try again.' : "Something went wrong. Please try again."));
        });
      }).catch(function () {
        showError("You're offline or the connection dropped. Please try again.");
      });

      function showError(message) {
        btn.disabled = false;
        err.textContent = message;
        err.hidden = false;
        f['code'].focus();
      }
    });
  }

  // ---- Toolkit: tabs highlight the section on screen, print button ------------
  var tkNav = document.querySelector('.tk-tabs');
  if (tkNav) {
    var printBtn = document.querySelector('[data-print]');
    if (printBtn) printBtn.addEventListener('click', function () { track('print_toolkit'); window.print(); });
    var links = Array.prototype.slice.call(tkNav.querySelectorAll('a[href^="#"]'));
    if ('IntersectionObserver' in window && links.length) {
      var byId = {};
      links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
          var a = byId[en.target.id];
          if (a) { a.classList.add('is-current'); a.setAttribute('aria-current', 'true'); }
        });
      }, { rootMargin: '-120px 0px -60% 0px' });
      Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }
    // Arriving from the slide 14 QR code (#step3) right after unlocking: land on the section
    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      var jump = function () { target.scrollIntoView({ block: 'start', behavior: 'instant' }); };
      if (target) {
        requestAnimationFrame(jump);
        // Again once fonts and images have loaded and the page has settled
        window.addEventListener('load', function () { setTimeout(jump, 0); });
      }
    }
  }

  // ---- Events for sections seen on screen: <div data-track-view="event_name"> ----
  // Fires once per page view, e.g. view_setup_pricing on /setup.
  var viewed = document.querySelectorAll('[data-track-view]');
  if (viewed.length && 'IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        track(en.target.getAttribute('data-track-view'));
        seen.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    viewed.forEach(function (el) { seen.observe(el); });
  }

  // ---- Contact form ---------------------------------------------------------
  var contact = document.getElementById('contact-form');
  if (contact) {
    // /book?topic=setup#contact (or #contact?topic=setup) preselects the Setup topic
    var topic = params.get('topic') || new URLSearchParams(location.hash.split('?')[1] || '').get('topic');
    var topics = { setup: 'The Visibility Setup', speaking: 'Speaking at my event' };
    if (topic && topics[topic]) contact.elements['topic'].value = topics[topic];
    if (/^#contact\?/.test(location.hash)) {
      var contactSection = document.getElementById('contact');
      if (contactSection) requestAnimationFrame(function () { contactSection.scrollIntoView({ block: 'start' }); });
    }
    contact.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('contact-status');
      var btn = contact.querySelector('button[type="submit"]');
      btn.disabled = true;
      submitToNetlify(contact).then(function (state) {
        track('generate_lead', { form: 'contact', topic: contact.elements['topic'].value });
        contact.hidden = true;
        msg.hidden = false;
        msg.textContent = state === 'preview'
          ? 'Preview only: messages start arriving once the site is live on Netlify.'
          : "Thanks, your note is on its way to Liz. She replies within two business days.";
      }).catch(function () {
        btn.disabled = false;
        msg.hidden = false;
        msg.textContent = "Your message didn't send. Please try again, or email " + CONTACT_EMAIL + '.';
      });
    });
  }

  // ---- Booking: Calendly, Cal.com, or the built-in calendar --------------------
  var embedBox = document.getElementById('booking-embed');
  var booker = document.getElementById('booker');
  var provider = CONFIG.bookingUrl ? CONFIG.bookingProvider : 'built-in';
  if (embedBox && provider === 'calendly') {
    initCalendly(embedBox, CONFIG.bookingUrl);
    if (booker) booker.hidden = true;
  } else if (embedBox && provider === 'cal') {
    initCal(embedBox, CONFIG.bookingUrl);
    if (booker) booker.hidden = true;
  } else if (booker) {
    initBooker(booker);
  }
  if (embedBox && provider !== 'built-in') {
    var note = document.getElementById('booking-note');
    if (note) note.innerHTML = 'You pay when you book and get a calendar invite right away. None of these times work? <a href="#contact">Send a note</a> with a few that do.';
  }

  // Passes the visit's UTM tags through so bookings show which slide or link they came from.
  function withUtm(url) {
    var u = new URL(url, location.href);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
      if (params.get(k) && !u.searchParams.get(k)) u.searchParams.set(k, params.get(k));
    });
    return u.toString();
  }

  function initCalendly(box, url) {
    box.classList.add('calendly-inline-widget');
    box.setAttribute('data-url', withUtm(url + (url.indexOf('?') === -1 ? '?' : '&') + 'hide_gdpr_banner=1'));
    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    document.head.appendChild(s);
    window.addEventListener('message', function (e) {
      if (e.origin !== 'https://calendly.com' || !e.data || typeof e.data.event !== 'string') return;
      if (e.data.event === 'calendly.date_and_time_selected') track('booking_time_selected', { method: 'calendly' });
      if (e.data.event === 'calendly.event_scheduled') track('generate_lead', { form: 'booking', method: 'calendly' });
    });
  }

  function initCal(box, link) {
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
    window.Cal('init', { origin: 'https://cal.com' });
    window.Cal('inline', { elementOrSelector: '#' + box.id, calLink: link, layout: 'month_view' });
    var booked = false;
    var onBooked = function () { if (!booked) { booked = true; track('generate_lead', { form: 'booking', method: 'cal' }); } };
    window.Cal('on', { action: 'bookingSuccessfulV2', callback: onBooked });
    window.Cal('on', { action: 'bookingSuccessful', callback: onBooked });

    // Never leave "Pick a time" blank: if Cal.com hasn't drawn its calendar in 8 seconds
    // (blocked script, slow network, ad blocker), offer the calendar on its own page and a note.
    var fallback = document.getElementById('booking-fallback');
    var showFallback = function (reason) {
      if (!fallback || !fallback.hidden || (reason === 'timeout' && box.querySelector('iframe'))) return;
      var direct = document.getElementById('booking-fallback-link');
      if (direct) direct.href = withUtm('https://cal.com/' + link);
      fallback.hidden = false;
      track('booking_embed_fallback', { reason: reason });
    };
    window.Cal('on', { action: 'linkFailed', callback: function () { showFallback('link_failed'); } });
    setTimeout(function () { showFallback('timeout'); }, 8000);
  }

  function initBooker(root) {
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var grid = root.querySelector('.cal-grid');
    var monthLabel = root.querySelector('.cal-month');
    var prevBtn = root.querySelector('[data-cal="prev"]');
    var nextBtn = root.querySelector('[data-cal="next"]');
    var slotsDay = root.querySelector('.slots-day');
    var slotList = root.querySelector('.slot-list');
    var form = document.getElementById('booking-form');
    var pick = document.getElementById('booking-pick');
    var status = document.getElementById('booking-status');

    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function fromIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function longDate(d) { return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }

    // Filled in from /api/bookings: { weekdays, times, blockedDates, first, last, timezoneLabel }
    var rules = null;
    // Times already requested by someone else, as 'YYYY-MM-DD|1:30 PM'
    var taken = {};
    function isTaken(d, t) { return taken[iso(d) + '|' + t] === true; }
    function isOpen(d) {
      var day = iso(d);
      return !!rules && day >= rules.first && day <= rules.last && rules.weekdays.indexOf(d.getDay()) !== -1 &&
        rules.blockedDates.indexOf(day) === -1 && rules.times.some(function (t) { return !isTaken(d, t); });
    }
    function load() {
      return fetch('/api/bookings', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('Bookings ' + r.status); return r.json(); })
        .then(function (data) {
          rules = data.rules;
          taken = {};
          (data.taken || []).forEach(function (b) { taken[b.date + '|' + b.time] = true; });
        });
    }
    function firstOpen() {
      if (!rules) return null;
      var d = fromIso(rules.first), last = fromIso(rules.last);
      while (d <= last && !isOpen(d)) d.setDate(d.getDate() + 1);
      return d <= last ? d : null;
    }

    var selected = null, slot = null, view = null;

    function renderMonth() {
      monthLabel.textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
      var first = fromIso(rules.first), last = fromIso(rules.last);
      prevBtn.disabled = view <= new Date(first.getFullYear(), first.getMonth(), 1);
      nextBtn.disabled = view >= new Date(last.getFullYear(), last.getMonth(), 1);
      grid.innerHTML = '';
      ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach(function (n) {
        var h = document.createElement('span'); h.className = 'cal-dow'; h.setAttribute('aria-hidden', 'true'); h.textContent = n; grid.appendChild(h);
      });
      for (var i = 0; i < view.getDay(); i++) grid.appendChild(document.createElement('span'));
      var d = new Date(view);
      while (d.getMonth() === view.getMonth()) {
        var day = new Date(d), el;
        if (isOpen(day)) {
          el = document.createElement('button');
          el.type = 'button';
          el.setAttribute('aria-label', longDate(day) + ', available');
          el.setAttribute('aria-pressed', selected && iso(selected) === iso(day) ? 'true' : 'false');
          el.addEventListener('click', (function (dd) { return function () { selected = dd; slot = null; renderMonth(); renderSlots(); }; })(day));
        } else {
          el = document.createElement('span');
          el.setAttribute('aria-hidden', 'true');
        }
        el.className = 'cal-day';
        el.textContent = day.getDate();
        grid.appendChild(el);
        d.setDate(d.getDate() + 1);
      }
    }

    function renderSlots() {
      slotList.innerHTML = '';
      if (!selected) { slotsDay.textContent = 'No open days right now. Send a note below.'; form.hidden = true; return; }
      slotsDay.textContent = longDate(selected);
      rules.times.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot';
        if (isTaken(selected, t)) {
          b.disabled = true;
          b.textContent = t + ' · Taken';
        } else {
          b.textContent = t;
          b.setAttribute('aria-pressed', slot === t ? 'true' : 'false');
          b.addEventListener('click', function () { slot = t; status.hidden = true; renderSlots(); track('booking_time_selected', { method: 'built-in' }); });
        }
        slotList.appendChild(b);
      });
      form.hidden = !slot;
      if (slot) {
        form.elements['session-date'].value = longDate(selected) + ', ' + selected.getFullYear();
        form.elements['session-time'].value = slot + ' ' + rules.timezoneLabel;
        pick.textContent = longDate(selected) + ' at ' + slot + ' (' + rules.timezoneLabel + ')';
      }
    }

    function render() {
      if (selected && !isOpen(selected)) { selected = null; slot = null; }
      if (!selected) selected = firstOpen();
      view = new Date((selected || fromIso(rules.first)).getFullYear(), (selected || fromIso(rules.first)).getMonth(), 1);
      renderMonth(); renderSlots();
    }

    prevBtn.addEventListener('click', function () { view.setMonth(view.getMonth() - 1); renderMonth(); });
    nextBtn.addEventListener('click', function () { view.setMonth(view.getMonth() + 1); renderMonth(); });

    // Holds the slot in the database; the server then emails Liz through the "booking" form.
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      status.hidden = true;
      var f = form.elements;
      fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: iso(selected), time: slot,
          name: f['name'].value, email: f['email'].value, market: f['market'].value,
          'company-website': f['company-website'].value
        })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.ok) {
            // Server couldn't send the email: send it from here so the request isn't missed
            var mail = data.notified === false ? submitToNetlify(form).catch(function () {}) : Promise.resolve();
            return mail.then(function () { booked(true); });
          }
          // Booking service down: still email the request so it isn't lost
          if (r.status >= 500) return submitToNetlify(form).then(function () { booked(false); }, failed);
          btn.disabled = false;
          status.hidden = false;
          status.textContent = data.error || (r.status === 429 ? 'Too many tries. Please wait a minute and try again.' : "Your request didn't send. Please try again, or email " + CONTACT_EMAIL + '.');
          if (r.status === 409) {
            // Someone else got there first: refresh what's free and let them pick again
            return load().then(function () { slot = null; render(); }).catch(function () {});
          }
        });
      }).catch(function () {
        return submitToNetlify(form).then(function () { booked(false); }, failed);
      });

      function booked(held) {
        if (held) taken[iso(selected) + '|' + slot] = true;
        track('generate_lead', { form: 'booking', method: 'built-in' });
        root.querySelector('.booker-picker').hidden = true;
        form.hidden = true;
        status.hidden = false;
        status.textContent = (held ? 'Your time is held: ' : 'Request sent for ') + pick.textContent +
          '. Liz will email you within one business day to confirm, with your meeting link and payment details.';
      }
      function failed() {
        btn.disabled = false;
        status.hidden = false;
        status.textContent = "Your request didn't send. Please check your connection and try again, or email " + CONTACT_EMAIL + '.';
      }
    });

    slotsDay.textContent = 'Loading open times…';
    load().then(render, function () {
      root.querySelector('.booker-picker').hidden = true;
      status.hidden = false;
      status.innerHTML = 'The calendar didn’t load. <a href="#contact">Send a note</a> with a few days and times that work, and Liz will reply within two business days.';
    });
  }
})();
