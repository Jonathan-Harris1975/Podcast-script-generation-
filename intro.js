import express from 'express';
import fs from 'fs';
import { getWeatherSummary } from '../services/weather.js';
import { OpenAI } from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getRandomQuote = () => {
  const quotes = fs.readFileSync('./quotes.txt', 'utf-8').split('\n').filter(Boolean);
  return quotes[Math.floor(Math.random() * quotes.length)];
};

router.post('/generate-intro', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const weatherSummary = await getWeatherSummary(date);
    const quote = getRandomQuote();

    const prompt = `
Create a podcast intro using SSML. Tone: dry British Gen X. 
Begin with a weather-related joke or sarcastic opener based on this: "${weatherSummary}".
Then introduce the AI podcast casually.
Seamlessly embed this Alan Turing quote: "${quote}"
Use <break time=\"600ms\"/> for pacing.
Wrap everything in <speak> tags. Output must be JSON-safe, under 1800 characters, and ready for voice use.
`.trim();

    const response = await openai.chat.completions.create({
      model: process.env.MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    const ssml = response.choices[0].message.content;
    res.json({ ssml });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate intro' });
  }
});

export default router;