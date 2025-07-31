import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import bodyParser from 'body-parser';
import { fetchFeedSummaries } from './fetchFeed.js';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Health check endpoints
app.get('/', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Main generation endpoint
app.post('/generate', async (req, res) => {
  try {
    const { rssFeedUrl, prompt, temperature, maxItems = 20, maxAgeDays = 7 } = req.body;
    
    // Input validation
    if (!rssFeedUrl) {
      return res.status(400).json({ error: 'Missing required parameter: rssFeedUrl' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'Missing required parameter: prompt' });
    }

    // Fetch and process feed
    const feedSummaries = await fetchFeedSummaries(rssFeedUrl, maxItems, maxAgeDays);
    const inputText = feedSummaries.join('\n');

    // Generate completion
    const completion = await openai.chat.completions.create({
      model: process.env.MODEL || 'gpt-4-1106-preview',
      messages: [{ 
        role: 'user', 
        content: `${prompt}\n${inputText}` 
      }],
      temperature: temperature || 0.75,
    });

    const output = completion.choices[0].message.content;
    res.json({ chunks: [output] });
    
  } catch (err) {
    console.error('Generation failed:', err);
    const statusCode = err.response?.status || 500;
    res.status(statusCode).json({ 
      error: err.message || 'Unknown error',
      ...(err.response?.data && { details: err.response.data })
    });
  }
});
app.get('/env-check', (req, res) => {
  const keys = Object.keys(process.env);
  const visibleEnv = keys.reduce((acc, key) => {
    if (key.includes('OPENAI') || key.includes('RENDER')) {
      acc[key] = process.env[key];
    }
    return acc;
  }, {});
  res.json(visibleEnv);
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Using model: ${process.env.MODEL || 'gpt-4-1106-preview'}`);
});
