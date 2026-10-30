// Vercel serverless function: sends a website quote request to Rotor as a lead.
//
// The quote form (main.js) posts here in the background, alongside the EmailJS
// email. The visitor's confirmation never waits on this, so a Rotor outage only
// shows up in the logs: Vercel dashboard > cleanz-atx > Logs, search "[quote-lead]".
//
// Setup: add ROTOR_API_KEY in Vercel > cleanz-atx > Settings > Environment
// Variables (Production, and Preview if you test on previews). See .env.example.
// Rotor updates an existing lead when the email or phone matches, so a repeat
// submission refreshes that lead instead of creating a duplicate.

const ROTOR_URL = 'https://api.getrotor.com/open-api/leads';
const ROTOR_API_VERSION = '1.1.0';
const ROTOR_TIMEOUT_MS = 8000;

// Trim, flatten line breaks, and cap length so one field can't flood the notes
function clean(value, max = 300) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

// "2026-11-05" -> "11/5/2026"; anything else passes through cleaned
function formatDate(value) {
  const v = clean(value, 20);
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${+m[2]}/${+m[3]}/${m[1]}` : v;
}

function submissionDate() {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago', month: 'numeric', day: 'numeric', year: 'numeric',
  });
}

function buildNotes(f) {
  const services = Array.isArray(f.services) ? f.services.map(s => clean(s, 60)).filter(Boolean).join(', ') : clean(f.services);
  const foundUs = clean(f.referral) + (clean(f.referrer) ? ` (${clean(f.referrer)})` : '');
  return [
    `Website quote request ${submissionDate()}`,
    `OK to text: ${f.sms_consent === true || f.sms_consent === 'Yes' ? 'Yes' : 'No'}`,
    `Services requested: ${services}`,
    `Frequency: ${clean(f.frequency)}`,
    `Timeline: ${clean(f.timeline)}`,
    `Target date: ${formatDate(f.target_date)}`,
    `Last serviced: ${clean(f.last_serviced)}`,
    `Property type: ${clean(f.property_type)}`,
    `Square footage: ${clean(f.sqft, 12)}`,
    `Stories: ${clean(f.stories, 4)}`,
    `How they found us: ${foundUs}`,
    `Customer notes: ${clean(f.notes, 1000)}`,
  ].join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  let f = req.body;
  if (typeof f === 'string') { try { f = JSON.parse(f); } catch (e) { f = null; } }
  if (!f || typeof f !== 'object') return res.status(400).json({ ok: false });

  // Same minimum the form itself enforces: a name and a 10 digit phone
  const name = clean(f.name, 120);
  const phone = clean(f.phone, 30);
  if (!name || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ ok: false });
  }

  const apiKey = process.env.ROTOR_API_KEY;
  if (!apiKey) {
    console.error('[quote-lead] ROTOR_API_KEY is not set; lead not sent to Rotor for', name);
    return res.status(500).json({ ok: false });
  }

  const lead = {
    name,
    email: clean(f.email, 200),
    phone,
    lead_source: 'Website quote form',
    location: clean(f.address, 300),
    notes: buildNotes(f),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROTOR_TIMEOUT_MS);
  try {
    const r = await fetch(ROTOR_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'rotor-api-version': ROTOR_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lead),
      signal: controller.signal,
    });
    if (!r.ok) {
      const detail = (await r.text().catch(() => '')).slice(0, 500);
      console.error(`[quote-lead] Rotor returned ${r.status} for ${name}: ${detail}`);
      return res.status(502).json({ ok: false });
    }
    console.log(`[quote-lead] Rotor lead sent for ${name} (${r.status})`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[quote-lead] Rotor request failed for ${name}: ${err && err.name === 'AbortError' ? 'timed out' : err && err.message}`);
    return res.status(502).json({ ok: false });
  } finally {
    clearTimeout(timer);
  }
};
