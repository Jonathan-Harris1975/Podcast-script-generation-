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
      try { return JSON.parse(t); } catch { /* ignore parse errors */ }
    }
    return val;
  }
  return val;
}

function normaliseToSingle(input) {
  const v = coerce(input);

  // Array of SSML/text → join with a spacer break
  if (Array.isArray(v)) {
    const bodies = v
      .map(x => typeof x === 'string' ? x : String(x))
      .map(x => /<speak>[\s\S]*<\/speak>/.test(x) ? unwrap(x) : oneLine(x))
      .filter(Boolean);
    return ensureSpeak(bodies.join(' <break time="700ms"/> '));
  }

  // { chunks: [...] } shape
  if (typeof v === 'object' && v && Array.isArray(v.chunks)) {
    return normaliseToSingle(v.chunks);
  }

  // Plain string
  if (typeof v === 'string') {
    return ensureSpeak(v);
  }

  return '';
}

/**
 * POST /compose
 * Body may be JSON or stringified JSON. Query params also accepted.
 * Required: intro, main (or mainChunks), outro
 * Optional: name (Google TTS voice; default en-GB-Wavenet-B)
 */
router.post('/', express.text({ type: '*/*', limit: '1mb' }), (req, res) => {
  try {
    let payload = {};
    if (req.is('application/json') && typeof req.body === 'object') {
      payload = req.body;
    } else if (typeof req.body === 'string' && req.body.trim()) {
      try { payload = JSON.parse(req.body); } catch { /* leave empty if not JSON */ }
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

    const mergedBody = [
      unwrap(normaliseToSingle(intro)),
      '<break time="700ms"/>',
      unwrap(normaliseToSingle(mainInput)),
      '<break time="700ms"/>',
      unwrap(normaliseToSingle(outro))
    ].join(' ');

    const ssml = ensureSpeak(mergedBody);

    const ttsPayload = {
      input: { ssml },
      voice: { languageCode: 'en-GB', name: voiceName, ssmlGender: 'MALE' },
      audioConfig: { audioEncoding: 'MP3' }
    };

    return res.json({
      ssml,
      tts: ttsPayload,
      "TTS output complete": ttsPayload,
      "TTS output complete (string)": JSON.stringify(ttsPayload)
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


/* ---------- new: /compose/ready-for-tts ---------- */
/**
 * Input shape (any of these can be provided as strings, arrays, or already-wrapped):
 * { "intro": "<speak>..</speak>" | "text", "main": "...", "mainChunks": ["<speak>..</speak>", ...], "outro": "..." , "name": "en-GB-Wavenet-B", "r2Prefix": "raw-YYYYMMDD"}
 *
 * Output:
 * {
 *   "transcript": { "plain": "...", "ssml": "<speak>..</speak>" },
 *   "tts_maker": {
 *     "endpoint": "/tts/chunked",
 *     "body": { "text": "<speak>..</speak>", "voice": {...}, "audioConfig": {...}, "R2_PREFIX": "..." }
 *   }
 * }
 */
const stripSsmlToText = (ssml) => {
  const s = String(ssml || '');
  let t = s.replace(/^<speak>/i,'').replace(/<\/speak>$/i,'');
  t = t.replace(/<break[^>]*>/gi, ' ');
  t = t.replace(/<say-as[^>]*interpret-as="characters"[^>]*>([\s\S]*?)<\/say-as>/gi, (_, inner) => inner.replace(/\s+/g,''));
  t = t.replace(/<[^>]+>/g, '');
  return t.replace(/\s+/g, ' ').trim();
};

router.post('/ready-for-tts', express.json({ limit: '1mb' }), async (req, res) => {
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = body?.name || process.env.VOICE_NAME || 'en-GB-Wavenet-B';
    const voiceName = String(name);
    const intro = normaliseToSingle(body?.intro ?? req.query?.intro);
    const main = normaliseToSingle(body?.main ?? req.query?.main);
    const mainChunks = normaliseToArray(body?.mainChunks ?? req.query?.mainChunks);
    const outro = normaliseToSingle(body?.outro ?? req.query?.outro);

    const introBody = unwrap(ensureSpeak(intro));
    const mainBody = mainChunks.length
      ? mainChunks.map(c => unwrap(ensureSpeak(c))).join(' <break time="700ms"/> ')
      : unwrap(ensureSpeak(main));
    const outroBody = unwrap(ensureSpeak(outro));

    const mergedBody = [introBody, mainBody, outroBody].filter(Boolean).join(' <break time="900ms"/> ');
    const ssml = ensureSpeak(mergedBody);
    const plain = stripSsmlToText(ssml);

    const r2Prefix = body?.r2Prefix || process.env.R2_PREFIX || 'podcast';
    const ttsBody = {
      text: ssml,
      voice: { languageCode: 'en-GB', name: voiceName },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
      R2_PREFIX: r2Prefix
    };

    return res.json({
      transcript: { plain, ssml },
      tts_maker: {
        endpoint: '/tts/chunked',
        body: ttsBody
      }
    });
  }catch(err){
    console.error('ready-for-tts failed:', err);
    return res.status(400).json({ error: 'Invalid input', details: err.message });
  }
});


module.exports = router;
