const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { openai } = require('../services/openai');

function oneLine(s) {
  return String(s || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mustWrapSpeak(ssml) {
  const s = oneLine(ssml);
  if (/^<speak>.*<\/speak>$/.test(s)) return s;
  return `<speak>${s}</speak>`;
}

router.post('/', async (req, res) => {
  try {
    // Load books
    const booksPath = path.join(__dirname, '../data/books.json');
    const books = JSON.parse(fs.readFileSync(booksPath, 'utf-8'));
    const book = books[Math.floor(Math.random() * books.length)];

    const sponsorLine = `This episode was brought to you by ${book.title}, available at ${book.url}.`;

    // Minimal user prompt (optional)
    const userPrompt = (req.body && req.body.prompt)
      ? String(req.body.prompt)
      : `Write a confident, witty podcast outro for "Turing's Torch: AI Weekly" in a British Gen X tone. Mention that new episodes drop every Friday and nudge listeners to jonathan-harris.online for the newsletter and more ebooks.`;

    // Hard SSML rules + sponsor constraint
    const ssmlInstructions =
      ` Use SSML. Wrap the entire response with <speak>...</speak>. Say "AI" as <say-as interpret-as="characters">A I</say-as>. ` +
      `Include this exact sponsor line verbatim somewhere natural in the outro: "${sponsorLine}" ` +
      `(do not alter the text, do not wrap the URL in <say-as>). ` +
      `Use <emphasis> and natural <break> tags. Output must be JSON-safe, a single line (no raw newlines), and under 600 characters. ` +
      `Return ONLY the SSML, no JSON.`;

    const finalPrompt = `${userPrompt} ${ssmlInstructions}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.8
    });

    let content = (completion.choices?.[0]?.message?.content || '').trim();

    // If the model returned JSON, try to parse and extract ssml/outro
    let ssml = '';
    if (/^\s*{/.test(content)) {
      try {
        const parsed = JSON.parse(content);
        ssml = parsed.ssml || parsed.outro || parsed.data || '';
      } catch {
        // not valid JSON, fall through
      }
    }
    if (!ssml) ssml = content;

    // Normalise to one line and ensure <speak> wrapper
    ssml = mustWrapSpeak(ssml);

    // Ensure sponsor mention is present (verbatim check without case sensitivity)
    const hasSponsor = ssml.toLowerCase().includes(sponsorLine.toLowerCase());
    if (!hasSponsor) {
      // insert right after opening <speak>
      ssml = ssml.replace(
        /^<speak>/,
        `<speak>${sponsorLine} <break time="400ms"/> `
      );
    }

    // Final JSON-safe, single line
    ssml = oneLine(ssml);

    res.json({ ssml });
  } catch (err) {
    console.error('Outro generation failed:', err);
    res.status(500).json({ error: 'Outro generation error', details: err.message });
  }
});

module.exports = router;
