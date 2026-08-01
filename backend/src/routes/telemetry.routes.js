// cypod-telemetry
const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { singleReadingRateLimiter, batchRateLimiter } = require('../middleware/rateLimit');
const { ingestTelemetry, ingestTelemetryBatch, getLatest, getHistory } = require('../controllers/telemetryController');

// mergeParams so :id from the parent /devices/:id mount is visible here as req.params.id
const router = express.Router({ mergeParams: true });

router.post('/telemetry', singleReadingRateLimiter, asyncHandler(ingestTelemetry));
router.post('/telemetry/batch', batchRateLimiter, asyncHandler(ingestTelemetryBatch));
router.get('/latest', asyncHandler(getLatest));
router.get('/history', asyncHandler(getHistory));

module.exports = router;
