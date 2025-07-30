import express from 'express';
import fs from 'fs';
import { OpenAI } from 'openai';
import fetchFeedSummaries from './fetchFeed.js';
import splitSSML from './splitSSML.js';

const app = express();
app.use(express.json());

const openAIKeyPath = '/etc/secrets/OPENAI_API_KEY';
let openAIKey = process.env.OPENAI_API_KEY;

if (!openAIKey && fs.existsSync(openAIKeyPath)) {
  openAIKey = fs.readFileSync(openAIKeyPath, 'utf8').trim();
}

const openai = new OpenAI({ apiKey: openAIKey });

app.post('/generate', async (req, res) => {
  const { rssFeedUrl, prompt, temperature = 0.7 } = req.body;
  if (!rssFeedUrl || !prompt) return res.status(400).json({ error: "rssFeedUrl and prompt are required" });

  try {
    const summaries = await fetchFeedSummaries(rssFeedUrl);
    const joined = summaries.join("\n\n");
    const filledPrompt = prompt.replace('{{summaries}}', joined);

    const completion = await openai.chat.completions.create({
      model: process.env.MODEL || 'gpt-4-1106-preview',
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