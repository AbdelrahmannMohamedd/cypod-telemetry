// cypod-telemetry
const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { listActiveAlerts } = require('../controllers/alertController');

const router = express.Router();

router.use(requireAuth);
router.get('/', asyncHandler(listActiveAlerts));

module.exports = router;
