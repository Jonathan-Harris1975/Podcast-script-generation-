import express from "express";

const router = express.Router();

function val(v) { return v === undefined || v === null ? "" : String(v); }

function stripSpeak(ssml) {
  const s = val(ssml).trim();
  return s.replace(/^<\s*speak[^>]*>/i, "").replace(/<\/\s*speak\s*>$/i, "").trim();
}

function normaliseToArray(input) {
  if (Array.isArray(input)) return input.map(item => normaliseToArray(item)).flat();
  if (typeof input === "object" && input && ("ssml" in input)) return [val(input.ssml)];
  if (typeof input === "string") return [input];
  if (input === undefined || input === null) return [];
  return [String(input)];
}

function buildPlainFromSsml(ssml) {
  return val(ssml)
    .replace(/<break[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(src, keys) {
  for (const k of keys) {
    if (src && src[k] !== undefined) return src[k];
  }
  return undefined;
}

function parseBodyOrQuery(req) {
  let src = {};
  if (req.body && typeof req.body === "object") src = req.body;
  else if (req.query && Object.keys(req.query).length) src = req.query;
  else if (typeof req.body === "string") {
    try { src = JSON.parse(req.body); } catch { src = { main: String(req.body) }; }
  }
  return src;
}

router.post("/ready-for-tts", async (req, res) => {
  try {
    const src = parseBodyOrQuery(req);
    const debugFlag = String((src["debug"] ?? "")).toLowerCase() === "true";

    const introIn = src["intro"] ?? src["introSsml"];
    const mainIn = src["main"] ?? src["mainSsml"];
    const chunksIn = src["mainChunks"] ?? src["chunks"];
    const outroIn = src["outro"] ?? src["outroSsml"];
    const name = src["name"] ?? src["voice"] ?? src["voiceName"] ?? "en-GB-Wavenet-B";
    const r2Prefix = src["r2Prefix"] ?? src["R2_PREFIX"] ?? "podcast";

    const parts = [
      ...normaliseToArray(introIn),
      ...normaliseToArray(mainIn),
      ...normaliseToArray(chunksIn),
      ...normaliseToArray(outroIn),
    ].map(stripSpeak).filter(Boolean);

    if (parts.length === 0) {
      return res.status(400).json({
        error: "No content after normalisation",
        diagnostics: {
          sourceKeysPresent: Object.keys(src || {}),
          lengths: {
            intro: val(introIn).length, main: val(mainIn).length,
            chunks: Array.isArray(chunksIn) ? chunksIn.length : (chunksIn ? 1 : 0),
            outro: val(outroIn).length
          }
        }
      });
    }

    const joined = parts.join(' <break time="700ms"/>' + ' ');
    const ssml = `<speak>${joined}</speak>`;
    const plain = buildPlainFromSsml(ssml);

    const payload = {
      endpoint: "/tts/chunked",
      body: {
        text: ssml,
        voice: { languageCode: "en-GB", name },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
        R2_PREFIX: r2Prefix
      }
    };

    const out = {
      transcript: { plain, ssml },
      tts_maker: payload
    };

    if (debugFlag) {
      out.debug = {
        source: (req.body && typeof req.body === "object") ? "body" :
                (req.query && Object.keys(req.query).length ? "query" :
                (typeof req.body === "string" ? "raw" : "unknown")),
        partCount: parts.length,
        lengths: parts.map(p => p.length)
      };
    }

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;