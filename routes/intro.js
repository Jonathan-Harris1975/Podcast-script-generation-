const express = require('express');
const fs = require('fs');
const path = require('path');
const { openai } = require('../services/openai');
const { getWeatherSummary } = require('../services/weather');
const router = express.Router();

function oneLine(s){return String(s||'').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim();}
function ensureSpeak(ssml){const s=oneLine(ssml);return /^<speak>.*<\/speak>$/.test(s)?s:`<speak>${s}</speak>`;}
function getRandomQuote(){
  const p = path.join(__dirname,'..','quotes.txt');
  const raw = fs.readFileSync(p,'utf-8');
  const quotes = raw.split('\n').map(x=>x.trim()).filter(Boolean);
  return quotes[Math.floor(Math.random()*quotes.length)];
}

router.post('/', async (req,res)=>{
  try{
    const date = req.body?.date || new Date().toISOString().split('T')[0];
    const weatherSummary = await getWeatherSummary(date);
    const quote = getRandomQuote();

    const userPrompt = req.body?.prompt || `Write a short, confident podcast intro for "Turing's Torch: AI Weekly". Mention the UK weather: "${weatherSummary}". Weave in this Turing quote: "${quote}". Keep it brisk and charismatic.`;
    const ssmlRules = ' Use SSML. Wrap the entire response with <speak>...</speak>. Say "AI" as <say-as interpret-as="characters">A I</say-as>. Use <emphasis> and natural <break> tags. Output must be JSON-safe, single line (no raw newlines), and under 700 characters. Return ONLY the SSML — no JSON keys like speech or intro.';
    const finalPrompt = `${userPrompt} ${ssmlRules}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.7
    });

    let content = (completion.choices?.[0]?.message?.content || '').trim();
    if (/^\s*{/.test(content)) {
      try{
        const parsed = JSON.parse(content);
        content = parsed.ssml || parsed.speech || parsed.intro || content;
      }catch{}
    }
    const ssml = ensureSpeak(content);
    res.json({ ssml: oneLine(ssml) });
  }catch(err){
    console.error('Intro generation failed:', err);
    res.status(500).json({ error:'Failed to generate intro', details: err.message });
  }
});

module.exports = router;
