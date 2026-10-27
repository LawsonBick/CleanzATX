/* ==========================================================================
   CleanzATX — sitewide GA4 click tracking
   Loaded on every public page, right after the gtag snippet.
   Quote-funnel events (quote_step*, begin_checkout, generate_lead,
   upsell_accepted) stay in main.js / the page's own script.
   ========================================================================== */
(function () {
  'use strict';

  // Our own hosts — links to these are internal, not outbound
  const OWN_HOSTS = ['cleanzatx.com', 'www.cleanzatx.com', location.hostname];

  // Quote / booking CTAs (links to the quote section, plus primary buttons)
  const CTA_SELECTOR = 'a[href*="#quote"], .btn--primary, .btn--nav, .hero-cta';

  // Which kind of page the click happened on, so reports can split by page
  // (page_location is also attached to every event by GA4 itself)
  const path = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  const hood = path.match(/^\/window-cleaning-([a-z0-9-]+)/);
  const PAGE_TYPE = path === '/' || path === '/index' ? 'home'
    : hood ? 'neighborhood'
    : /^\/(privacy-policy|terms-of-service)$/.test(path) ? 'legal'
    : path.slice(1);

  function send(name, params) {
    if (typeof gtag !== 'function') return;
    gtag('event', name, Object.assign({
      page_location: location.href,
      page_type: PAGE_TYPE,
      neighborhood: hood ? hood[1] : undefined
    }, params));
  }

  function linkText(el) {
    return (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  document.addEventListener('click', function (e) {
    const el = e.target.closest && e.target.closest('a, button');
    if (!el) return;

    const href = (el.getAttribute('href') || '').trim();
    const scheme = href.split(':')[0].toLowerCase();

    // Phone / text / email
    if (scheme === 'tel' || scheme === 'sms') {
      // On the home page a tel: link first opens the call/text chooser
      // (main.js prevents the dial) — only count the actual call or text tap.
      if (e.defaultPrevented) return;
      send('phone_call_click', {
        method: scheme === 'tel' ? 'call' : 'text',
        link_url: href,
        link_text: linkText(el)
      });
      return;
    }
    if (scheme === 'mailto') {
      send('email_click', { link_url: href, link_text: linkText(el) });
      return;
    }

    // Outbound links (reviews, social, etc.)
    if (el.tagName === 'A' && /^https?:/i.test(el.href) && OWN_HOSTS.indexOf(el.hostname) === -1) {
      send('outbound_click', {
        link_url: el.href,
        link_domain: el.hostname,
        link_text: linkText(el)
      });
      return;
    }

    // Quote / CTA buttons — wizard steps are tracked separately by quote_step
    if (el.matches(CTA_SELECTOR) && !el.closest('.qwiz')) {
      send('cta_click', {
        button_text: linkText(el),
        link_url: href || undefined
      });
    }
  });
})();
