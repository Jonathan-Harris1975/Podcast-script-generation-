const express = require('express');
const router = express.Router();
const { openai } = require('../services/openai');
const { XMLParser } = require('fast-xml-parser');

// ---------- helpers ----------
async function fetchRssItems(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RSS fetch ${res.status}: ${text}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const data = parser.parse(xml);
  const channel = data?.rss?.channel || data?.feed;
  let items = [];
  if (channel?.item) items = Array.isArray(channel.item) ? channel.item : [channel.item];
  else if (channel?.entry) items = Array.isArray(channel.entry) ? channel.entry : [channel.entry];

  return items.map(i => ({
    title: i.title?.text || i.title || '',
    description: i.description?.text || i.summary?.text || i.summary || i.content?.text || i.content || '',
    url: i.link?.href || i.link || '',
    pubDate: i.pubDate || i.updated || i.published || ''
  }));
}

function withinAge(pubDate, maxAgeDays) {
  if (!maxAgeDays) return true;
  const d = new Date(pubDate || 0);
  if (isNaN(d.getTime())) return true;
  return (Date.now() - d.getTime()) <= maxAgeDays * 86400 * 1000;
}

function oneLine(s) {
  return String(s || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function ensureSpeak(ssml) {
  const s = oneLine(ssml);
  return /^<speak>.*<\/speak>$/.test(s) ? s : `<speak>${s}</speak>`;
}

// ---------- POST /main (generate chunks) ----------
router.post('/', async (req, res) => {
  try {
    const { rssFeedUrl, maxItems, maxAgeDays, prompt, temperature } = req.body || {};
    let stories = [];

    // Case 1: RSS
    if (rssFeedUrl) {
      const all = await fetchRssItems(rssFeedUrl);
      const filtered = all.filter(i => withinAge(i.pubDate, maxAgeDays || 0));
      const limited = (maxItems && Number(maxItems) > 0) ? filtered.slice(0, Number(maxItems)) : filtered.slice(0, 6);
      stories = limited.map(i => {
        const title = (i.title || '').trim();
        const desc = (i.description || '').replace(/<[^>]+>/g, '').trim();
        const url = (i.url || '').trim();
        return [title, desc, url].filter(Boolean).join(' — ');
      }).filter(Boolean);
    }

    // Case 2: Direct arrays
    if (!stories.length && Array.isArray(req.body?.stories) && req.body.stories.length) {
      stories = req.body.stories.map(s => String(s).trim()).filter(Boolean);
    }
    if (!stories.length && Array.isArray(req.body?.articles) && req.body.articles.length) {
      stories = req.body.articles.map(a => {
        const title = (a.title || '').trim();
        const desc  = (a.description || a.summary || '').trim();
        const url   = (a.url || a.link || '').trim();
        return [title, desc, url].filter(Boolean).join(' — ');
      }).filter(Boolean);
    }

    // Case 3: Raw text split
    if (!stories.length && typeof req.body?.text === 'string') {
      const delim = (req.body.delimiter && String(req.body.delimiter)) || '\n\n';
      stories = String(req.body.text).split(delim).map(s => s.trim()).filter(Boolean);
    }

    if (!stories.length) {
      return res.status(400).json({ error: 'No stories found. Provide {"rssFeedUrl": "..."} or {"stories":[...]} or {"articles":[...]} or {"text":"..."}' });
    }

    const userPrompt = prompt || 'Rewrite each item into a podcast segment. Tone: British Gen X, confident, dry wit. Each segment should sound natural and flow.';
    const temp = (typeof temperature === 'number') ? temperature : 0.8;

    const ssmlRules = ' For each item, produce one SSML chunk. Wrap with <speak>...</speak>. Say "AI" as <say-as interpret-as="characters">A I</say-as>. Use <emphasis> and <break time="600ms"/> naturally. Each chunk must be JSON-safe, single-line (no raw newlines), and under 4800 characters. Output ONLY the chunks, one per line.';

    const finalPrompt = userPrompt + ssmlRules + '\n\nItems:\n- ' + stories.join('\n- ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: temp
    });

    const raw = completion.choices[0].message.content.trim();

    // Cleanup array-looking output like ["...","..."]
    const cleaned = raw
      .replace(/^\[+/, '')
      .replace(/\]+$/, '')
      .replace(/\\"/g, '"')
      .replace(/",\s*"/g, '\n');

    const lines = cleaned.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    const chunks = lines.map(line => line.replace(/^\s*"|"\s*$/g, '').trim());

    res.json({ chunks });
  } catch (err) {
    console.error('Main generation failed:', err);
    res.status(500).json({ error: 'Main generation error', details: err.message });
  }
});

// ---------- POST /main/merge (stitch chunks -> one <speak>..</speak>) ----------
router.post('/merge', async (req, res) => {
  try {
    let chunks = [];
    // Accept either clean chunks array or a string blob
    if (Array.isArray(req.body?.chunks) && req.body.chunks.length) {
      chunks = req.body.chunks.map(s => oneLine(s)).filter(Boolean);
    } else if (typeof req.body?.text === 'string') {
      // Split on speak blocks if provided as a single text
      const matches = req.body.text.match(/<speak>[\s\S]*?<\/speak>/g) || [];
      chunks = matches.map(oneLine);
    } else {
      return res.status(400).json({ error: 'Provide {"chunks":[ "<speak>..</speak>", ... ]} or {"text":"<speak>..</speak>..."}' });
    }

    if (!chunks.length) {
      return res.status(400).json({ error: 'No chunks to merge' });
    }

    // Strip <speak> wrappers and concatenate with pauses
    const bodies = chunks.map(c => oneLine(c).replace(/^<speak>/, '').replace(/<\/speak>$/, ''));
    // Slightly longer pause between segments; adjust as you like
    const mergedBody = bodies.join(' <break time="700ms"/> ');

    const final = ensureSpeak(mergedBody);
    res.json({ ssml: final });
  } catch (err) {
    console.error('Main merge failed:', err);
    res.status(500).json({ error: 'Main merge error', details: err.message });
  }
});

module.exports = router;  if (!maxAgeDays) return true;
  const d = new Date(pubDate || 0);
  if (isNaN(d.getTime())) return true; // keep if no date
  const now = new Date();
  const ageMs = now - d;
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

// POST /main
router.post('/', async (req, res) => {
  try {
    const { rssFeedUrl, maxItems, maxAgeDays, prompt, temperature } = req.body || {};

    let stories = [];

    if (rssFeedUrl) {
      const all = await fetchRssItems(rssFeedUrl);
      const filtered = all.filter(i => withinAge(i.pubDate, maxAgeDays || 0));
      const limited = (maxItems && Number(maxItems) > 0) ? filtered.slice(0, Number(maxItems)) : filtered.slice(0, 6);
      stories = limited.map(i => {
        const title = (i.title || '').trim();
        const desc = (i.description || '').replace(/<[^>]+>/g, '').trim();
        const url = (i.url || '').trim();
        return [title, desc, url].filter(Boolean).join(' — ');
      }).filter(Boolean);
    }

    // Fallbacks if caller sends direct data
    if (!stories.length && Array.isArray(req.body?.stories) && req.body.stories.length) {
      stories = req.body.stories.map(s => String(s).trim()).filter(Boolean);
    }
    if (!stories.length && Array.isArray(req.body?.articles) && req.body.articles.length) {
      stories = req.body.articles.map(a => {
        const title = (a.title || '').trim();
        const desc  = (a.description || a.summary || '').trim();
        const url   = (a.url || a.link || '').trim();
        return [title, desc, url].filter(Boolean).join(' — ');
      }).filter(Boolean);
    }
    if (!stories.length && typeof req.body?.text === 'string') {
      const delim = (req.body.delimiter && String(req.body.delimiter)) || '\n\n';
      stories = String(req.body.text).split(delim).map(s => s.trim()).filter(Boolean);
    }

    if (!stories.length) {
      return res.status(400).json({ error: 'No stories found. Provide {"rssFeedUrl": "..."} or {"stories":[...]} or {"articles":[...]} or {"text":"...", "delimiter":"---"}' });
    }

    const userPrompt = prompt || 'Rewrite each item into a podcast segment. Tone: British Gen X, confident, dry wit. Each segment should sound natural and flow.';
    const temp = (typeof temperature === 'number') ? temperature : 0.8;

    const ssmlRules = ' For each item, produce one SSML chunk. Wrap with <speak>...</speak>. Say "AI" as <say-as interpret-as="characters">A I</say-as>. Use <emphasis> and <break time="600ms"/> naturally. Each chunk must be JSON-safe, single-line (no raw newlines), and under 4800 characters. Output ONLY the chunks, one per line.';

    const finalPrompt = userPrompt + ssmlRules + '\n\nItems:\n- ' + stories.join('\n- ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: temp
    });

    const raw = completion.choices[0].message.content.trim();
    const lines = raw.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    const chunks = lines.map(line => line.replace(/\s+/g, ' ').trim());

    res.json({ chunks });
  } catch (err) {
    console.error('Main generation failed:', err);
    res.status(500).json({ error: 'Main generation error', details: err.message });
  }
});

module.exports = router;
