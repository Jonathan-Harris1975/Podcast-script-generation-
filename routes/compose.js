// routes/compose.js
const express = require('express');
const router = express.Router();

/* ---------- helpers ---------- */
const oneLine = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
const stripSpeak = (s) => String(s ?? '').replace(/^<speak>/i, '').replace(/<\/speak>$/i, '');
const ensureSpeak = (s) => {
  const t = oneLine(s);
  return /^<speak>[\s\S]*<\/speak>$/.test(t) ? t : `<speak>${t}</speak>`;
};

const normaliseToArray = (val) => {
  if (val == null) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const maybe = val.trim();
    if ((maybe.startsWith('[') && maybe.endsWith(']')) || (maybe.startsWith('{') && maybe.endsWith('}'))) {
      try {
        const parsed = JSON.parse(maybe);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch { /* ignore */ }
    }
    return [val];
  }
  return [val];
};

const toPlain = (ssml) => stripSpeak(oneLine(ssml)).replace(/<break[^>]*>/g, ' ').trim();

/* ---------- core ---------- */
router.post('/ready-for-tts', (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    const intro = normaliseToArray(body.intro);
    const main = normaliseToArray(body.main);
    const mainChunks = normaliseToArray(body.mainChunks);
    const outro = normaliseToArray(body.outro);

    const contentChunks = (mainChunks.length ? mainChunks : main).map(x => {
      const s = typeof x === 'string' ? x : String(x ?? '');
      return /^<speak>[\s\S]*<\/speak>$/.test(s) ? stripSpeak(s) : oneLine(s);
    }).filter(Boolean);

    const introStr = intro.map(x => /^<speak>[\s\S]*<\/speak>$/.test(String(x)) ? stripSpeak(String(x)) : oneLine(String(x))).join(' ');
    const outroStr = outro.map(x => /^<speak>[\s\S]*<\/speak>$/.test(String(x)) ? stripSpeak(String(x)) : oneLine(String(x))).join(' ');

    const spacer = '<break time="700ms"/>';
    const sections = [];
    if (introStr) sections.push(introStr);
    if (contentChunks.length) sections.push(contentChunks.join(` ${spacer} `));
    if (outroStr) sections.push(outroStr);

    const mergedInner = sections.join(` ${spacer} `);
    const ssml = ensureSpeak(mergedInner);
    const plain = toPlain(ssml);

    const voiceName = body.name || body.voiceName || 'en-GB-Wavenet-B';
    const voice = body.voice || { languageCode: 'en-GB', name: voiceName };
    const audioConfig = body.audioConfig || { audioEncoding: 'MP3', speakingRate: 1.0 };
    const r2Prefix = body.r2Prefix || body.R2_PREFIX || 'podcast';

    const response = {
      transcript: { plain, ssml },
      tts_maker: {
        endpoint: '/tts/chunked',
        body: { text: ssml, voice, audioConfig, R2_PREFIX: r2Prefix }
      }
    };

    res.json(response);
  } catch (e) {
    res.status(400).json({ error: 'Invalid input', details: e?.message || String(e) });
  }
});

router.post('/ready-for-tts/debug', (req, res) => {
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch {}
  const typeOf = (x) => Array.isArray(x) ? 'array' : typeof x;
  res.json({
    introType: typeOf(body?.intro),
    mainType: typeOf(body?.main),
    mainChunksType: typeOf(body?.mainChunks),
    outroType: typeOf(body?.outro),
  });
});

module.exports = router;
