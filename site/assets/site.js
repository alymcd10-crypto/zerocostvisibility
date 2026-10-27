(function () {
  // ---- Settings: change these before launch ----------------------------
  var ACCESS_CODE = 'STARPOWER';           // code shown on Liz's closing slide
  var CAL_LINK = '';                        // e.g. 'liz-federman/visibility-session' once Cal.com is set up

  // Built-in booking calendar, used while CAL_LINK is empty.
  // Visitors pick a free day and time; it's held in the database (no double booking)
  // and Liz gets an email through the "booking" Netlify form, then confirms by email.
  var BOOKING = {
    weekdays: [2, 3, 4],                    // 0 = Sunday … 6 = Saturday (Tue, Wed, Thu)
    times: ['9:00 AM', '11:00 AM', '1:30 PM', '4:00 PM'],
    minNoticeDays: 2,                       // earliest bookable day, counted from today
    weeksAhead: 10,                         // how far out the calendar goes
    blockedDates: [],                       // days off, as 'YYYY-MM-DD'
    timezone: 'Central Time'
  };
  // ------------------------------------------------------------------------

  var isLive = /(^|\.)zerocostvisibility\.com$|netlify\.app$/.test(location.hostname);
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // Copy buttons: <button class="copy-btn" data-copy="element-id">
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var label = btn.textContent;
    var reset = function () { btn.textContent = label; btn.classList.remove('done'); };
    btn.addEventListener('click', function () {
      var src = document.getElementById(btn.getAttribute('data-copy'));
      if (!src) return;
      var text = src.innerText.trim();
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

  // Toolkit gate
  var gate = document.getElementById('gate-form');
  var content = document.getElementById('toolkit-content');
  var gateSection = document.getElementById('gate');

  // Section in the URL hash (e.g. /reviews QR code lands on #step3), if it lives inside the toolkit
  function hashTarget() {
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    return el && content && content.contains(el) ? el : null;
  }

  function unlock() {
    if (content) content.hidden = false;
    if (gateSection) gateSection.hidden = true;
  }

  if (gate && content) {
    var remembered = false;
    try { remembered = localStorage.getItem('starpower-access') === '1'; } catch (e) {}
    if (remembered) {
      unlock();
      // The browser tried to jump to the hash while the section was still hidden
      var early = hashTarget();
      if (early) requestAnimationFrame(function () { early.scrollIntoView({ block: 'start' }); });
    } else if (hashTarget()) {
      var hint = document.getElementById('gate-hint');
      if (hint) hint.hidden = false;
      scrollToEl(gateSection);
    }
    gate.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = document.getElementById('gate-error');
      var code = (document.getElementById('gate-code').value || '').trim().toUpperCase();
      if (code !== ACCESS_CODE) {
        err.textContent = "That code doesn't match. It's on Liz's closing slide.";
        err.hidden = false;
        document.getElementById('gate-code').focus();
        return;
      }
      err.hidden = true;
      var btn = gate.querySelector('button[type="submit"]');
      btn.disabled = true;
      submitToNetlify(gate).catch(function () {}).then(function () {
        try { localStorage.setItem('starpower-access', '1'); } catch (e2) {}
        unlock();
        scrollToEl(hashTarget() || content);
      });
    });
  }

  // Toolkit jump bar: highlight the section on screen, print button
  var tkNav = document.querySelector('.tk-nav');
  if (tkNav) {
    var printBtn = tkNav.querySelector('[data-print]');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
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
      }, { rootMargin: '-80px 0px -60% 0px' });
      Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  // Contact form
  var contact = document.getElementById('contact-form');
  if (contact) {
    contact.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('contact-status');
      var btn = contact.querySelector('button[type="submit"]');
      btn.disabled = true;
      submitToNetlify(contact).then(function (state) {
        contact.hidden = true;
        msg.hidden = false;
        msg.textContent = state === 'preview'
          ? 'Preview only: messages start arriving once the site is live on Netlify.'
          : "Thanks, your note is on its way to Liz. She replies within two business days.";
      }).catch(function () {
        btn.disabled = false;
        msg.hidden = false;
        msg.textContent = "Your message didn't send. Please try again, or email liz@listingsbyleslie.com.";
      });
    });
  }

  // Booking: Cal.com inline embed once CAL_LINK is set, otherwise the built-in calendar
  var calBox = document.getElementById('cal-inline');
  var booker = document.getElementById('booker');
  if (calBox && CAL_LINK && isLive) {
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
    window.Cal('init', { origin: 'https://cal.com' });
    window.Cal('inline', { elementOrSelector: '#cal-inline', calLink: CAL_LINK, layout: 'month_view' });
    if (booker) booker.hidden = true;
  } else if (booker) {
    initBooker(booker);
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
    function longDate(d) { return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var first = new Date(today); first.setDate(first.getDate() + BOOKING.minNoticeDays);
    var last = new Date(today); last.setDate(last.getDate() + BOOKING.weeksAhead * 7);
    // Times already requested by someone else, as 'YYYY-MM-DD|1:30 PM' (from /api/bookings)
    var taken = {};
    function isTaken(d, t) { return taken[iso(d) + '|' + t] === true; }
    function isOpen(d) {
      return d >= first && d <= last && BOOKING.weekdays.indexOf(d.getDay()) !== -1 && BOOKING.blockedDates.indexOf(iso(d)) === -1 &&
        BOOKING.times.some(function (t) { return !isTaken(d, t); });
    }
    function loadTaken() {
      return fetch('/api/bookings?from=' + iso(first) + '&to=' + iso(last), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : { taken: [] }; })
        .then(function (data) {
          taken = {};
          (data.taken || []).forEach(function (b) { taken[b.date + '|' + b.time] = true; });
        })
        .catch(function () {});
    }
    function firstOpen() {
      var d = new Date(first);
      while (d <= last && !isOpen(d)) d.setDate(d.getDate() + 1);
      return d <= last ? d : null;
    }

    var selected = firstOpen(), slot = null;
    var view = new Date((selected || first).getFullYear(), (selected || first).getMonth(), 1);

    function renderMonth() {
      monthLabel.textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
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
      BOOKING.times.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot';
        if (isTaken(selected, t)) {
          b.disabled = true;
          b.textContent = t + ' · Taken';
        } else {
          b.textContent = t;
          b.setAttribute('aria-pressed', slot === t ? 'true' : 'false');
          b.addEventListener('click', function () { slot = t; status.hidden = true; renderSlots(); });
        }
        slotList.appendChild(b);
      });
      form.hidden = !slot;
      if (slot) {
        form.elements['session-date'].value = longDate(selected) + ', ' + selected.getFullYear();
        form.elements['session-time'].value = slot + ' ' + BOOKING.timezone;
        pick.textContent = longDate(selected) + ' at ' + slot + ' (' + BOOKING.timezone + ')';
      }
    }

    prevBtn.addEventListener('click', function () { view.setMonth(view.getMonth() - 1); renderMonth(); });
    nextBtn.addEventListener('click', function () { view.setMonth(view.getMonth() + 1); renderMonth(); });

    // Holds the slot in the database first (so nobody else can take it),
    // then sends the Netlify form so Liz gets the email notification.
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
          if (r.ok) return submitToNetlify(form).catch(function () {}).then(function () { booked(true); });
          // Booking service down: still email the request so it isn't lost
          if (r.status >= 500) return submitToNetlify(form).then(function () { booked(false); }, failed);
          btn.disabled = false;
          status.hidden = false;
          status.textContent = data.error || "Your request didn't send. Please try again, or email liz@listingsbyleslie.com.";
          if (r.status === 409) {
            // Someone else got there first: refresh what's free and let them pick again
            return loadTaken().then(function () {
              slot = null;
              if (!isOpen(selected)) selected = firstOpen();
              renderMonth(); renderSlots();
            });
          }
        });
      }).catch(function () {
        return submitToNetlify(form).then(function () { booked(false); }, failed);
      });

      function booked(held) {
        if (held) taken[iso(selected) + '|' + slot] = true;
        root.querySelector('.booker-picker').hidden = true;
        form.hidden = true;
        status.hidden = false;
        status.textContent = (held ? 'Your time is held: ' : 'Request sent for ') + pick.textContent +
          '. Liz will email you within one business day to confirm, with your Zoom link and payment details.';
      }
      function failed() {
        btn.disabled = false;
        status.hidden = false;
        status.textContent = "Your request didn't send. Please check your connection and try again, or email liz@listingsbyleslie.com.";
      }
    });

    renderMonth();
    renderSlots();
    loadTaken().then(function () {
      if (selected && !isOpen(selected)) selected = firstOpen();
      if (selected) view = new Date(selected.getFullYear(), selected.getMonth(), 1);
      renderMonth(); renderSlots();
    });
  }
})();
