// cypod-telemetry
// A per-device sliding-window rate limiter, in memory.

// Crucially: the window is keyed on *when the server received the request* (Date.now()),
// never on the "timestamp" field inside the payload. That's what makes this compatible
// with the offline-buffering requirement in README section 6 -- a device replaying 40
// historical readings still only makes ONE http request to the live endpoint (or none, if
// it uses the batch endpoint below), so it can never itself look like 40 requests/minute.

const hits = new Map(); // deviceId -> array of request timestamps (ms), single-reading endpoint
const batchHits = new Map(); // deviceId -> array of request timestamps (ms), batch endpoint

function pruneAndCount(map, key, windowMs, now) {
  const arr = (map.get(key) || []).filter((t) => now - t < windowMs);
  map.set(key, arr);
  return arr;
}

function makeDeviceRateLimiter({ map, windowMs, maxPerWindow, errorCode }) {
  const { ApiError } = require('../utils/ApiError');
  return function deviceRateLimiter(req, res, next) {
    const deviceId = req.params.id;
    const now = Date.now();
    const recent = pruneAndCount(map, deviceId, windowMs, now);

    if (recent.length >= maxPerWindow) {
      throw new ApiError(429, errorCode);
    }

    recent.push(now);
    map.set(deviceId, recent);
    next();
  };
}

const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_PER_WINDOW, BATCH_RATE_LIMIT_WINDOW_MS, BATCH_RATE_LIMIT_MAX_PER_WINDOW } = require('../config/constants');

const singleReadingRateLimiter = makeDeviceRateLimiter({
  map: hits,
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxPerWindow: RATE_LIMIT_MAX_PER_WINDOW,
  errorCode: 'RATE_LIMIT_EXCEEDED',
});

const batchRateLimiter = makeDeviceRateLimiter({
  map: batchHits,
  windowMs: BATCH_RATE_LIMIT_WINDOW_MS,
  maxPerWindow: BATCH_RATE_LIMIT_MAX_PER_WINDOW,
  errorCode: 'BATCH_RATE_LIMIT_EXCEEDED',
});

// Exposed for tests that need to reset state between cases.
function _resetForTests() {
  hits.clear();
  batchHits.clear();
}

module.exports = { singleReadingRateLimiter, batchRateLimiter, _resetForTests };
