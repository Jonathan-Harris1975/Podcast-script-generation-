import express from "express";
const router = express.Router();

const stripSpeak = s =>
  String(s || "")
    .replace(/^\s*<speak[^>]*>/i, "")
    .replace(/<\/speak>\s*$/i, "")
    .trim();

const asArray = v =>
  v == null ? [] :
  Array.isArray(v) ? v :
  typeof v === "object" && "ssml" in v ? [v.ssml] :
  [String(v)];

function readInputs(req) {
  // priority: body → query → raw
  const src = req.body && Object.keys(req.body).length ? "body"
           : (req.query && Object.keys(req.query).length ? "query" : "raw");

  const get = k => (src === "body" ? req.body[k] : src === "query" ? req.query[k] : undefined);

  let intro = get("intro") ?? get("introSsml");
  let main  = get("main")  ?? get("mainSsml");
  let mainChunks = get("mainChunks");
  let outro = get("outro") ?? get("outroSsml");

  if (!intro && !main && !mainChunks && !outro && src === "raw" && typeof req.body === "string") {
    main = req.body;
  }

  const name = get("name") || "en-GB-Wavenet-B";
  const r2Prefix = get("r2Prefix") || "podcast";

  const parts = [
    ...asArray(intro),
    ...(Array.isArray(mainChunks) ? mainChunks : asArray(main)),
    ...asArray(outro),
  ].map(stripSpeak).filter(Boolean);

  return { parts, name, r2Prefix, source: src };
}

router.post("/ready-for-tts", (req, res) => {
  try {
    const { parts, name, r2Prefix, source } = readInputs(req);
    if (!parts.length) {
      return res.status(400).json({
        error: "No input text detected",
        diagnostics: { source, bodyKeys: Object.keys(req.body || {}), queryKeys: Object.keys(req.query || {}) }
      });
    }
    const joined = parts.join(' <break time="700ms"/> ');
    const ssml = `<speak>${joined}</speak>`;
    const plain = joined.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    return res.json({
      transcript: { plain, ssml },
      tts_maker: {
        endpoint: "/tts/chunked",
        body: {
          text: ssml,
          voice: { languageCode: "en-GB", name },
          audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
          R2_PREFIX: r2Prefix
        }
      }
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;  if (req.body && typeof req.body === "object") src = req.body;
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
