const express = require('express');
const app = express();

const introRoute = require('./routes/intro');
const mainRoute = require('./routes/main');
const outroRoute = require('./routes/outro');
const composeRoute = require('./routes/compose');

app.use(express.json());

app.get('/', (_req, res) => res.json({ ok: true, service: 'ssml-podcast-api' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/intro', introRoute);
app.use('/main', mainRoute);
app.use('/outro', outroRoute);
app.use('/compose', composeRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
