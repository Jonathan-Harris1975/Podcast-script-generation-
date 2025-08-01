const express = require('express');
const app = express();

const introRoute = require('./routes/intro');
const mainRoute = require('./routes/main');
const outroRoute = require('./routes/outro');

app.use(express.json());

// Health check
app.get('/', (_req, res) => res.json({ ok: true, service: 'ssml-podcast-api' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/intro', introRoute);
app.use('/main', mainRoute);
app.use('/outro', outroRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
