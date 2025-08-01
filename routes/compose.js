const express = require('express');
const router = express.Router();

// Helpers
const oneLine = s => String(s || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
const ensureSpeak = s => {
  const t = oneLine(s);
  return /^<speak>.*<\/speak>$/.test(t) ? t : `<speak>${t}</speak>`;
};
const unwrap = s => oneLine(s).replace(/^<speak>/, '').replace(/<\/speak>$/, '');

// Try to coerce unknown input into a JS value (string or array)
function coerce(val) {
  if (val == null) return '';
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // If it looks like JSON, try parse
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { return JSON.parse(trimmed); } catch { /* fall through */ }
    }
    return val;
  }
  return val;
}

// Normalise to a single SSML block
function normaliseToSingle(input) {
  const v = coerce(input);
  if (Array.isArray(v)) {
    const bodies = v
      .map(x => typeof x === 'string' ? x : String(x))
      .map(x => /<speak>[\s\S]*<\/speak>/.test(x) ? unwrap(x) : oneLine(x))
      .filter(Boolean);
    return ensureSpeak(bodies.join(' <break time="700ms"/> '));
  }
  if (typeof v === 'object' && v && Array.isArray(v.chunks)) {
    return normaliseToSingle(v.chunks);
  }
  if (typeof v === 'string') {
    return ensureSpeak(v);
  }
  return '';
}

/**
 * POST /compose
 * Accepts:
 *   JSON body, or a stringified JSON body, or query params.
 * Fields:
 *   - intro: string
 *   - main: string OR array (or object with {chunks:[]})
 *   - mainChunks: array OR stringified array
 *   - outro: string
 */
router.post('/', express.text({ type: '*/*', limit: '1mb' }), (req, res) => {
  try {
    let payload = {};
    // Prefer JSON already parsed by express.json(); otherwise try to parse text; else use query
    if (req.is('application/json') && typeof req.body === 'object') {
      payload = req.body;
    } else if (typeof req.body === 'string' && req.body.trim()) {
      try { payload = JSON.parse(req.body); } catch { /* not JSON, ignore */ }
    }
    if (!Object.keys(payload).length) {
      payload = { ...req.query };
    }

    const intro = payload.intro;
    const mainInput = payload.main ?? payload.mainChunks;
    const outro = payload.outro;

    if (!intro || !mainInput || !outro) {
      return res.status(400).json({
        error:
          'Provide intro, main (or mainChunks), and outro. Body may be JSON, stringified JSON, or query params.'
      });
    }

    const introOne = normaliseToSingle(intro);
    const mainOne  = normaliseToSingle(mainInput);
    const outroOne = normaliseToSingle(outro);

    const mergedBody = [
      unwrap(introOne),
      '<break time="700ms"/>',
      unwrap(mainOne),
      '<break time="700ms"/>',
      unwrap(outroOne)
    ].join(' ');

    return res.json({ ssml: ensureSpeak(mergedBody) });
  } catch (err) {
    console.error('Compose failed:', err);
    return res.status(500).json({ error: 'Compose error', details: err.message });
  }
});

// Optional: quick type checker for debugging
router.post('/debug', express.text({ type: '*/*' }), (req, res) => {
  const body = (req.is('application/json') && typeof req.body === 'object') ? req.body : (() => {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  })();
  const t = x => Array.isArray(x) ? 'array' : typeof x;
  res.json({
    rawType: typeof req.body,
    introType: t(body.intro ?? req.query.intro),
    mainType: t(body.main ?? req.query.main),
    mainChunksType: t(body.mainChunks ?? req.query.mainChunks),
    outroType: t(body.outro ?? req.query.outro)
  });
});

module.exports = router;
