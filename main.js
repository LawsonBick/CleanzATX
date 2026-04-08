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
  const state = {
    step: 1,
    address: '', sqft: 0, stories: 0,
    propertyType: 'Residential',
    windowCount: 0, screenCount: 0, trackCount: 0,
    screenType: 'normal',
    svcExterior: true, svcInterior: false, svcScreens: false, svcTracks: false,
    plan: null, autoBilling: false,
    firstName: '', phone: '', email: '',
    referral: '', referrer: '', timeline: '', deadlineDate: '',
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
    label.textContent = `Step ${step} of 5 — ${stepLabels[step] || ''}`;

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
    const total = Math.max(0, subtotal - discount);
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
      document.getElementById('skipPlanBtn').style.display = state.plan ? 'none' : '';
      document.getElementById('selectPlanBtn').style.display = state.plan ? '' : 'none';
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
