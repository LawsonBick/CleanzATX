// POST /api/quote-lead — Vercel serverless function (Node, no dependencies).
//
// For each website quote:
//   1. read the upcoming schedule from Rotor and pick 1–2
//      open mornings using the CONFIG rules below — plain rules, no AI
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
  WORK_DAYS: [1, 2, 3, 4, 5],     // 0 = Sun … 6 = Sat → Mon–Fri
  MIN_BUSINESS_DAYS_OUT: 1,       // earliest offer: the next work day…
  LATE_CUTOFF_HOUR: 15,           // …or the one after, if the request comes in at/after 3 PM
  LOOKAHEAD_DAYS: 14,             // only offer days within the next 14 days
  SCHEDULE_FETCH_DAYS: 21,        // how far ahead to read the Rotor schedule
  MAX_OFFERS: 2,                  // offer up to 2 days
  ARRIVAL_WINDOW: '8-9 AM',       // plain hyphen keeps the text in cheap GSM-7 encoding
  MORNING_ENDS_HOUR: 12,          // small job: day is open if no job starts before noon
  BIG_JOB: {                      // big job: the day must have no jobs at all
    BOTH_CATEGORIES: true,        // window cleaning AND power washing
    SERVICES: ['house_wash', 'roof_wash', 'post_construction'],
    MIN_SQFT: 4000,
    MIN_STORIES: 3,
  },
  TEXT_MAX_CHARS: 320,
  TEXT_COOLDOWN_MINUTES: 10,      // don't text the same phone twice within this window
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
  timeZone: CONFIG.TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});
function localParts(date) {
  const p = {};
  for (const x of tzParts.formatToParts(date)) p[x.type] = x.value;
  return { key: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
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

// ───────────── Day picker ─────────────
function isBigJob({ windowPicked, powerPicked, sqft, stories }) {
  const B = CONFIG.BIG_JOB;
  return (B.BOTH_CATEGORIES && windowPicked.length > 0 && powerPicked.length > 0) ||
    [...windowPicked, ...powerPicked].some(k => B.SERVICES.includes(k)) ||
    sqft >= B.MIN_SQFT || stories >= B.MIN_STORIES;
}

const isCancelled = job => /^cancel/i.test(String(job && job.status || ''));

// jobs: Rotor serviced jobs; returns up to CONFIG.MAX_OFFERS "YYYY-MM-DD" keys
function pickOpenDays({ now, jobs, big, preferredKey }) {
  const { key: today, hour } = localParts(now);
  const minBiz = CONFIG.MIN_BUSINESS_DAYS_OUT + (hour >= CONFIG.LATE_CUTOFF_HOUR ? 1 : 0);

  const busyAllDay = new Set(), busyMorning = new Set();
  for (const job of jobs || []) {
    if (isCancelled(job) || !job.service_date) continue;
    const start = new Date(job.service_date);
    if (isNaN(start)) continue;
    const { key, hour: h } = localParts(start);
    busyAllDay.add(key);
    if (h < CONFIG.MORNING_ENDS_HOUR) busyMorning.add(key);
  }
  const isOpen = key => (big ? !busyAllDay.has(key) : !busyMorning.has(key));

  // Work days from tomorrow on, numbered by business days out
  const eligible = (key) => {
    const span = daysBetween(today, key);
    if (span < 1 || !isWorkDay(key)) return false;
    let biz = 0;
    for (let i = 1; i <= span; i++) if (isWorkDay(addDays(today, i))) biz++;
    return biz >= minBiz;
  };

  const picks = [];
  const latest = addDays(today, CONFIG.SCHEDULE_FETCH_DAYS);   // only trust days we read the schedule for
  if (preferredKey && preferredKey <= latest && eligible(preferredKey) && isOpen(preferredKey)) picks.push(preferredKey);
  for (let i = 1; i <= CONFIG.LOOKAHEAD_DAYS && picks.length < CONFIG.MAX_OFFERS; i++) {
    const key = addDays(today, i);
    if (!picks.includes(key) && eligible(key) && isOpen(key)) picks.push(key);
  }
  return picks.slice(0, CONFIG.MAX_OFFERS);
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

function buildText(first, windowPicked, powerPicked, days) {
  const body = services => {
    const open = days.length === 0 ? null : days.length === 1
      ? `We have ${fmtDay(days[0])} open with an ${CONFIG.ARRIVAL_WINDOW} arrival. Would that work for you? `
      : `We have ${fmtDay(days[0])} or ${fmtDay(days[1])} open with an ${CONFIG.ARRIVAL_WINDOW} arrival. Would either of those work for you? `;
    return `Hi ${first}, thanks for reaching out to CleanzATX! We just got your request for ${services}. ` +
      (open ? `${open}Tyler will reach out shortly with your price.` : 'Tyler will reach out shortly with your price and available dates.');
  };
  const options = serviceSummaries(windowPicked, powerPicked).map(body);
  return options.find(t => t.length <= CONFIG.TEXT_MAX_CHARS) || options[options.length - 1];
}

// ───────────── Rotor lead notes ─────────────
function buildNotes(f, windowPicked, powerPicked, offerLine) {
  const lines = [];
  if (offerLine) lines.push(offerLine, '');
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

  // 1. Schedule → open mornings (only needed when we're about to text)
  let days = [];
  if (willText) {
    const preferredKey = f.timeline === 'specific_date' ? parseDayKey(f.preferred_date) : '';
    const sched = await rotorUpcomingJobs(rotorKey, now, new Date(now.getTime() + CONFIG.SCHEDULE_FETCH_DAYS * 86400000));
    if (sched.ok) {
      const big = isBigJob({ windowPicked, powerPicked, sqft: Number(f.sqft) || 0, stories: Number(f.stories) || 0 });
      days = pickOpenDays({ now, jobs: sched.jobs, big, preferredKey });
    } else {
      console.error('rotor_schedule_failed', sched.status, sched.code);
    }
  }
  const offer = days.length ? `${days.map(d => fmtDay(d, false)).join(' or ')}, ${CONFIG.ARRIVAL_WINDOW}` : '';

  // 2. Lead in Rotor
  const tags = ['website-quote'];
  if (windowPicked.length) tags.push('window-cleaning');
  if (powerPicked.length) tags.push('power-washing');
  tags.push('sms-consent');   // the form notice: submitting = OK to call/text about the quote
  const offerLine = !willText ? 'No welcome text was sent (texting not set up, or already texted in the last few minutes). Follow up by text or call.'
    : offer ? `Texted offer: ${offer}` : 'Texted welcome (no open mornings offered; send price and dates).';
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
    notes: buildNotes(f, windowPicked, powerPicked, offerLine),
  };
  const rotor = await rotorUpsert(rotorKey, lead);
  if (!rotor.ok) console.error('rotor_lead_failed', rotor.status, rotor.code);

  // 3. Welcome text
  if (willText) {
    const sent = await quoSend(quoKey, quoFrom, phone, buildText(safeFirstName(first), windowPicked, powerPicked, days));
    if (!sent.ok) {
      recentTexts.delete(phone);
      console.error('quo_text_failed', sent.status, sent.code);
    }
    if (rotor.ok) {
      // Re-send the full lead by id: tags merge, notes reflect what actually happened
      const update = sent.ok
        ? { ...lead, tags: [...tags, 'texted-welcome', ...(offer ? ['offered-dates'] : [])] }
        : { ...lead, notes: buildNotes(f, windowPicked, powerPicked, 'Welcome text FAILED to send' + (offer ? ` (would have offered ${offer})` : '') + '. Call or text them.') };
      const tagged = await rotorUpsert(rotorKey, { ...(rotor.id ? { id: rotor.id } : {}), ...update });
      if (!tagged.ok) console.error('rotor_update_failed', tagged.status, tagged.code);
    }
  }

  return rotor.ok ? send(res, 200, { ok: true }) : send(res, 502, { ok: false });
}

module.exports = handler;
module.exports._test = { CONFIG, clock, recentTexts, pickOpenDays, isBigJob, buildText, buildNotes, toE164, safeFirstName, parseDayKey, localParts };
