import express from "express";

const router = express.Router();

function isString(v) { return typeof v === "string"; }
function isObject(v) { return v && typeof v === "object" && !Array.isArray(v); }

function stripSpeak(ssml) {
  const s = String(ssml || "").trim();
  const m = s.match(/^<speak[^>]*>([\s\S]*?)<\/speak>$/i);
  return m ? m[1].trim() : s;
}

function unwrapOne(v) {
  if (v == null) return "";
  if (isString(v)) return String(v);
  if (Array.isArray(v)) {
    return v.map(unwrapOne).filter(Boolean).join(" ");
  }
  if (isObject(v)) {
    if (isString(v.ssml)) return v.ssml;
    if (isString(v.text)) return v.text;
  }
  return String(v);
}

function normaliseToArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function toPlain(ssml) {
  // very simple tag strip
  return String(ssml).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildSsml({ intro, main, mainChunks, outro }) {
  const parts = [];
  for (const v of normaliseToArray(intro)) {
    const s = stripSpeak(unwrapOne(v));
    if (s) parts.push(s);
  }
  if (mainChunks && Array.isArray(mainChunks)) {
    for (const v of mainChunks) {
      const s = stripSpeak(unwrapOne(v));
      if (s) parts.push(s);
    }
  } else {
    for (const v of normaliseToArray(main)) {
      const s = stripSpeak(unwrapOne(v));
      if (s) parts.push(s);
    }
  }
  for (const v of normaliseToArray(outro)) {
    const s = stripSpeak(unwrapOne(v));
    if (s) parts.push(s);
  }
  const core = parts.join(' <break time="700ms"/>');
  return `<speak>${core}</speak>`;
}

router.post("/ready-for-tts", async (req, res) => {
  try {
    const body = req.body || {};
    // Accept multiple key variants to be forgiving
    const intro = body.intro ?? body.introSsml ?? body.intro_ssml;
    const main = body.main ?? body.body ?? body.content ?? body.mainSsml ?? body.main_ssml;
    const mainChunks = body.mainChunks ?? body.chunks ?? body.stories ?? body.parts;
    const outro = body.outro ?? body.outroSsml ?? body.outro_ssml;

    const ssml = buildSsml({ intro, main, mainChunks, outro });
    const plain = toPlain(ssml);

    // Build TTS-maker payload
    const name = body.name || "en-GB-Wavenet-B";
    const languageCode = body.languageCode || "en-GB";
    const speakingRate = body.speakingRate || 1.0;
    const audioEncoding = body.audioEncoding || "MP3";
    const R2_PREFIX = body.r2Prefix || body.R2_PREFIX || "podcast";

    // If nothing meaningful, raise 400 with diagnostics
    const meaningful = ssml.replace(/<[^>]+>/g, "").trim().length > 0;
    if (!meaningful) {
      return res.status(400).json({
        error: "No content after normalisation",
        diagnostics: {
          receivedKeys: Object.keys(body),
          introPreview: String(unwrapOne(intro)).slice(0,120),
          mainPreview: String(unwrapOne(main)).slice(0,120),
          chunksCount: Array.isArray(mainChunks) ? mainChunks.length : 0,
          outroPreview: String(unwrapOne(outro)).slice(0,120)
        }
      });
    }

    return res.json({
      transcript: { plain, ssml },
      tts_maker: {
        endpoint: "/tts/chunked",
        body: {
          text: ssml,
          voice: { languageCode, name },
          audioConfig: { audioEncoding, speakingRate },
          R2_PREFIX
        }
      }
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;