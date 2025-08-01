const express = require('express');
const app = express();

const outroRoute = require('./routes/outro');
const introRoute = require('./routes/intro');

app.use(express.json());
app.use('/outro', outroRoute);
app.use('/intro', introRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
