// cypod-telemetry
const { pool } = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const { getOwnedDeviceOrThrow } = require('./deviceController');
const { validateTelemetryPayload } = require('../utils/telemetryValidator');
const { insertReading, evaluateAlerts } = require('../services/telemetryService');
const { BATCH_MAX_READINGS, HISTORY_DEFAULT_PAGE_SIZE, HISTORY_MAX_PAGE_SIZE } = require('../config/constants');
const latestCache = require('../cache/latestCache');

// POST /devices/:id/telemetry -- the live, "device is online right now" path.
// Subject to the 10-readings/minute limiter (see middleware/rateLimit.js).
async function ingestTelemetry(req, res) {
  const device = await getOwnedDeviceOrThrow(req.params.id, req.user.id);
  const reading = validateTelemetryPayload(req.body || {});

  const stored = await insertReading(device.id, reading);
  const alerts = stored ? await evaluateAlerts(device.id, reading) : [];


  res.status(201).json({
    stored: Boolean(stored),
    reading: stored || null,
    alerts,
  });
}

// POST /devices/:id/telemetry/batch -- the "device just reconnected and is flushing what
// it buffered while offline" path. See README section 6 for the full reasoning: each
// reading here carries its own original recorded_at, and the whole array arrives as a
// single HTTP request, so it never collides with the per-minute limiter above no matter
// how many readings it contains (bounded by BATCH_MAX_READINGS ).
async function ingestTelemetryBatch(req, res) {
  const device = await getOwnedDeviceOrThrow(req.params.id, req.user.id);
  const { readings } = req.body || {};

  if (!Array.isArray(readings) || readings.length === 0) {
    throw new ApiError(422, 'BATCH_EMPTY');
  }
  if (readings.length > BATCH_MAX_READINGS) {
    throw new ApiError(422, 'BATCH_TOO_LARGE', { max: BATCH_MAX_READINGS });
  }

  // Validate every reading before storing any of them -- a batch is one logical unit from
  // the device's point of view, so we don't want to half-apply it if reading #37 is bad.
  const validated = readings.map((r) => validateTelemetryPayload(r));

  const results = [];
  for (const reading of validated) {
    const stored = await insertReading(device.id, reading);
    const alerts = stored ? await evaluateAlerts(device.id, reading) : [];
    results.push({ stored: Boolean(stored), recorded_at: reading.recordedAt, alerts });
  }

  res.status(201).json({
    accepted: results.length,
    stored: results.filter((r) => r.stored).length,
    duplicates: results.filter((r) => !r.stored).length,
    results,
  });
}


// GET /devices/:id/latest -- cache-aside. HIT returns straight from memory; MISS falls
// back to Postgres and repopulates the cache before responding
async function getLatest(req, res) {
  const device = await getOwnedDeviceOrThrow(req.params.id, req.user.id);

  const cached = latestCache.get(device.id);
  if (cached) {
    console.log(`[cache] HIT  device=${device.id}`);
    return res.status(200).json({ latest: cached });
  }
  console.log(`[cache] MISS device=${device.id}`);

  const result = await pool.query(
    `SELECT device_id, battery, temperature, lat, lng, status, recorded_at, received_at
     FROM telemetry WHERE device_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
    [device.id],
  );
  if (result.rows.length === 0) {
    return res.status(200).json({ latest: null });
  }

  const latest = result.rows[0];
  latestCache.set(device.id, latest);
  res.status(200).json({ latest });
}

// GET /devices/:id/history?from=&to=&page=&pageSize=
async function getHistory(req, res) {
  const device = await getOwnedDeviceOrThrow(req.params.id, req.user.id);
  const { from, to } = req.query;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(HISTORY_MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize, 10) || HISTORY_DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions = ['device_id = $1'];
  const params = [device.id];

  if (from) {
    const fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) throw new ApiError(422, 'FIELD_INVALID_TIMESTAMP', { field: 'from' });
    params.push(fromDate);
    conditions.push(`recorded_at >= $${params.length}`);
  }
  if (to) {
    const toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) throw new ApiError(422, 'FIELD_INVALID_TIMESTAMP', { field: 'to' });
    params.push(toDate);
    conditions.push(`recorded_at <= $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM telemetry WHERE ${where}`, params);
  const total = countResult.rows[0].total;

  params.push(pageSize, offset);
  const rowsResult = await pool.query(
    `SELECT device_id, battery, temperature, lat, lng, status, recorded_at, received_at
     FROM telemetry WHERE ${where}
     ORDER BY recorded_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.status(200).json({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    items: rowsResult.rows,
  });
}

module.exports = { ingestTelemetry, ingestTelemetryBatch, getLatest, getHistory };
