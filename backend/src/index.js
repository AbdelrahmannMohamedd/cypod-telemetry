// cypod-telemetry
require('dotenv').config();
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`cypod-telemetry backend listening on http://localhost:${PORT}`);
});
