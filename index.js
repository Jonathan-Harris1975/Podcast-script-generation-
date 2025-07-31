import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import bodyParser from 'body-parser';
import fetchFeedSummaries from './fetchFeed.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env?.OPENAI_API_KEY || '',
});

app.post('/generate', async (req, res) => {
  try {
    const { rssFeedUrl, prompt, temperature, maxItems = 20, maxAgeDays = 7 } = req.body;

    const feedSummaries = await fetchFeedSummaries(rssFeedUrl, maxItems, maxAgeDays);
    const inputText = feedSummaries.join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: `${prompt}\n${inputText}` }],
      temperature: temperature || 0.75,
    });

    const output = completion.choices[0].message.content;
    res.json({ chunks: [output] });
  } catch (err) {
    console.error('Generation failed:', err);
    res.status(500).send({ error: err.message || 'Unknown error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
