// POST /api/quote-lead — Vercel serverless function (Node, no dependencies).
//
// For each website quote:
//   1. read the next 30 days of jobs from Rotor and pick 1–3 open AM/PM slots
//      using the CONFIG rules below — plain rules, no AI
//   2. create/update the lead in Rotor (the CRM), noting what was offered
//   3. send one welcome text from the business line via Quo. Consent is given
//      by submitting: the form says so right above the submit button.
// A failure in any step never stops the next one, and the website never waits
// on this (the form fires it with keepalive and shows its confirmation at once).
//
// Secrets live only in Vercel environment variables, never in this repo:
//   ROTOR_API_KEY    Rotor Open API key — scopes leads:create and jobs:read
//   QUO_API_KEY      Quo (formerly OpenPhone) API key
//   QUO_FROM_NUMBER  Quo line the welcome text comes from, E.164 (e.g. +15125180512)

// ───────────── Scheduling rules (edit these) ─────────────
const CONFIG = {
  TIME_ZONE: 'America/Chicago',
  CREWS: 1,                         // a slot is full once this many jobs occupy it
  WORK_DAYS: [1, 2, 3, 4, 5],       // 0 = Sun … 6 = Sat → Mon–Fri
  MIN_BUSINESS_DAYS_OUT: 1,         // earliest offer: the next work day (never same-day)…
  LATE_CUTOFF_HOUR: 15,             // …or the one after, if the request comes in at/after 3 PM
  SCHEDULE_FETCH_DAYS: 30,          // how far ahead to read the Rotor schedule

  // Two slots per work day (plain hyphens keep the text in cheap GSM-7 encoding)
  SLOTS: { AM: '8-9 AM', PM: '12-1 PM' },

  // How an existing Rotor job blocks slots (price = sum of its line items)
  FULL_DAY_PRICE: 800,              // price ≥ $800 → blocks AM + PM
  AM_ONLY_LATEST_START: '09:00',    // cheaper job starting at/before 9:00 AM → blocks AM only
  PM_START: '12:00',                // cheaper job starting at/after 12:00 PM → blocks PM only
                                    // (cheaper job starting 9:01–11:59 → blocks AM + PM)

  // New job size: FULL DAY if any rule matches, otherwise HALF DAY
  FULL_DAY_IF: {
    WINDOWS_MIN_SQFT: 4000,         // any window cleaning at 4,000+ sq ft
    WINDOWS_AND_POWER_MIN_SQFT: 2000, // windows + power washing at 2,000+ sq ft — default, confirm with owner
    HOUSE_OR_ROOF_SERVICES: ['house_wash', 'roof_wash'],
    HOUSE_OR_ROOF_MIN_SQFT: 3000,   // house wash or roof wash at 3,000+ sq ft — default, confirm with owner
  },

  // Where to look, by the form's "Timeline" answer
  SEARCH: {
    asap: { businessDays: 5 },          // the next 5 business days
    within_1_week: { calendarDays: 7 },
    within_2_weeks: { calendarDays: 14 },
    flexible: { calendarDays: 21 },
    specific_date: { aroundBusinessDays: 3 }, // that date first, then the nearest open slots ±3 business days
    default: { calendarDays: 14 },      // timeline missing/unknown
  },

  MAX_OFFERS: 3,
  TEXT_MAX_CHARS: 320,
  TEXT_COOLDOWN_MINUTES: 10,        // don't text the same phone twice within this window
};

const ROTOR_BASE = 'https://api.getrotor.com/open-api';
const QUO_URL = 'https://api.quo.com/v1/messages';
const ALLOWED_HOSTS = new Set(['cleanzatx.com', 'www.cleanzatx.com']);

// Service keys the form can send, mapped to fixed labels. Anything else is ignored.
const WINDOW_SERVICES = {
  ext_windows: 'Exterior Windows', int_windows: 'Interior Windows', screens: 'Screen Cleaning',
  tracks: 'Track Cleaning', skylights: 'Skylights', post_construction: 'Post Construction',
  hard_water: 'Hard Water Removal',
};
const POWER_SERVICES = {
  house_wash: 'House Washing', driveway: 'Driveway', front_patio: 'Front Patio', back_patio: 'Back Patio',
  roof_wash: 'Roof Cleaning', gutters: 'Gutter Cleaning', stone_limestone: 'Stone / Limestone',
  deck_fence: 'Deck / Fence',
};
const POWER_SHORT = {
  house_wash: 'house wash', driveway: 'driveway', front_patio: 'front patio', back_patio: 'back patio',
  roof_wash: 'roof', gutters: 'gutters', stone_limestone: 'stone', deck_fence: 'deck/fence',
};
const FREQUENCIES = { one_time: 'One-Time Clean', bimonthly: 'Every 2 Months', quarterly: 'Quarterly', '6month': 'Every 6 Months' };
const TIMELINES = { asap: 'ASAP', within_1_week: 'Within 1 Week', within_2_weeks: 'Within 2 Weeks', flexible: 'Flexible', specific_date: 'Specific Date' };
const LAST_CLEANED = { never: 'Never / First Time', '1_month': 'Within 1 Month', '3_months': '1–3 Months Ago', '6_months': '3–6 Months Ago', '1_year': '6–12 Months Ago', over_1_year: 'Over a Year Ago' };

// Best-effort duplicate-text guard, in this function instance's memory only
const recentTexts = new Map();
const clock = { now: () => new Date() };   // swappable in tests

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');

// ───────────── Dates (calendar days in CONFIG.TIME_ZONE) ─────────────
const tzParts = new Intl.DateTimeFormat('en-US', {
  timeZone: CONFIG.TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function localParts(date) {
  const p = {};
  for (const x of tzParts.formatToParts(date)) p[x.type] = x.value;
  return { key: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}
// Date-only math on "YYYY-MM-DD" keys, anchored at noon UTC so DST never shifts the day
const keyToDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const dateToKey = dt => dt.toISOString().slice(0, 10);
const addDays = (key, n) => { const dt = keyToDate(key); dt.setUTCDate(dt.getUTCDate() + n); return dateToKey(dt); };
const weekday = key => keyToDate(key).getUTCDay();
const isWorkDay = key => CONFIG.WORK_DAYS.includes(weekday(key));
const daysBetween = (a, b) => Math.round((keyToDate(b) - keyToDate(a)) / 86400000);
const fmtDay = (key, comma = true) => {
  const s = keyToDate(key).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  return comma ? s : s.replace(',', '');   // "Tue, Nov 3" / "Tue Nov 3"
};
// Accepts "YYYY-MM-DD" (date input) or "M/D/YYYY"
function parseDayKey(raw) {
  const s = str(raw, 20);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return '';
}

// ───────────── Slot picker ─────────────
const toMinutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const isCancelled = job => /^cancel/i.test(String(job && job.status || ''));
const jobPrice = job => (Array.isArray(job.line_items) ? job.line_items : [])
  .reduce((sum, li) => sum + (Number(li && li.total_price) || 0), 0);

// Which slots an existing job takes: ['AM'], ['PM'] or ['AM', 'PM']
function slotsTaken(job, startParts) {
  const mins = startParts.hour * 60 + startParts.minute;
  if (jobPrice(job) >= CONFIG.FULL_DAY_PRICE) return ['AM', 'PM'];
  if (mins <= toMinutes(CONFIG.AM_ONLY_LATEST_START)) return ['AM'];
  if (mins < toMinutes(CONFIG.PM_START)) return ['AM', 'PM'];
  return ['PM'];
}

// "YYYY-MM-DD" → { AM: n, PM: n } jobs occupying each slot
function occupancy(jobs) {
  const occ = new Map();
  for (const job of jobs || []) {
    if (!job || isCancelled(job) || !job.service_date) continue;
    const start = new Date(job.service_date);
    if (isNaN(start)) continue;
    const parts = localParts(start);
    const day = occ.get(parts.key) || { AM: 0, PM: 0 };
    for (const slot of slotsTaken(job, parts)) day[slot]++;
    occ.set(parts.key, day);
  }
  return occ;
}

function newJobSize({ windowPicked, powerPicked, sqft }) {
  const F = CONFIG.FULL_DAY_IF;
  const full = (windowPicked.length > 0 && sqft >= F.WINDOWS_MIN_SQFT) ||
    (windowPicked.length > 0 && powerPicked.length > 0 && sqft >= F.WINDOWS_AND_POWER_MIN_SQFT) ||
    (powerPicked.some(k => F.HOUSE_OR_ROOF_SERVICES.includes(k)) && sqft >= F.HOUSE_OR_ROOF_MIN_SQFT);
  return full ? 'full' : 'half';
}

// Work days strictly after `from` up to and including `to`
function businessDaysBetween(from, to) {
  let n = 0;
  for (let k = addDays(from, 1); k <= to; k = addDays(k, 1)) if (isWorkDay(k)) n++;
  return n;
}
// The work day n work days away (n may be negative)
function shiftBusinessDays(key, n) {
  let k = key;
  for (let left = Math.abs(n); left > 0;) { k = addDays(k, Math.sign(n)); if (isWorkDay(k)) left--; }
  return k;
}

// Returns up to CONFIG.MAX_OFFERS { key: 'YYYY-MM-DD', slot: 'AM' | 'PM' }
function pickOffers({ now, jobs, size, timeline, preferredKey }) {
  const { key: today, hour } = localParts(now);
  const earliestBiz = CONFIG.MIN_BUSINESS_DAYS_OUT + (hour >= CONFIG.LATE_CUTOFF_HOUR ? 1 : 0);
  const lastKnown = addDays(today, CONFIG.SCHEDULE_FETCH_DAYS);   // only trust days we read the schedule for
  const eligible = key => key > today && key <= lastKnown && isWorkDay(key) && businessDaysBetween(today, key) >= earliestBiz;

  // Candidate days in search order
  const S = CONFIG.SEARCH;
  const specific = timeline === 'specific_date' && preferredKey;
  let candidates = [];
  if (specific) {
    const r = S.specific_date.aroundBusinessDays;
    for (let i = 1; i <= r; i++) candidates.push(shiftBusinessDays(preferredKey, -i), shiftBusinessDays(preferredKey, i));
  } else {
    const rule = S[timeline] && timeline !== 'specific_date' ? S[timeline] : S.default;
    const end = rule.businessDays ? shiftBusinessDays(today, rule.businessDays) : addDays(today, rule.calendarDays);
    for (let k = addDays(today, 1); k <= end; k = addDays(k, 1)) candidates.push(k);
  }
  candidates = candidates.filter(eligible);

  const occ = occupancy(jobs);
  const free = (key, slot) => ((occ.get(key) || { AM: 0, PM: 0 })[slot]) < CONFIG.CREWS;
  const emptyDay = key => free(key, 'AM') && free(key, 'PM');
  const pmOnly = key => !free(key, 'AM') && free(key, 'PM');   // a morning job ends ~noon

  const first = [];
  if (specific && eligible(preferredKey)) {
    if (emptyDay(preferredKey)) first.push({ key: preferredKey, slot: 'AM' });
    else if (size === 'half' && pmOnly(preferredKey)) first.push({ key: preferredKey, slot: 'PM' });
  }
  const rest = [];
  const room = () => CONFIG.MAX_OFFERS - first.length - rest.length;
  for (const key of candidates) if (room() > 0 && emptyDay(key)) rest.push({ key, slot: 'AM' });
  if (size === 'half') for (const key of candidates) if (room() > 0 && pmOnly(key)) rest.push({ key, slot: 'PM' });
  rest.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return [...first, ...rest];
}

// ───────────── Text message ─────────────
// First name as it may appear in a text: letters, apostrophes, hyphens only, short,
// so nobody can put a link or message of their own into our SMS
function safeFirstName(raw) {
  const name = str(raw, 40).split(/\s+/)[0].replace(/[^\p{L}'’-]/gu, '').slice(0, 20);
  return name || 'there';
}

function serviceSummaries(windowPicked, powerPicked) {
  const powerList = map => (powerPicked.length <= 2 ? powerPicked.map(k => map[k]).join(' + ') : 'power washing');
  const long = [windowPicked.length && 'window cleaning', powerPicked.length && powerList(Object.fromEntries(Object.entries(POWER_SERVICES).map(([k, v]) => [k, v.toLowerCase()])))];
  const short = [windowPicked.length && 'windows', powerPicked.length && powerList(POWER_SHORT)];
  const tiny = [windowPicked.length && 'windows', powerPicked.length && 'power washing'];
  return [long, short, tiny].map(a => a.filter(Boolean).join(' + ') || 'exterior cleaning');
}

const offerLabel = (o, comma = true) => comma ? `${fmtDay(o.key)} (${CONFIG.SLOTS[o.slot]})` : `${fmtDay(o.key, false)} ${CONFIG.SLOTS[o.slot]}`;

function buildText(first, windowPicked, powerPicked, offers) {
  const body = (services, list) => {
    const l = list.map(o => offerLabel(o));
    const open = l.length === 0 ? null
      : l.length === 1 ? `We have ${l[0]} open. Would that work for you? `
      : l.length === 2 ? `We have ${l[0]} or ${l[1]} open. Would either of those work for you? `
      : `We have ${l.slice(0, -1).join(', ')} or ${l[l.length - 1]} open. Would any of those work for you? `;
    return `Hi ${first}, thanks for reaching out to CleanzATX! We just got your request for ${services}. ` +
      (open ? `${open}Tyler will reach out shortly with your price.` : 'Tyler will reach out shortly with your price and available dates.');
  };
  // Shorten the services text first, then drop offers, until it fits
  for (let n = offers.length; n >= 0; n--) {
    for (const services of serviceSummaries(windowPicked, powerPicked)) {
      const t = body(services, offers.slice(0, n));
      if (t.length <= CONFIG.TEXT_MAX_CHARS) return t;
    }
  }
  return body(serviceSummaries(windowPicked, powerPicked).pop(), []);
}

// ───────────── Rotor lead notes ─────────────
function buildNotes(f, windowPicked, powerPicked, offerLine, size) {
  const lines = [];
  if (offerLine) lines.push(offerLine);
  if (size) lines.push(`Job size: ${size} day`);
  if (offerLine || size) lines.push('');
  if (windowPicked.length) lines.push('WINDOW CLEANING:', ...windowPicked.map(k => '- ' + WINDOW_SERVICES[k]), '');
  if (powerPicked.length) lines.push('POWER WASHING:', ...powerPicked.map(k => '- ' + POWER_SERVICES[k]), '');
  const row = (label, value) => { if (value) lines.push(`${label}: ${value}`); };
  row('Frequency', FREQUENCIES[f.frequency] || str(f.frequency, 40));
  row('Timeline', TIMELINES[f.timeline] || str(f.timeline, 40));
  row('Target date', str(f.target_date, 20));
  row('Last serviced', LAST_CLEANED[f.last_cleaned] || str(f.last_cleaned, 40));
  row('Property type', str(f.property_type, 40));
  row('Sq ft', str(f.sqft, 10));
  row('Stories', str(f.stories, 5));
  const referral = str(f.referral, 60), referrer = str(f.referrer, 80);
  row('How they found us', referral + (referrer ? ` (${referrer})` : ''));
  lines.push('SMS consent: Yes (agreed by submitting)');
  const custNotes = str(f.notes, 1500);
  if (custNotes) lines.push('', 'Customer notes:', custNotes);
  const text = lines.join('\n');
  return text.length > 2000 ? text.slice(0, 1999) + '…' : text;
}

// ───────────── HTTP helpers ─────────────
function toE164(raw) {   // US numbers only → +1XXXXXXXXXX, or ''
  let d = str(raw, 40).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (d.length !== 10 || !/^[2-9]\d{2}[2-9]/.test(d)) return '';
  return '+1' + d;
}

function allowedOrigin(req) {
  for (const h of [req.headers.origin, req.headers.referer]) {
    if (!h) continue;
    try { return ALLOWED_HOSTS.has(new URL(h).hostname); } catch (e) { return false; }
  }
  return false;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function errorCode(resp) {
  try { const j = await resp.json(); return j.error_code || j.code || (j.error && j.error.key) || ''; } catch (e) { return ''; }
}

const rotorHeaders = key => ({ 'x-api-key': key, 'rotor-api-version': '1.1.0', 'Content-Type': 'application/json' });

async function rotorUpsert(key, lead) {
  try {
    const resp = await fetch(`${ROTOR_BASE}/leads`, { method: 'POST', headers: rotorHeaders(key), body: JSON.stringify(lead), signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return { ok: false, status: resp.status, code: await errorCode(resp) };
    let id = '';
    try { id = (await resp.json()).id || ''; } catch (e) {}
    return { ok: true, status: resp.status, id };
  } catch (e) {
    return { ok: false, status: 0, code: e && e.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}

async function rotorUpcomingJobs(key, from, to) {
  const jobs = [];
  try {
    for (let page = 1; page <= 3; page++) {
      const q = new URLSearchParams({ only_completed: 'false', service_date_range_start: from.toISOString(), service_date_range_end: to.toISOString(), limit: '1000', page: String(page) });
      const resp = await fetch(`${ROTOR_BASE}/serviced-jobs?${q}`, { headers: rotorHeaders(key), signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return { ok: false, status: resp.status, code: await errorCode(resp) };
      const body = await resp.json();
      const list = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : null;
      if (!list) return { ok: false, status: resp.status, code: 'bad_shape' };
      jobs.push(...list);
      if (!(body.pagination && body.pagination.has_more)) break;
    }
    return { ok: true, jobs };
  } catch (e) {
    return { ok: false, status: 0, code: e && e.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}

async function quoSend(key, from, to, content) {
  try {
    const resp = await fetch(QUO_URL, {
      method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, from, to: [to] }), signal: AbortSignal.timeout(8000),
    });
    return resp.ok ? { ok: true } : { ok: false, status: resp.status, code: await errorCode(resp) };
  } catch (e) {
    return { ok: false, status: 0, code: e && e.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}

// ───────────── Handler ─────────────
async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { ok: false }); }
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return send(res, 415, { ok: false });
  if (!allowedOrigin(req)) return send(res, 403, { ok: false });

  let f = req.body;
  if (typeof f === 'string') { try { f = JSON.parse(f); } catch (e) { f = null; } }
  if (!f || typeof f !== 'object' || Array.isArray(f)) return send(res, 400, { ok: false });

  if (str(f.company)) return send(res, 400, { ok: false });   // honeypot filled → bot

  const first = str(f.first_name, 60), last = str(f.last_name, 60);
  const phone = toE164(f.phone);
  if (!first || !phone) return send(res, 400, { ok: false });

  const rotorKey = process.env.ROTOR_API_KEY;
  if (!rotorKey) return send(res, 503, { ok: false });

  const services = Array.isArray(f.services) ? f.services : [];
  const windowPicked = Object.keys(WINDOW_SERVICES).filter(k => services.includes(k));
  const powerPicked = Object.keys(POWER_SERVICES).filter(k => services.includes(k));
  const now = clock.now();

  // Will we text? (Quo configured + not texted this number in the last few minutes)
  const quoKey = process.env.QUO_API_KEY, quoFrom = process.env.QUO_FROM_NUMBER;
  const cooldown = CONFIG.TEXT_COOLDOWN_MINUTES * 60000;
  for (const [p, t] of recentTexts) if (now - t > cooldown) recentTexts.delete(p);
  const willText = !!quoKey && !!quoFrom && !recentTexts.has(phone);
  if (willText) recentTexts.set(phone, now.getTime());

  // 1. Schedule → 1–3 open slots (only needed when we're about to text)
  const size = newJobSize({ windowPicked, powerPicked, sqft: Number(f.sqft) || 0 });
  let offers = [];
  if (willText) {
    const preferredKey = f.timeline === 'specific_date' ? parseDayKey(f.preferred_date) : '';
    const sched = await rotorUpcomingJobs(rotorKey, now, new Date(now.getTime() + CONFIG.SCHEDULE_FETCH_DAYS * 86400000));
    if (sched.ok) offers = pickOffers({ now, jobs: sched.jobs, size, timeline: str(f.timeline, 30), preferredKey });
    else console.error('rotor_schedule_failed', sched.status, sched.code);
  }
  const textBody = willText ? buildText(safeFirstName(first), windowPicked, powerPicked, offers) : '';
  // What the text actually offers (it may drop offers to stay under the length limit)
  const offered = offers.filter(o => textBody.includes(offerLabel(o)));
  const offer = offered.map(o => offerLabel(o, false)).join(' / ');

  // 2. Lead in Rotor
  const tags = ['website-quote'];
  if (windowPicked.length) tags.push('window-cleaning');
  if (powerPicked.length) tags.push('power-washing');
  tags.push('sms-consent');   // the form notice: submitting = OK to call/text about the quote
  const offerLine = !willText ? 'No welcome text was sent (texting not set up, or already texted in the last few minutes). Follow up by text or call.'
    : offer ? `Texted offer: ${offer}` : 'Texted welcome (no open slots offered; send price and dates).';
  const email = str(f.email, 255);
  const lead = {
    name: `${first} ${last}`.trim(),
    phone,
    ...(email ? { email } : {}),
    address_street1: str(f.address, 255),
    address_state: 'TX',
    address_country: 'US',
    source: 'Website quote form',
    stage: 'New',
    priority: 'high',
    service_type: [windowPicked.length && 'Window Cleaning', powerPicked.length && 'Power Washing'].filter(Boolean).join(' + ') || 'Exterior Cleaning',
    tags,
    notes: buildNotes(f, windowPicked, powerPicked, offerLine, size),
  };
  const rotor = await rotorUpsert(rotorKey, lead);
  if (!rotor.ok) console.error('rotor_lead_failed', rotor.status, rotor.code);

  // 3. Welcome text
  if (willText) {
    const sent = await quoSend(quoKey, quoFrom, phone, textBody);
    if (!sent.ok) {
      recentTexts.delete(phone);
      console.error('quo_text_failed', sent.status, sent.code);
    }
    if (rotor.ok) {
      // Re-send the full lead by id: tags merge, notes reflect what actually happened
      const update = sent.ok
        ? { ...lead, tags: [...tags, 'texted-welcome', ...(offer ? ['offered-dates'] : [])] }
        : { ...lead, notes: buildNotes(f, windowPicked, powerPicked, 'Welcome text FAILED to send' + (offer ? ` (would have offered ${offer})` : '') + '. Call or text them.', size) };
      const tagged = await rotorUpsert(rotorKey, { ...(rotor.id ? { id: rotor.id } : {}), ...update });
      if (!tagged.ok) console.error('rotor_update_failed', tagged.status, tagged.code);
    }
  }

  return rotor.ok ? send(res, 200, { ok: true }) : send(res, 502, { ok: false });
}

module.exports = handler;
module.exports._test = { CONFIG, clock, recentTexts, pickOffers, newJobSize, slotsTaken, occupancy, jobPrice, buildText, buildNotes, toE164, safeFirstName, parseDayKey, localParts };
