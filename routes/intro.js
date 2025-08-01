const express = require('express');
const fs = require('fs');
const path = require('path');
const { openai } = require('../services/openai');
const { getWeatherSummary } = require('../services/weather');

const router = express.Router();

function getRandomQuote() {
  const p = path.join(__dirname, '..', 'quotes.txt');
  const raw = fs.readFileSync(p, 'utf-8');
  const quotes = raw.split('\n').map(s => s.trim()).filter(Boolean);
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// POST /intro
router.post('/', async (req, res) => {
  try {
    const date = (req.body && req.body.date) ? req.body.date : new Date().toISOString().split('T')[0];
    const weatherSummary = await getWeatherSummary(date);
    const quote = getRandomQuote();

    const userPrompt = (req.body && req.body.prompt)
      ? req.body.prompt
      : `Write a short, confident podcast intro for "Turing's Torch: AI Weekly". Include a witty nod to UK weather: "${weatherSummary}". Weave in this Alan Turing quote: "${quote}". Keep pacing brisk and charismatic.`;

    const ssmlRules = ' Use SSML. Wrap output with <speak>...</speak>. Say "AI" as <say-as interpret-as="characters">A I</say-as>. Include natural <emphasis> and <break> tags. Output must be JSON-safe, a single line (no raw newlines), and under 700 characters.';

    const finalPrompt = userPrompt + ssmlRules;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.7
    });

    const ssml = completion.choices[0].message.content.trim();
    res.json({ ssml });
  } catch (err) {
    console.error('Intro generation failed:', err);
    res.status(500).json({ error: 'Failed to generate intro', details: err.message });
  }
});

module.exports = router;
