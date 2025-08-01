const express = require('express');
const app = express();

const outroRoute = require('./routes/outro');
const introRoute = require('./routes/intro');

app.use(express.json());

// simple health checks
app.get('/', (_req, res) => res.json({ ok: true, service: 'ssml-podcast-api' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/outro', outroRoute);
app.use('/intro', introRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
