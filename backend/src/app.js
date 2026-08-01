// cypod-telemetry
const express = require('express');
const cors = require('cors');
const { i18nMiddleware } = require('./i18n');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const devicesRoutes = require('./routes/devices.routes');
const alertsRoutes = require('./routes/alerts.routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(i18nMiddleware);

  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/auth', authRoutes);
  app.use('/devices', devicesRoutes);
  app.use('/alerts', alertsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
