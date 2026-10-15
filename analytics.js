// Annotarium first-party analytics client.
// Cookieless, tab-scoped session, cross-origin stitch via URL fragment.
// Posts to analytics.annotarium.org/event. No cookies, no localStorage, no PII stored.
(function () {
  'use strict';

  var ENDPOINT = 'https://analytics.annotarium.org/event';
  var ENGAGEMENT_FLUSH_MS = 5 * 60 * 1000;
  var MAX_ENGAGEMENT_SEC = 3600; // the collector rejects more
  var APP_USED_DELAY_MS = 30000;
  var STORAGE_KEY = '_aa_sid';

  // Cross-origin session stitch: if landing page sent us here with #_sid=..., adopt it.
  var hashMatch = location.hash.match(/_sid=([A-Za-z0-9_-]+)/);
  if (hashMatch) {
    try { sessionStorage.setItem(STORAGE_KEY, hashMatch[1]); } catch (e) {}
    // Strip the _sid param from the URL so it doesn't leak (referrers, logs, sharing).
    var cleaned = location.hash
      .replace(/[#&]_sid=[A-Za-z0-9_-]+/, '')
      .replace(/^&/, '#');
    if (cleaned === '#' || cleaned === '') cleaned = '';
    try { history.replaceState(null, '', location.pathname + location.search + cleaned); } catch (e) {}
  }

  var sid;
  try { sid = sessionStorage.getItem(STORAGE_KEY); } catch (e) {}
  if (!sid) {
    if (window.crypto && crypto.randomUUID) sid = crypto.randomUUID();
    else sid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem(STORAGE_KEY, sid); } catch (e) {}
  }

  var page = location.pathname || '/';
  var referrer = '';
  try {
    if (document.referrer) {
      var rh = new URL(document.referrer).hostname;
      // Don't record self-referrals (internal navigation)
      if (rh && rh !== location.hostname) referrer = rh;
    }
  } catch (e) {}

  function send(event, data) {
    try {
      var body = JSON.stringify({ session: sid, page: page, event: event, data: data || null, referrer: referrer });
      if (navigator.sendBeacon) {
        // text/plain avoids a CORS preflight; sendBeacon can't preflight and
        // mobile Safari silently drops the request if the MIME is application/json.
        // Server does request.text() + JSON.parse() so Content-Type is irrelevant.
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
      } else {
        fetch(ENDPOINT, {
          method: 'POST',
          body: body,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
        }).catch(function () {});
      }
    } catch (e) {}
  }

  // ----- Core events (fire on every page) -----
  send('pageview');

  // Time on page: visible seconds, sent when the tab is hidden or closed and
  // every 5 minutes while it stays visible (one row, not one every 15 s).
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
  var visibleMs = 0;
  function sendEngagement() {
    if (visibleSince) {
      visibleMs += Date.now() - visibleSince;
      visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
    }
    var sec = Math.round(visibleMs / 1000);
    if (sec > 0) {
      send('engagement', { sec: Math.min(sec, MAX_ENGAGEMENT_SEC) });
      visibleMs = 0;
    }
  }
  setInterval(function () {
    if (document.visibilityState === 'visible') sendEngagement();
  }, ENGAGEMENT_FLUSH_MS);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') visibleSince = Date.now();
    else sendEngagement();
  });

  window.addEventListener('pagehide', function () {
    sendEngagement();
    send('pagehide');
  });

  // ----- Landing-site click events (harmless on app side — selectors won't match) -----
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    var lang = target.closest('.lang-option');
    if (lang) {
      send('lang_change', { lang: lang.getAttribute('data-lang') || '' });
      return;
    }

    var launch = target.closest('a[href*="app.annotarium.org"]');
    if (launch) {
      // Cross-origin session stitch: append current session id to the destination URL.
      try {
        var u = new URL(launch.href);
        if (!/_sid=/.test(u.hash)) {
          u.hash = (u.hash ? u.hash + '&' : '#') + '_sid=' + encodeURIComponent(sid);
          launch.href = u.toString();
        }
      } catch (err) {}
      var section = launch.closest('nav,section,footer,header');
      send('launch_app', { source: section ? section.tagName.toLowerCase() : 'unknown' });
      return;
    }

    if (target.closest('a[href*="/faq"]')) { send('faq_click'); return; }
    if (target.closest('a[href*="docs.google.com/forms"]')) { send('feedback_click'); return; }
  });

  // ----- Scroll depth 25/50/75/100 (once each per pageload) -----
  var milestones = [25, 50, 75, 100];
  var seen = {};
  function onScroll() {
    var docH = document.documentElement.scrollHeight;
    var viewH = window.innerHeight;
    if (docH <= viewH) return;
    var scrolled = (window.scrollY || window.pageYOffset) + viewH;
    var pct = Math.min(100, Math.round((scrolled / docH) * 100));
    for (var i = 0; i < milestones.length; i++) {
      var m = milestones[i];
      if (pct >= m && !seen[m]) { seen[m] = 1; send('scroll', { pct: m }); }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ----- YouTube play detection (requires enablejsapi=1 on iframes) -----
  window.addEventListener('message', function (e) {
    if (!e.origin) return;
    if (e.origin.indexOf('youtube-nocookie.com') === -1 && e.origin.indexOf('youtube.com') === -1) return;
    if (typeof e.data !== 'string') return;
    try {
      var msg = JSON.parse(e.data);
      // info === 1 means "playing" in YouTube Iframe API state
      if (msg.event === 'onStateChange' && msg.info === 1) {
        send('video_play', { iframe: msg.id || 'unknown' });
      }
    } catch (err) {}
  });

  // ----- App-only: mark session as "really used" after 30s visible -----
  if (location.hostname === 'app.annotarium.org' || location.hostname === 'annotarium.pages.dev') {
    setTimeout(function () {
      if (document.visibilityState === 'visible') send('app_used');
    }, APP_USED_DELAY_MS);
  }
})();
