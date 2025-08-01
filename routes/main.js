const express = require('express');
const router = express.Router();
const { openai } = require('../services/openai');

// POST /main
router.post('/', async (req, res) => {
  try {
    const stories = req.body?.stories || []; // array of text blocks
    if (!Array.isArray(stories) || stories.length === 0) {
      return res.status(400).json({ error: 'Missing stories array' });
    }

    const userPrompt = req.body?.prompt || 
      'Rewrite the provided news summaries as SSML podcast chunks in a British Gen X tone. Use dry wit, sarcasm, and confident delivery. Each chunk should last 45–120 seconds.';

    const ssmlRules = ' Use SSML. Wrap each chunk with <speak>...</speak>. Say "AI" as <say-as interpret-as="characters">A I</say-as>. Add <break time="600ms"/> between stories. Output must be JSON-safe, one line per chunk, each under 4800 characters.';

    const finalPrompt = userPrompt + ssmlRules + '\\nStories:\\n' + stories.join('\\n\\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.8
    });

    const output = completion.choices[0].message.content.trim();
    res.json({ ssml: output });
  } catch (err) {
    console.error('Main generation failed:', err);
    res.status(500).json({ error: 'Main generation error', details: err.message });
  }
});

module.exports = router;
