const express = require('express');
const router = express.Router();
const { openai } = require('../services/openai');
const { XMLParser } = require('fast-xml-parser');

async function fetchRssItems(url){
  const res = await fetch(url, { method:'GET' });
  if(!res.ok){ const text = await res.text(); throw new Error(`RSS fetch ${res.status}: ${text}`); }
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes:false, trimValues:true });
  const data = parser.parse(xml);
  const channel = data?.rss?.channel || data?.feed;
  let items=[];
  if(channel?.item) items = Array.isArray(channel.item)?channel.item:[channel.item];
  else if(channel?.entry) items = Array.isArray(channel.entry)?channel.entry:[channel.entry];
  return items.map(i=>({ title:i?.title?.text||i?.title||'', description:i?.description?.text||i?.summary?.text||i?.summary||i?.content?.text||i?.content||'', url:i?.link?.href||i?.link||'', pubDate:i?.pubDate||i?.updated||i?.published||'' }));
}
function withinAge(pubDate,maxAgeDays){ if(!maxAgeDays) return true; const d=new Date(pubDate||0); if(isNaN(d.getTime())) return true; return (Date.now()-d.getTime())<=maxAgeDays*86400*1000; }
function oneLine(s){ return String(s||'').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim(); }
function ensureSpeak(ssml){ const s=oneLine(ssml); return /^<speak>.*<\/speak>$/.test(s)?s:`<speak>${s}</speak>`; }
function extractSpeakChunks(raw){
  if(!raw) return [];
  if(/^\s*[\[{]/.test(raw)){
    try{ const parsed = JSON.parse(raw); if(Array.isArray(parsed)) return parsed.map(String); if(Array.isArray(parsed?.chunks)) return parsed.chunks.map(String); if(typeof parsed?.ssml==='string') return [parsed.ssml]; }
    catch{ try{ const parsed2 = JSON.parse(raw.replace(/\\"/g,'"')); if(Array.isArray(parsed2)) return parsed2.map(String); if(Array.isArray(parsed2?.chunks)) return parsed2.chunks.map(String); if(typeof parsed2?.ssml==='string') return [parsed2.ssml]; } catch{} }
  }
  const matches = raw.match(/<speak>[\s\S]*?<\/speak>/g);
  if(matches?.length) return matches;
  const cleaned = raw.replace(/^\s*\[\s*/,'').replace(/\s*\]\s*$/,'').replace(/\\"/g,'"').replace(/",\s*"/g,'\n').replace(/^\s*"|"\s*$/gm,'');
  return cleaned.split(/\r?\n+/).map(s=>s.trim()).filter(Boolean);
}

router.post('/', async (req,res)=>{
  try{
    const { rssFeedUrl, maxItems, maxAgeDays, prompt, temperature, return: returnMode } = req.body || {};
    let stories = [];

    if(rssFeedUrl){
      const all = await fetchRssItems(rssFeedUrl);
      const filtered = all.filter(i=>withinAge(i.pubDate, maxAgeDays||0));
      const limited = (maxItems&&Number(maxItems)>0)?filtered.slice(0,Number(maxItems)):filtered.slice(0,6);
      stories = limited.map(i=>[ (i.title||'').trim(), (i.description||'').replace(/<[^>]+>/g,'').trim(), (i.url||'').trim() ].filter(Boolean).join(' — ')).filter(Boolean);
    }
    if(!stories.length && Array.isArray(req.body?.stories)&&req.body.stories.length){
      stories = req.body.stories.map(s=>String(s).trim()).filter(Boolean);
    }
    if(!stories.length && Array.isArray(req.body?.articles)&&req.body.articles.length){
      stories = req.body.articles.map(a=>[ (a.title||'').trim(), (a.description||a.summary||'').trim(), (a.url||a.link||'').trim() ].filter(Boolean).join(' — ')).filter(Boolean);
    }
    if(!stories.length && typeof req.body?.text==='string'){
      const delim = (req.body.delimiter && String(req.body.delimiter)) || '\n\n';
      stories = String(req.body.text).split(delim).map(s=>s.trim()).filter(Boolean);
    }
    if(!stories.length){
      return res.status(400).json({ error:'No stories found. Provide {"rssFeedUrl": "..."} or {"stories":[...]} or {"articles":[...]} or {"text":"..."}' });
    }

    const userPrompt = prompt || 'Rewrite each item into a podcast segment. Tone: British Gen X, confident, dry wit. Each segment should sound natural and flow.';
    const temp = (typeof temperature==='number')?temperature:0.8;
    const ssmlRules = ' For each item, produce one SSML chunk. Wrap with <speak>...</speak>. Say "AI" as <say-as interpret-as="characters">A I</say-as>. Use <emphasis> and <break time="600ms"/> naturally. Each chunk must be JSON-safe, single-line (no raw newlines), and under 4800 characters. Output ONLY the SSML chunks, one per line. Do NOT output JSON, arrays, brackets, or quotes.';
    const finalPrompt = userPrompt + ssmlRules + '\n\nItems:\n- ' + stories.join('\n- ');

    const completion = await openai.chat.completions.create({
      model:'gpt-4o-mini',
      messages:[{ role:'user', content: finalPrompt }],
      temperature: temp
    });
    const raw = (completion.choices?.[0]?.message?.content || '').trim();
    const extracted = extractSpeakChunks(raw).map(oneLine).map(ensureSpeak).filter(Boolean);

    if(returnMode==='merged'){
      const bodies = extracted.map(c=>c.replace(/^<speak>/,'').replace(/<\/speak>$/,''));
      const merged = `<speak>${bodies.join(' <break time="700ms"/> ')}</speak>`;
      return res.json({ ssml: merged });
    }
    return res.json({ chunks: extracted });
  }catch(err){
    console.error('Main generation failed:', err);
    res.status(500).json({ error:'Main generation error', details: err.message });
  }
});

router.post('/merge', (req,res)=>{
  try{
    const body = req.body || {};
    let chunks = [];
    if(Array.isArray(body.chunks)&&body.chunks.length){
      chunks = body.chunks.map(oneLine).filter(Boolean);
    } else if (typeof body.text === 'string'){
      const matches = body.text.match(/<speak>[\s\S]*?<\/speak>/g) || [];
      chunks = matches.map(oneLine);
    } else {
      return res.status(400).json({ error:'Provide {"chunks":[ "<speak>..</speak>", ... ]} or {"text":"<speak>..</speak>..."}' });
    }
    if(!chunks.length) return res.status(400).json({ error:'No chunks to merge' });
    const bodies = chunks.map(c=>oneLine(c).replace(/^<speak>/,'').replace(/<\/speak>$/,''));
    const mergedBody = bodies.join(' <break time="700ms"/> ');
    const final = `<speak>${oneLine(mergedBody)}</speak>`;
    res.json({ ssml: final });
  }catch(err){
    console.error('Main merge failed:', err);
    res.status(500).json({ error:'Main merge error', details: err.message });
  }
});

module.exports = router;
