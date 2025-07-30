import express from 'express';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fetchFeedSummaries from './fetchFeed.js';
import splitSSML from './splitSSML.js';

dotenv.config();

const app = express();
app.use(express.json());
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/generate', async (req, res) => {
  const { rssFeedUrl, prompt, temperature = 0.7 } = req.body;
  if (!rssFeedUrl || !prompt) return res.status(400).json({ error: "rssFeedUrl and prompt are required" });

  try {
    const summaries = await fetchFeedSummaries(rssFeedUrl);
    const joined = summaries.join("\n\n");
    const filledPrompt = prompt.replace('{{summaries}}', joined);

    const completion = await openai.chat.completions.create({
      model: process.env.MODEL,
      temperature,
      messages: [{ role: 'user', content: filledPrompt }]
    });

    const rawSSML = completion.choices[0].message.content;
    const chunks = splitSSML(rawSSML);

    res.json({ chunks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Generation failed" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Listening on port ${port}`));