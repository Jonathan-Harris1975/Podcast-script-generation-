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

    const userPrompt = req.body.prompt || "";
    const safePrompt = userPrompt
      .replace(/{{weather_summary}}/g, weatherSummary)
      .replace(/{{quote}}/g, quote);

    const systemPrompt = `
You are an API voice assistant that generates SSML podcast intros.
Strict rules: Never return markdown, JSON, or commentary.
Only return a raw <speak>...</speak> SSML string with no line breaks or formatting.
Output must be under 1800 characters, valid SSML, and ready for TTS.
`.trim();

    const response = await openai.chat.completions.create({
      model: process.env.MODEL || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: safePrompt }
      ],
      temperature: 0.7
    });

    const ssml = response.choices[0].message.content.trim();
    res.json({ ssml });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate intro', details: err.message });
  }
});

export default router;