// cypod-telemetry

const { LATEST_CACHE_TTL_MS } = require('../config/constants');

const store = new Map(); // deviceId -> { value, expiresAt }

function get(deviceId) {
  const entry = store.get(deviceId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(deviceId);
    return null;
  }
  return entry.value;
}

function set(deviceId, value) {
  store.set(deviceId, { value, expiresAt: Date.now() + LATEST_CACHE_TTL_MS });
}

// Only overwrite if this reading is at least as new (by recorded_at) as whatever's
// currently cached. Guards against ingestTelemetryBatch (offline-buffer replay) clobbering
// a live device's current cached state with an older, just-arrived historical reading.
function setIfNewer(deviceId, value) {
  const current = store.get(deviceId);
  if (!current || new Date(value.recorded_at) >= new Date(current.value.recorded_at)) {
    set(deviceId, value);
  }
}

function invalidate(deviceId) {
  store.delete(deviceId);
}

module.exports = { get, set, setIfNewer, invalidate };