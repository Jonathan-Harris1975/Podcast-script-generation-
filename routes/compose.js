const express = require('express');
const router = express.Router();

const oneLine = s => String(s || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
const ensureSpeak = s => {
  const t = oneLine(s);
  return /^<speak>.*<\/speak>$/.test(t) ? t : `<speak>${t}</speak>`;
};
const unwrap = s => oneLine(s).replace(/^<speak>/, '').replace(/<\/speak>$/, '');

/**
 * Normalise an input that can be:
 * - a single SSML string ("<speak>…</speak>")
 * - a plain string ("…")
 * - an array of SSML chunks (["<speak>…</speak>", ...])
 * Returns a single SSML string with segments joined by <break time="700ms"/>.
 */
function normaliseToSingle(input) {
  if (Array.isArray(input)) {
    // Treat each as a speak block or plain text
    const bodies = input
      .map(x => typeof x === 'string' ? x : String(x))
      .map(x => /<speak>[\s\S]*<\/speak>/.test(x) ? unwrap(x) : oneLine(x))
      .filter(Boolean);
    return ensureSpeak(bodies.join(' <break time="700ms"/> '));
  }
  if (typeof input === 'string') {
    // If it's already a speak block, keep; else wrap
    return ensureSpeak(input);
  }
  return '';
}

/**
 * POST /compose
 * Accepts:
 *   - { intro: "<speak>…</speak>", main: "<speak>…</speak>", outro: "<speak>…</speak>" }
 *   - { intro: "<speak>…</speak>", mainChunks: ["<speak>…</speak>", ...], outro: "<speak>…</speak>" }
 * Returns:
 *   - { ssml: "<speak>…full merged…</speak>" }
 */
router.post('/', (req, res) => {
  try {
    const { intro, main, mainChunks, outro } = req.body || {};

    if (!intro || (!main && !Array.isArray(mainChunks)) || !outro) {
      return res.status(400).json({
        error:
          'Provide { intro, main, outro } as SSML strings OR { intro, mainChunks:[…], outro }.'
      });
    }

    const introOne = normaliseToSingle(intro);
    const mainOne  = main ? normaliseToSingle(main) : normaliseToSingle(mainChunks);
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

module.exports = router;
