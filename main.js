/* ============================================================
   CleanzATX — main.js
   ============================================================ */

/* ---------- Nav scroll effect ---------- */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

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

/* ---------- Contact form ---------- */
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    // Simulate send (replace with real endpoint)
    setTimeout(() => {
      form.innerHTML = `
        <div class="form-success">
          <div class="form-success__check">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3>Request Sent!</h3>
          <p>Thanks! We'll be in touch within a few hours.<br>Or call us now at <a href="tel:5125180512" style="color:var(--sky);font-weight:600">(512) 518-0512</a>.</p>
        </div>
      `;
    }, 900);
  });
}

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
