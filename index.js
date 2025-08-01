const express = require('express');
const app = express();
const outroRoute = require('./routes/outro');

app.use(express.json());
app.use('/outro', outroRoute);

app.listen(3000, () => console.log('Server running on port 3000'));
