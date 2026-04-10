/* ============================================================
   CleanzATX — main.js
   ============================================================ */

/* ---------- Nav scroll effect ---------- */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* --- Centre scroll arrow against viewport, not hero overflow --- */
(function () {
  const arrow = document.querySelector('.hero__scroll-arrow');
  if (!arrow) return;
  function positionArrow() {
    const vw = document.documentElement.clientWidth;
    const w  = arrow.offsetWidth;
    arrow.style.left = Math.round((vw - w) / 2) + 'px';
    arrow.style.transform = 'none';
  }
  positionArrow();
  window.addEventListener('resize', positionArrow);
})();

/* ---------- Mobile menu ---------- */
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');

burger.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('open');
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
});

// Close on link click
mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    burger.classList.remove('open');
  });
});

/* ---------- Hero entrance animation ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero__content');
  if (hero) hero.closest('.hero').classList.add('hero-anim');
});

/* ---------- Scroll reveal (AOS-lite) ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // stagger siblings
        const siblings = [...entry.target.parentElement.querySelectorAll('[data-aos]')];
        const idx = siblings.indexOf(entry.target);
        entry.target.style.transitionDelay = `${idx * 80}ms`;
        entry.target.classList.add('aos-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('[data-aos]').forEach(el => revealObserver.observe(el));

/* ---------- Proof bar animation ---------- */
const barObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target.querySelector('.proof-bar__fill');
        if (fill) fill.style.width = fill.dataset.width || '100%';
        barObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll('.proof-card--main').forEach(el => barObserver.observe(el));

/* ---------- Counter animation ---------- */
function animateCounter(el, target, duration = 1600) {
  let start = 0;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const suffix = el.dataset.suffix || '';
    el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString() + suffix;
  };
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        if (!isNaN(target)) animateCounter(el, target);
        counterObserver.unobserve(el);
      }
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

/* ---------- Reviews carousel (mobile) ---------- */
const track = document.getElementById('reviewsTrack');
const dotsContainer = document.getElementById('reviewDots');
const prevBtn = document.getElementById('reviewPrev');
const nextBtn = document.getElementById('reviewNext');

let currentPage = 0;
let perPage = 3;

function getPerPage() {
  if (window.innerWidth <= 640) return 1;
  if (window.innerWidth <= 900) return 2;
  return 3;
}

function buildDots(total) {
  dotsContainer.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = 'rnav-dot' + (i === currentPage ? ' active' : '');
    dot.setAttribute('aria-label', `Page ${i + 1}`);
    dot.addEventListener('click', () => goToPage(i));
    dotsContainer.appendChild(dot);
  }
}

function goToPage(page) {
  const cards = track.querySelectorAll('.review-card');
  perPage = getPerPage();
  const totalPages = Math.ceil(cards.length / perPage);
  currentPage = Math.max(0, Math.min(page, totalPages - 1));

  cards.forEach((card, i) => {
    const show = i >= currentPage * perPage && i < (currentPage + 1) * perPage;
    card.style.display = show ? 'flex' : 'none';
  });

  // Update dots
  dotsContainer.querySelectorAll('.rnav-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentPage);
  });

  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage >= totalPages - 1;
}

function initCarousel() {
  const cards = track.querySelectorAll('.review-card');
  perPage = getPerPage();
  const totalPages = Math.ceil(cards.length / perPage);

  // Show all on desktop (no carousel)
  if (perPage >= cards.length) {
    cards.forEach(c => c.style.display = 'flex');
    dotsContainer.innerHTML = '';
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    return;
  }

  prevBtn.style.display = '';
  nextBtn.style.display = '';
  buildDots(totalPages);
  goToPage(0);
}

if (track) {
  prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(currentPage + 1));

  initCarousel();
  window.addEventListener('resize', () => {
    currentPage = 0;
    initCarousel();
  });
}

/* ---------- Smooth anchor scrolling with offset ---------- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ============================================================
   QUOTE WIZARD — Multi-step form with pricing engine
   ============================================================ */
const qwiz = document.getElementById('quoteWizard');
if (qwiz) {
  const state = window.__qwizState = {
    step: 1,
    address: '', sqft: 0, stories: 0,
    propertyType: 'Residential',
    windowCount: 0, screenCount: 0, trackCount: 0,
    screenType: 'normal',
    svcExterior: true, svcInterior: false, svcScreens: false, svcTracks: false,
    plan: null, autoBilling: false,
    firstName: '', phone: '', email: '',
    referral: '', referrer: '', timeline: '', deadlineDate: '',
    promoCode: '', promoDiscount: 0,
  };

  const stepLabels = {
    1: 'Property Info',
    2: 'Service Selection',
    3: 'Service Plan',
    4: 'Contact Info',
    5: 'Your Quote'
  };

  // Window/screen/track options based on sqft
  function getOptions(sqft) {
    if (sqft <= 1500)      return { windows: [10,15,20,25], screens: [5,10,15,20], tracks: [5,10,15,20] };
    if (sqft <= 2500)      return { windows: [15,20,25,30], screens: [15,20,25,30], tracks: [15,20,25,30] };
    if (sqft <= 3500)      return { windows: [25,30,35,40], screens: [20,25,30,35], tracks: [20,25,30,35] };
    return                        { windows: [35,40,45,50], screens: [25,30,35,40], tracks: [25,30,35,40] };
  }

  // Build chip selectors
  function buildChips(container, options, stateKey) {
    container.innerHTML = '';
    options.forEach(val => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'qwiz__chip' + (state[stateKey] === val ? ' active' : '');
      chip.textContent = val;
      chip.addEventListener('click', () => {
        state[stateKey] = val;
        container.querySelectorAll('.qwiz__chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
      container.appendChild(chip);
    });
  }

  // Navigate steps
  function goToStep(step) {
    state.step = step;
    qwiz.querySelectorAll('.qwiz__panel').forEach(p => p.classList.remove('active'));
    const panel = qwiz.querySelector(`[data-panel="${step}"]`);
    if (panel) panel.classList.add('active');
    // Fire event for plan auto-select
    document.dispatchEvent(new CustomEvent('qwiz:step', { detail: { step } }));

    // Progress bar
    const fill = document.getElementById('qwizBarFill');
    fill.style.width = (step / 5 * 100) + '%';

    // Step indicators
    qwiz.querySelectorAll('.qwiz__step').forEach(s => {
      const n = parseInt(s.dataset.step);
      s.classList.remove('active', 'done');
      if (n === step) s.classList.add('active');
      else if (n < step) s.classList.add('done');
    });

    // Label
    const label = document.getElementById('qwizStepLabel');
    label.textContent = `Step ${step} of 5: ${stepLabels[step] || ''}`;

    // Pre-populate chips when entering step 2
    if (step === 2) {
      const opts = getOptions(state.sqft);
      buildChips(document.getElementById('q-window-chips'), [...opts.windows, 'Other'], 'windowCount');
      buildChips(document.getElementById('q-screen-chips'), opts.screens, 'screenCount');
      buildChips(document.getElementById('q-track-chips'), opts.tracks, 'trackCount');

      // Wire "Other" chip to show custom input
      const windowChips = document.getElementById('q-window-chips');
      const customWrap = document.getElementById('q-window-custom-wrap');
      const customInput = document.getElementById('q-window-custom');
      windowChips.querySelectorAll('.qwiz__chip').forEach(chip => {
        chip.addEventListener('click', () => {
          if (chip.textContent === 'Other') {
            customWrap.style.display = '';
            state.windowCount = parseInt(customInput.value) || 0;
          } else {
            customWrap.style.display = 'none';
          }
        });
      });
      customInput.addEventListener('input', () => {
        state.windowCount = parseInt(customInput.value) || 0;
      });
    }

    // Auto-apply promo from localStorage when entering step 4
    if (step === 4) {
      try {
        const stored = localStorage.getItem('cleanzatx_promo');
        if (stored) {
          const promo = JSON.parse(stored);
          if (promo && promo.code === 'SAVE25' && state.promoDiscount === 0) {
            const promoInput = document.getElementById('q-promo');
            if (promoInput) {
              promoInput.value = promo.code;
              applyPromo(promo.code);
            }
          }
        }
      } catch (e) {}
    }

    // Build price display when entering step 5
    if (step === 5) buildPriceDisplay();

    // GA4 step tracking
    trackStep(step);

    // Scroll to form (skip on initial load)
    if (!qwiz._initialized) {
      qwiz._initialized = true;
    } else {
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
      const top = qwiz.closest('.quote-section').getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  // Promo code logic
  function applyPromo(code) {
    const msgEl = document.getElementById('q-promo-msg');
    if (!msgEl) return;
    if (code === 'SAVE25') {
      state.promoCode = 'SAVE25';
      state.promoDiscount = 25;
      msgEl.style.display = '';
      msgEl.style.color = '#22c55e';
      msgEl.textContent = '✅ $25 off applied! Code: SAVE25';
      localStorage.removeItem('cleanzatx_promo');
    } else {
      msgEl.style.display = '';
      msgEl.style.color = '#ef4444';
      msgEl.textContent = '❌ Invalid promo code.';
    }
  }

  // Validation
  function validateStep(step) {
    if (step === 1) {
      const addr = document.getElementById('q-address').value.trim();
      const sqft = parseInt(document.getElementById('q-sqft').value);
      const stories = document.getElementById('q-stories').value;
      const lastCleaned = document.getElementById('q-last-cleaned').value;
      state.address = addr;
      state.sqft = sqft || 0;
      state.stories = parseInt(stories) || 0;
      state.lastCleaned = lastCleaned;
      if (!addr) { flashError('q-address'); return false; }
      if (!sqft || sqft < 100) { flashError('q-sqft'); return false; }
      if (!stories) { flashError('q-stories'); return false; }
      if (!lastCleaned) { flashError('q-last-cleaned'); return false; }
      return true;
    }
    if (step === 2) {
      if (!state.windowCount) {
        const chips = document.getElementById('q-window-chips');
        chips.style.outline = '2px solid #ef4444';
        chips.style.borderRadius = '8px';
        setTimeout(() => { chips.style.outline = ''; }, 2000);
        return false;
      }
      if (state.svcScreens && !state.screenCount) return false;
      if (state.svcTracks && !state.trackCount) return false;
      return true;
    }
    if (step === 4) {
      const fname = document.getElementById('q-fname').value.trim();
      const phone = document.getElementById('q-phone').value.trim();
      const timeline = document.getElementById('q-timeline').value;
      state.firstName = fname;
      state.lastName = document.getElementById('q-lname')?.value.trim() || '';
      state.phone = phone;
      state.email = document.getElementById('q-email').value.trim();
      state.referral = document.getElementById('q-referral').value;
      state.referrer = document.getElementById('q-referrer')?.value?.trim() || '';
      state.timeline = timeline;
      state.deadlineDate = document.getElementById('q-date')?.value || '';
      if (!fname) { flashError('q-fname'); return false; }
      if (!phone || phone.replace(/\D/g,'').length < 10) { flashError('q-phone'); return false; }
      if (!timeline) { flashError('q-timeline'); return false; }
      return true;
    }
    return true;
  }

  function flashError(id) {
    const field = document.getElementById(id)?.closest('.qwiz__field');
    if (!field) return;
    field.classList.add('qwiz__field--error');
    document.getElementById(id).focus();
    setTimeout(() => field.classList.remove('qwiz__field--error'), 2500);
  }

  // Pricing engine
  function calcPrice() {
    const sqft = state.sqft;
    let exterior = sqft * 0.10;
    let interior = state.svcInterior ? sqft * 0.05 : 0;
    const screenPrice = state.screenType === 'solar' ? 10 : 5;
    let screens = state.svcScreens ? state.screenCount * screenPrice : 0;
    let tracks = state.svcTracks ? state.trackCount * 5 : 0;
    let discount = 0;
    if (state.plan === '6month') discount = 50;
    else if (state.plan === 'quarterly') discount = 100;
    else if (state.plan === 'monthly') discount = 150;
    const subtotal = exterior + interior + screens + tracks;
    const total = Math.max(0, subtotal - discount - state.promoDiscount);
    const low = Math.max(0, total - 50);
    const high = total + 50;
    return { exterior, interior, screens, tracks, discount, subtotal, total, low, high, planName: state.plan };
  }

  // Job duration estimate
  function getEstimatedDuration() {
    const sqft = state.sqft;
    let extMin = 60;
    if (sqft > 1500) extMin = 120;
    if (sqft > 2500) extMin = 180;
    if (sqft > 3500) extMin = 240;
    let intMin = 0;
    if (state.svcInterior) {
      intMin = 30;
      if (sqft > 1500) intMin = 60;
      if (sqft > 2500) intMin = 90;
      if (sqft > 3500) intMin = 105;
    }
    const screenMin = state.svcScreens ? state.screenCount * 1 : 0;
    const trackMin = state.svcTracks ? state.trackCount * 1 : 0;
    return extMin + intMin + screenMin + trackMin;
  }

  function buildPriceDisplay() {
    const isLarge = state.sqft >= 5000;
    document.getElementById('q-price-normal').style.display = isLarge ? 'none' : 'block';
    document.getElementById('q-price-large').style.display = isLarge ? 'block' : 'none';
    if (isLarge) return;

    const p = calcPrice();
    const lines = document.getElementById('q-price-lines');
    lines.innerHTML = '';
    const addLine = (label, amount, cls) => {
      const div = document.createElement('div');
      div.className = 'qwiz__price-line' + (cls ? ' ' + cls : '');
      div.innerHTML = `<span>${label}</span><span>${typeof amount === 'string' ? amount : '$' + amount.toFixed(2)}</span>`;
      lines.appendChild(div);
    };
    addLine('Exterior Windows', p.exterior);
    if (state.svcInterior) addLine('Interior Windows', p.interior);
    if (state.svcScreens) addLine(`Screen Cleaning (${state.screenCount} ${state.screenType === 'solar' ? 'solar' : 'standard'})`, p.screens);
    if (state.svcTracks) addLine(`Track Cleaning (${state.trackCount})`, p.tracks);
    if (p.discount > 0) {
      const planLabel = state.plan === '6month' ? '6-Month' : state.plan === 'quarterly' ? 'Quarterly' : 'Monthly';
      addLine(`${planLabel} Plan Discount`, '-$' + p.discount.toFixed(2), 'qwiz__price-line--discount');
    }
    if (state.promoDiscount > 0) {
      addLine(`🎟 Promo (${state.promoCode})`, '-$' + state.promoDiscount.toFixed(2), 'qwiz__price-line--discount');
    }
    document.getElementById('q-price-total').textContent = '$' + Math.round(p.low) + ' – $' + Math.round(p.high);
  }

  // Wire up Next/Back buttons
  qwiz.querySelectorAll('.qwiz__next').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = parseInt(btn.dataset.next);
      if (validateStep(state.step)) goToStep(next);
    });
  });
  qwiz.querySelectorAll('.qwiz__back').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.back)));
  });

  // Property type
  document.querySelectorAll('input[name="propertyType"]').forEach(r => {
    r.addEventListener('change', e => { state.propertyType = e.target.value; });
  });

  // Service checkboxes
  document.getElementById('q-svc-interior')?.addEventListener('change', e => { state.svcInterior = e.target.checked; });
  document.getElementById('q-svc-screens')?.addEventListener('change', e => {
    state.svcScreens = e.target.checked;
    document.getElementById('q-screen-options').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('q-svc-tracks')?.addEventListener('change', e => {
    state.svcTracks = e.target.checked;
    document.getElementById('q-track-options').style.display = e.target.checked ? 'block' : 'none';
  });

  // Screen type radios
  document.querySelectorAll('input[name="screenType"]').forEach(r => {
    r.addEventListener('change', e => { state.screenType = e.target.value; });
  });

  // Plan selection
  qwiz.querySelectorAll('.qwiz__plan').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.qwiz__toggle')) return;
      const wasSelected = card.classList.contains('selected');
      qwiz.querySelectorAll('.qwiz__plan').forEach(c => c.classList.remove('selected'));
      if (!wasSelected) {
        card.classList.add('selected');
        state.plan = card.dataset.plan;
      } else {
        state.plan = null;
      }
      const skipBtn = document.getElementById('skipPlanBtn');
      const selectBtn = document.getElementById('selectPlanBtn');
      const skipLink = document.getElementById('skipPlanLink');
      if (skipBtn) skipBtn.style.display = state.plan ? 'none' : '';
      if (selectBtn) selectBtn.style.display = state.plan ? '' : 'none';
      if (skipLink) skipLink.style.display = state.plan ? '' : 'none';
    });
  });

  // Auto-billing toggles
  qwiz.querySelectorAll('.auto-bill-toggle').forEach(toggle => {
    toggle.addEventListener('change', e => {
      state.autoBilling = e.target.checked;
    });
  });

  // Referral conditional
  document.getElementById('q-referral')?.addEventListener('change', e => {
    const v = e.target.value;
    document.getElementById('q-referrer-field').style.display = v === 'Referral' ? 'block' : 'none';
  });

  // Timeline conditional
  document.getElementById('q-timeline')?.addEventListener('change', e => {
    document.getElementById('q-date-field').style.display = e.target.value === 'specific_date' ? 'block' : 'none';
  });

  // Promo code apply button and Enter key
  document.getElementById('q-promo-apply')?.addEventListener('click', () => {
    const code = document.getElementById('q-promo')?.value.trim().toUpperCase() || '';
    applyPromo(code);
  });
  document.getElementById('q-promo')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = e.target.value.trim().toUpperCase();
      applyPromo(code);
    }
  });

  // GA4 — track quote wizard step progression
  function trackStep(step) {
    if (typeof gtag === 'undefined') return;
    gtag('event', 'quote_step', { step_number: step });
    if (step === 1) gtag('event', 'begin_checkout'); // started quote
  }

  // Submit handlers
  let submitted = false;
  function handleSubmit() {
    if (submitted) return;
    submitted = true;
    const p = calcPrice();
    const isLarge = state.sqft >= 5000;
    const planLabel = state.plan === '6month' ? '6-Month' : state.plan === 'quarterly' ? 'Quarterly' : state.plan === 'monthly' ? 'Monthly' : 'None (One-Time)';
    const screenTypeLabel = state.screenType === 'solar' ? 'Solar Screens' : 'Normal Screens';

    // Silent EmailJS send
    const emailPayload = {
      first_name:       state.firstName,
      last_name:        state.lastName || '',
      phone:            state.phone,
      email:            state.email || '',
      address:          state.address || '',
      property_type:    state.propertyType || 'Residential',
      sqft:             state.sqft,
      stories:          state.stories,
      last_cleaned:     state.lastCleaned || '',
      exterior_windows: 'Yes',
      interior_windows: state.svcInterior ? 'Yes' : 'No',
      screens:          state.svcScreens ? state.screenCount + ' screens (' + (state.screenType === 'solar' ? 'solar' : 'standard') + ')' : 'No',
      tracks:           state.svcTracks ? state.trackCount + ' tracks' : 'No',
      service_plan:     planLabel,
      auto_billing:     state.autoBilling ? '✅ Enrolled' : '❌ Not Enrolled',
      referral_source:  state.referral || '',
      timeline:         ({ asap: 'ASAP', within_1_week: 'Within 1 Week', within_2_weeks: 'Within 2 Weeks', specific_date: 'Specific Date' })[state.timeline] || state.timeline || '',
      promo_code:       state.promoCode || '',
      promo_discount:   state.promoDiscount || 0,
    };
    emailjs.send('service_xsex2ss', 'template_536xvvp', emailPayload).catch(() => {});

    // Derive deadline date
    let deadlineDate = state.deadlineDate || '';
    if (!deadlineDate) {
      const d = new Date();
      const days = { asap: 3, within_1_week: 7, within_2_weeks: 14 };
      d.setDate(d.getDate() + (days[state.timeline] || 30));
      deadlineDate = (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear();
    }

    // Send to n8n — handles all OpenPhone/Xecute steps server-side
    const servicesList = ['Exterior Windows'];
    if (state.svcInterior) servicesList.push('Interior Windows');
    if (state.svcScreens) servicesList.push('Screen Cleaning (' + screenTypeLabel + ')');
    if (state.svcTracks) servicesList.push('Track Cleaning');

    fetch('/n8n/webhook/f1cd6d3b-ddc5-4a08-9894-ff8bcb72659d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name:                 state.firstName,
        last_name:                  state.lastName || '',
        phone:                      state.phone,
        email:                      state.email || '',
        address:                    state.address || '',
        sqft:                       state.sqft,
        stories:                    state.stories,
        last_cleaned:               state.lastCleaned || '',
        property_type:              state.propertyType || 'Residential',
        service_plan:               planLabel,
        auto_billing:               state.autoBilling ? 'Enrolled' : 'Not Enrolled',
        exterior_price:             p.exterior.toFixed(2),
        interior_price:             p.interior.toFixed(2),
        screen_price:               p.screens.toFixed(2),
        track_price:                p.tracks.toFixed(2),
        discount:                   p.discount.toFixed(2),
        total_price:                p.total.toFixed(2),
        services:                   servicesList.join(', '),
        deadline_date:              deadlineDate,
        estimated_duration_minutes: getEstimatedDuration(),
        referral_source:            state.referral || '',
        timeline:                   ({ asap: 'ASAP', within_1_week: 'Within 1 Week', within_2_weeks: 'Within 2 Weeks', specific_date: 'Specific Date' })[state.timeline] || state.timeline || '',
        large_home:                 isLarge,
        promo_code:                 state.promoCode || '',
        promo_discount:             state.promoDiscount || 0,
      }),
    }).catch(() => {});

    // Send to CleanzATX Tracker — auto-creates client + plan
    fetch((window.CLEANZATX_TRACKER_URL || 'https://cleanzatx-tracker.vercel.app') + '/api/webhooks/quote-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name:                 state.firstName,
        last_name:                  state.lastName || '',
        phone:                      state.phone,
        email:                      state.email || '',
        address:                    state.address || '',
        sqft:                       state.sqft,
        stories:                    state.stories,
        last_cleaned:               state.lastCleaned || '',
        property_type:              state.propertyType || 'Residential',
        service_plan:               planLabel,
        auto_billing:               state.autoBilling ? 'Enrolled' : 'Not Enrolled',
        exterior_price:             p.exterior.toFixed(2),
        interior_price:             p.interior.toFixed(2),
        screen_price:               p.screens.toFixed(2),
        track_price:                p.tracks.toFixed(2),
        discount:                   p.discount.toFixed(2),
        total_price:                p.total.toFixed(2),
        services:                   servicesList.join(', '),
        deadline_date:              deadlineDate,
        estimated_duration_minutes: getEstimatedDuration(),
        referral_source:            state.referral || '',
        timeline:                   ({ asap: 'ASAP', within_1_week: 'Within 1 Week', within_2_weeks: 'Within 2 Weeks', specific_date: 'Specific Date' })[state.timeline] || state.timeline || '',
        large_home:                 isLarge,
        how_found:                  state.referral || '',
        promo_code:                 state.promoCode || '',
        promo_discount:             state.promoDiscount || 0,
      }),
    }).catch(() => {});

    // GA4 — lead conversion event
    if (typeof gtag !== 'undefined') {
      gtag('event', 'generate_lead', {
        value: parseFloat(calcPrice().total.toFixed(2)),
        currency: 'USD',
        lead_source: state.referral || 'unknown',
      });
    }

    // Show confirmation
    qwiz.querySelectorAll('.qwiz__panel').forEach(p => p.classList.remove('active'));
    const confirmPanel = qwiz.querySelector('[data-panel="confirm"]');
    confirmPanel.style.display = '';
    confirmPanel.classList.add('active');
    document.getElementById('q-confirm-msg').textContent = `Thanks! We'll be in touch with your quote shortly.`;

    // Hide progress
    qwiz.querySelector('.qwiz__progress').style.display = 'none';
  }

  document.getElementById('q-submit')?.addEventListener('click', handleSubmit);
  document.getElementById('q-submit-large')?.addEventListener('click', handleSubmit);

  // Initialize step 1
  goToStep(1);
}

/* ---------- Phone action modal ---------- */
(function () {
  const overlay = document.getElementById('phoneModal');
  if (!overlay) return;

  function openModal(e) {
    e.preventDefault();
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Intercept all tel: links
  document.querySelectorAll('a[href^="tel:"]').forEach(link => {
    link.addEventListener('click', openModal);
  });

  // Track phone call & text clicks
  overlay.querySelector('.phone-modal__btn--call')?.addEventListener('click', () => {
    if (typeof gtag !== 'undefined') gtag('event', 'phone_call_click', { method: 'call' });
  });
  overlay.querySelector('.phone-modal__btn--text')?.addEventListener('click', () => {
    if (typeof gtag !== 'undefined') gtag('event', 'phone_call_click', { method: 'text' });
  });

  // Close on cancel button or overlay backdrop click
  document.getElementById('phoneModalCancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Close on Escape
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
})();

/* ---------- GA4 — CTA button click tracking ---------- */
document.querySelectorAll('a[href="#quote"], .btn--primary, .btn--nav').forEach(btn => {
  btn.addEventListener('click', () => {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'cta_click', { button_text: btn.textContent.trim() });
    }
  });
});

/* ---------- Contact form (removed — replaced by quote wizard) ---------- */

/* ---------- Active nav link on scroll ---------- */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav__links a[href^="#"]');

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === `#${entry.target.id}`
          );
        });
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
sections.forEach(s => sectionObserver.observe(s));

/* ============================================================
   FEATURE ADDITIONS — Phase 2 Build
   ============================================================ */

/* ---------- #9 Quote form localStorage save/restore ---------- */
(function() {
  const STORAGE_KEY = 'cleanzatx_quote_draft';
  const fields = ['q-address', 'q-sqft', 'q-fname', 'q-lname', 'q-phone', 'q-email'];
  
  // Restore on load
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el && saved[id]) el.value = saved[id];
  });
  
  // Save on input
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      data[id] = el.value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    });
  });
  
  // Clear on submit
  document.getElementById('q-submit')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
  });
})();


/* ---------- #30 Confetti on quote submission ---------- */
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const pieces = Array.from({length: 120}, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    w: 8 + Math.random() * 8,
    h: 4 + Math.random() * 4,
    color: ['#0ea5e9','#34d399','#f59e0b','#ec4899','#8b5cf6','#fff'][Math.floor(Math.random()*6)],
    vx: (Math.random()-0.5)*3,
    vy: 2 + Math.random()*3,
    rot: Math.random()*360,
    rotV: (Math.random()-0.5)*6
  }));
  
  let frame;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI/180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
    });
    if (pieces.some(p => p.y < canvas.height + 20)) {
      frame = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }
  draw();
  setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 4000);
}

// Hook confetti to form submit
const origSubmitBtn = document.getElementById('q-submit');
if (origSubmitBtn) {
  origSubmitBtn.addEventListener('click', () => setTimeout(launchConfetti, 300));
}

/* ---------- #6 Exit-intent popup ---------- */
(function() {
  const popup = document.getElementById('exitPopup');
  if (!popup) return;
  let shown = false;
  let timer;

  document.addEventListener('mouseleave', (e) => {
    if (e.clientY < 10 && !shown && !sessionStorage.getItem('exitShown')) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        popup.classList.add('active');
        shown = true;
        sessionStorage.setItem('exitShown', '1');
      }, 200);
    }
  });

  // Mobile: show after 40s of inactivity
  if (window.innerWidth < 768) {
    setTimeout(() => {
      if (!shown && !sessionStorage.getItem('exitShown')) {
        popup.classList.add('active');
        shown = true;
        sessionStorage.setItem('exitShown', '1');
      }
    }, 40000);
  }

  document.getElementById('exitPopupClose')?.addEventListener('click', () => popup.classList.remove('active'));
  document.getElementById('exitPopupSkip')?.addEventListener('click', () => popup.classList.remove('active'));
  popup.addEventListener('click', (e) => { if (e.target === popup) popup.classList.remove('active'); });

  document.getElementById('exitPopupCTA')?.addEventListener('click', () => {
    localStorage.setItem('cleanzatx_promo', JSON.stringify({ code: 'SAVE25', discount: 25, source: 'exit_popup' }));
    popup.classList.remove('active');
    const quoteSection = document.getElementById('quote');
    if (quoteSection) {
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
      const top = quoteSection.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
})();

/* ---------- #12 Booking notifications ---------- */
(function() {
  const notif = document.getElementById('bookingNotif');
  if (!notif) return;

  const bookings = [
    { name: 'Sarah K.', msg: 'from Lakeway just booked a quarterly plan' },
    { name: 'Mike D.', msg: 'from Bee Cave just requested a quote' },
    { name: 'Jennifer R.', msg: 'from Rough Hollow just booked exterior cleaning' },
    { name: 'Tom & Linda B.', msg: 'from Spillman Ranch joined the quarterly plan' },
    { name: 'Amanda P.', msg: 'from Lakeway renewed her quarterly plan' },
    { name: 'Chris M.', msg: 'from Serene Hills just booked same-week service' },
    { name: 'Rachel W.', msg: 'from Four Points requested a power wash quote' },
    { name: 'David L.', msg: 'from Falconhead booked exterior + screens' },
  ];

  let idx = 0;
  function showNotif() {
    const b = bookings[idx % bookings.length];
    document.getElementById('bookingNotifName').textContent = b.name;
    document.getElementById('bookingNotifMsg').textContent = b.msg;
    notif.classList.add('show');
    setTimeout(() => notif.classList.remove('show'), 2500);
    idx++;
  }

  // First show after 20 seconds, then every 35 seconds
  setTimeout(() => {
    showNotif();
    setInterval(showNotif, 35000);
  }, 20000);
})();

/* ---------- #7 Urgency widget rotation ---------- */
(function() {
  const el = document.getElementById('urgencyText');
  if (!el) return;
  const msgs = [
    'Only <strong>4 spots</strong> left this week in Lakeway',
    '<strong>3 homeowners</strong> got quotes in the last hour',
    'Next opening: this week, <strong>spots filling fast</strong>',
    'Book today, get cleaned <strong>this week</strong>',
  ];
  let i = 0;
  setInterval(() => {
    i = (i + 1) % msgs.length;
    el.style.opacity = '0';
    setTimeout(() => { el.innerHTML = msgs[i]; el.style.opacity = '1'; }, 300);
  }, 5000);
})();

/* ---------- #31 FAQ accordion ---------- */
document.querySelectorAll('.faq-acc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item-acc').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

/* ---------- Quote mode toggle (#5) ---------- */
(function() {
  const instantBtn = document.getElementById('qmtInstant');
  const simpleBtn = document.getElementById('qmtSimple');
  const wizard = document.getElementById('quoteWizard');
  const simpleForm = document.getElementById('simpleQuote');
  if (!instantBtn || !simpleBtn) return;

  instantBtn.addEventListener('click', () => {
    instantBtn.classList.add('qmt-btn--active');
    simpleBtn.classList.remove('qmt-btn--active');
    if (wizard) wizard.style.display = '';
    if (simpleForm) simpleForm.style.display = 'none';
  });
  simpleBtn.addEventListener('click', () => {
    simpleBtn.classList.add('qmt-btn--active');
    instantBtn.classList.remove('qmt-btn--active');
    if (wizard) wizard.style.display = 'none';
    if (simpleForm) simpleForm.style.display = '';
  });

  // Simple form size → price estimate
  document.getElementById('sq-size')?.addEventListener('change', function() {
    const prices = { small: '$150 – $250', medium: '$250 – $400', large: '$400 – $600', xlarge: 'Custom quote' };
    const est = document.getElementById('sqEstimate');
    const priceEl = document.getElementById('sqPrice');
    if (this.value && est) {
      priceEl.textContent = prices[this.value];
      est.style.display = '';
    }
  });

  // Simple form submit
  document.getElementById('sq-submit')?.addEventListener('click', () => {
    const name = document.getElementById('sq-name')?.value.trim();
    const phone = document.getElementById('sq-phone')?.value.trim();
    if (!name || !phone) return;
    
    // Send via EmailJS
    if (typeof emailjs !== 'undefined') {
      emailjs.send('service_xsex2ss', 'template_536xvvp', {
        first_name: name,
        phone: phone,
        address: document.getElementById('sq-address')?.value || '',
        sqft: document.getElementById('sq-size')?.value || '',
        exterior_windows: 'Yes',
        service_plan: 'Simple Request',
      }).catch(() => {});
    }

    // GA4
    if (typeof gtag !== 'undefined') gtag('event', 'generate_lead', { lead_source: 'simple_form' });
    
    document.getElementById('sq-submit').style.display = 'none';
    document.getElementById('sqConfirm').style.display = '';
  });
})();

/* ---------- #49 Quote abandonment email ---------- */
(function() {
  let maxStep = 0;
  let abandonTimer;
  
  // Track max step reached (main.js trackStep calls gtag — we also track here)
  const origGoToStep = window._origGoToStep;
  
  document.addEventListener('quote_step_reached', (e) => {
    if (e.detail > maxStep) maxStep = e.detail;
  });

  // Listen for page unload if past step 2
  window.addEventListener('beforeunload', () => {
    if (maxStep >= 2 && !sessionStorage.getItem('quoteSubmitted')) {
      // Send abandonment notification via EmailJS
      const fname = document.getElementById('q-fname')?.value?.trim();
      const phone = document.getElementById('q-phone')?.value?.trim();
      if (phone) {
        emailjs.send('service_xsex2ss', 'template_536xvvp', {
          first_name: fname || 'Visitor',
          phone: phone,
          address: document.getElementById('q-address')?.value || '',
          sqft: document.getElementById('q-sqft')?.value || '',
          service_plan: 'ABANDONED — reached step ' + maxStep,
          exterior_windows: 'Abandoned',
          timeline: 'Abandoned at step ' + maxStep,
        }).catch(() => {});
      }
    }
  });

  // Mark as submitted
  document.getElementById('q-submit')?.addEventListener('click', () => {
    sessionStorage.setItem('quoteSubmitted', '1');
  });
})();

/* ---------- #11 Before/After Drag Slider ---------- */
(function() {
  document.querySelectorAll('.ba-slider').forEach(slider => {
    const handle = slider.querySelector('.ba-handle');
    const afterLayer = slider.querySelector('.ba-after');
    let dragging = false;

    function setPos(x) {
      const rect = slider.getBoundingClientRect();
      let pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
      afterLayer.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      handle.style.left = pct + '%';
    }

    handle.addEventListener('mousedown', () => dragging = true);
    handle.addEventListener('touchstart', () => dragging = true, { passive: true });
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('touchend', () => dragging = false);
    window.addEventListener('mousemove', e => { if (dragging) setPos(e.clientX); });
    window.addEventListener('touchmove', e => { if (dragging) setPos(e.touches[0].clientX); }, { passive: true });
    
    // Initialize at 50%
    slider.addEventListener('click', e => setPos(e.clientX));
    setPos(slider.getBoundingClientRect().left + slider.getBoundingClientRect().width * 0.5);
  });
})();

/* ---------- Mobile CTA bar hide when quote form visible ---------- */
(function() {
  const bar = document.getElementById('mobileCTABar');
  if (!bar) return;
  const quoteSection = document.getElementById('quote');
  if (!quoteSection) return;
  // Hide bar while quote section is visible OR above it (start hidden, show after scrolling past)
  bar.classList.add('hidden');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      // Show bar only when quote section has fully scrolled out of view (below or above)
      if (e.isIntersecting) {
        bar.classList.add('hidden');
      } else {
        // Only show if we've scrolled PAST the quote section (not before it)
        const rect = quoteSection.getBoundingClientRect();
        if (rect.bottom < 0) bar.classList.remove('hidden');
      }
    });
  }, { threshold: 0.05 });
  obs.observe(quoteSection);
})();

/* ---------- Address Autofill (Nominatim) ---------- */
(function() {
  function initAddressAutofill(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Create dropdown
    const wrap = input.parentElement;
    wrap.style.position = 'relative';
    const dropdown = document.createElement('ul');
    dropdown.className = 'addr-dropdown';
    dropdown.style.cssText = 'display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:9999;list-style:none;margin:0;padding:4px 0;background:#0f2440;border:1px solid rgba(14,165,233,.3);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.4);max-height:220px;overflow-y:auto;';
    wrap.appendChild(dropdown);

    let debounceTimer;
    let currentResults = [];

    function closeDropdown() {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
    }

    function renderResults(results) {
      dropdown.innerHTML = '';
      if (!results.length) { closeDropdown(); return; }
      results.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r.display_name;
        li.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:.9rem;color:rgba(255,255,255,.85);border-bottom:1px solid rgba(255,255,255,.06);line-height:1.4;';
        li.addEventListener('mouseenter', () => li.style.background = 'rgba(14,165,233,.15)');
        li.addEventListener('mouseleave', () => li.style.background = '');
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          input.value = r.display_name;
          closeDropdown();
          input.dispatchEvent(new Event('change'));
        });
        dropdown.appendChild(li);
      });
      dropdown.style.display = 'block';
    }

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (q.length < 3) { closeDropdown(); return; }
      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&q=${encodeURIComponent(q + ' Texas')}`);
          const data = await res.json();
          currentResults = data;
          renderResults(data);
        } catch(e) { closeDropdown(); }
      }, 300);
    });

    input.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('li');
      const active = dropdown.querySelector('li.active');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = active ? active.nextElementSibling : items[0];
        if (active) active.classList.remove('active');
        if (next) { next.classList.add('active'); next.style.background = 'rgba(14,165,233,.2)'; }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = active ? active.previousElementSibling : items[items.length - 1];
        if (active) { active.classList.remove('active'); active.style.background = ''; }
        if (prev) { prev.classList.add('active'); prev.style.background = 'rgba(14,165,233,.2)'; }
      } else if (e.key === 'Enter' && active) {
        e.preventDefault();
        input.value = active.textContent;
        closeDropdown();
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) closeDropdown();
    });
  }

  initAddressAutofill('q-address');
  initAddressAutofill('sq-address');
})();

/* ---------- Plan card → auto-select in quote wizard ---------- */
(function() {
  document.querySelectorAll('.plan-card__cta[data-plan]').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const plan = this.getAttribute('data-plan');
      if (!plan) return;
      // Store chosen plan so wizard can pick it up
      sessionStorage.setItem('cleanzatx_chosen_plan', plan);
    });
  });

  // When the wizard renders step 3 (plan selection), check for a pre-chosen plan
  // Hook into goToStep — patch it after it's defined
  const _origGoToStep = window.__goToStep;
  document.addEventListener('qwiz:step', function(e) {
    if (e.detail && e.detail.step === 3) applyPreChosenPlan();
  });

  function applyPreChosenPlan() {
    const plan = sessionStorage.getItem('cleanzatx_chosen_plan');
    if (!plan) return;
    const planEl = document.querySelector(`.qwiz__plan[data-plan="${plan}"]`);
    if (planEl) {
      // Deselect all, select this one
      document.querySelectorAll('.qwiz__plan').forEach(p => p.classList.remove('selected'));
      planEl.classList.add('selected');
      // Update state if available
      if (window.__qwizState) window.__qwizState.plan = plan;
      sessionStorage.removeItem('cleanzatx_chosen_plan');
    }
  }
})();
