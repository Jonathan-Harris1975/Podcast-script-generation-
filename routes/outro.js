const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { openai } = require('../services/openai');

function oneLine(s){ return String(s||'').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim(); }
function mustWrapSpeak(ssml){ const s=oneLine(ssml); return /^<speak>.*<\/speak>$/.test(s)?s:`<speak>${s}</speak>`; }

router.post('/', async (req,res)=>{
  try{
    const booksPath = path.join(__dirname,'..','data','books.json');
    const books = JSON.parse(fs.readFileSync(booksPath,'utf-8'));
    const book = books[Math.floor(Math.random()*books.length)];
    const sponsorLine = `This episode was brought to you by ${book.title}, available at ${book.url}.`;

    const userPrompt = (req.body && req.body.prompt)
      ? String(req.body.prompt)
      : `Write a confident, witty podcast outro for "Turing's Torch: AI Weekly" in a British Gen X tone. Mention that new episodes drop every Friday and nudge listeners to jonathan-harris.online for the newsletter and more ebooks.`;

    const ssmlInstructions = ' Use SSML with <say-as interpret-as="characters">A I</say-as>, <emphasis>, and <break> tags. Wrap with <speak>...</speak>. Include this exact sponsor line verbatim somewhere natural: "'+sponsorLine+'". JSON-safe, single line, under 600 characters. Return ONLY SSML.';
    const finalPrompt = `${userPrompt} ${ssmlInstructions}`;

    const completion = await openai.chat.completions.create({
      model:'gpt-4o-mini',
      messages:[{ role:'user', content: finalPrompt }],
      temperature: 0.8
    });

    let content = (completion.choices?.[0]?.message?.content || '').trim();
    if(/^\s*{/.test(content)){
      try{ const parsed = JSON.parse(content); content = parsed.ssml || parsed.outro || content; } catch{}
    }
    let ssml = mustWrapSpeak(content);
    if(!ssml.toLowerCase().includes(sponsorLine.toLowerCase())){
      ssml = ssml.replace(/^<speak>/, `<speak>${sponsorLine} <break time="400ms"/> `);
    }
    res.json({ ssml: oneLine(ssml) });
  }catch(err){
    console.error('Outro generation failed:', err);
    res.status(500).json({ error:'Outro generation error', details: err.message });
  }
});

module.exports = router;
