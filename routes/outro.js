const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { openai } = require('../services/openai');

router.post('/', async (req, res) => {
  try {
    const booksPath = path.join(__dirname, '../data/books.json');
    const books = JSON.parse(fs.readFileSync(booksPath, 'utf-8'));

    const book = books[Math.floor(Math.random() * books.length)];
    const userPrompt = req.body.prompt;

    const fallbackPrompt = `Write a confident, witty podcast outro promoting {{book_title}} ({{book_url}}) in a British Gen X tone.`;

    const ssmlInstructions = ` Use SSML with <say-as interpret-as="characters">A I</say-as>, <emphasis>, and <break> tags. Output must be wrapped in <speak>...</speak>, JSON-safe, single-line, and under 600 characters.`;

    const finalPrompt = (userPrompt || fallbackPrompt)
      .replace('{{book_title}}', book.title)
      .replace('{{book_url}}', book.url)
      + ssmlInstructions;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.8
    });

    const ssml = completion.choices[0].message.content.trim();
    res.json({ ssml });
  } catch (err) {
    console.error('Outro generation failed:', err);
    res.status(500).json({ error: 'Outro generation error' });
  }
});

module.exports = router;
