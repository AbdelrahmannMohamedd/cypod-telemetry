// cypod-telemetry
const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { createDevice, listDevices } = require('../controllers/deviceController');
const telemetryRoutes = require('./telemetry.routes');

const router = express.Router();

router.use(requireAuth);

router.post('/', asyncHandler(createDevice));
router.get('/', asyncHandler(listDevices));

// Nested telemetry/history/latest routes: /devices/:id/telemetry, /devices/:id/latest, etc.
router.use('/:id', telemetryRoutes);

module.exports = router;
