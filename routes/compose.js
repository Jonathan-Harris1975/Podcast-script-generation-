// routes/compose.js
const express = require('express');
const router = express.Router();

/* ---------- helpers ---------- */
const oneLine = s => String(s || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
const ensureSpeak = s => {
  const t = oneLine(s);
  return /^<speak>[\s\S]*<\/speak>$/.test(t) ? t : `<speak>${t}</speak>`;
};
const unwrap = s => oneLine(s).replace(/^<speak>/, '').replace(/<\/speak>$/, '');

function coerce(val) {
  if (val == null) return '';
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const t = val.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try { return JSON.parse(t); } catch { /* ignore */ }
    }
    return val;
  }
  return val;
}

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
 * Accepts JSON or stringified JSON body, or query params.
 * Required: intro, main (or mainChunks), outro
 * Optional: name (Google TTS voice name, default en-GB-Wavenet-B)
 *
 * Responds:
 * {
 *   ssml: "<speak>...</speak>",
 *   tts: {
 *     input: { ssml: "<speak>...</speak>" },
 *     voice: { languageCode: "en-GB", name, ssmlGender: "MALE" },
 *     audioConfig: { audioEncoding: "MP3" }
 *   }
 * }
 */
router.post('/', express.text({ type: '*/*', limit: '1mb' }), (req, res) => {
  try {
    let payload = {};
    if (req.is('application/json') && typeof req.body === 'object') {
      payload = req.body;
    } else if (typeof req.body === 'string' && req.body.trim()) {
      try { payload = JSON.parse(req.body); } catch { /* leave empty */ }
    }
    if (!Object.keys(payload).length) payload = { ...req.query };

    const intro = payload.intro;
    const mainInput = payload.main ?? payload.mainChunks;
    const outro = payload.outro;
    const voiceName = payload.name || 'en-GB-Wavenet-B';

    if (!intro || !mainInput || !outro) {
      return res.status(400).json({
        error: 'Provide intro, main (or mainChunks), and outro. Optional: name (voice).'
      });
    }

    const merged = [
      unwrap(normaliseToSingle(intro)),
      '<break time="700ms"/>',
      unwrap(normaliseToSingle(mainInput)),
      '<break time="700ms"/>',
      unwrap(normaliseToSingle(outro))
    ].join(' ');

    const ssml = ensureSpeak(merged);

    return res.json({
      ssml,
      tts: {
        input: { ssml },
        voice: {
          languageCode: 'en-GB',
          name: voiceName,
          ssmlGender: 'MALE'
        },
        audioConfig: { audioEncoding: 'MP3' }
      }
    });
  } catch (err) {
    console.error('Compose failed:', err);
    return res.status(500).json({ error: 'Compose error', details: err.message });
  }
});

/* Optional: debug endpoint */
router.post('/debug', express.text({ type: '*/*' }), (req, res) => {
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { body = {}; }
  const t = x => Array.isArray(x) ? 'array' : typeof x;
  res.json({
    rawType: typeof req.body,
    introType: t(body?.intro ?? req.query?.intro),
    mainType: t(body?.main ?? req.query?.main),
    mainChunksType: t(body?.mainChunks ?? req.query?.mainChunks),
    outroType: t(body?.outro ?? req.query?.outro),
    name: (body?.name ?? req.query?.name) || '(default en-GB-Wavenet-B)'
  });
});

module.exports = router;// Optional: quick type checker for debugging
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
