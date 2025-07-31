import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import { fetchFeedSummaries } from './fetchFeed.js';

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

app.post('/generate', async (req, res) => {
  try {
    const { rssFeedUrl, prompt, temperature = 0.7, maxItems = 10 } = req.body;
    const stories = await fetchFeedSummaries(rssFeedUrl, maxItems);

    const content = stories.map(
      story => `${story.title}

${story.summary}`
    ).join('\n\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [{ role: 'user', content: `${prompt}\n\n${content}` }],
      temperature,
    });

    const result = completion.choices[0].message.content.trim();

    res.json({ chunks: [result] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate podcast script' });
  }
});

app.listen(port, () => {
  console.log(`✅ Listening on port ${port}`);
});
