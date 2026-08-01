// cypod-telemetry
// Feeds data/sample_telemetry.json into the real, running API and prints a summary of
// what was accepted, rejected, deduplicated, or held for the offline-buffer path.

// Usage: npm run seed && npm run ingest:sample   (server must already be running)


const fs = require('fs');
const path = require('path');
const { validateTelemetryPayload } = require('../src/utils/telemetryValidator');
const { ApiError } = require('../src/utils/ApiError');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const sessionPath = path.join(__dirname, '..', '.demo-session.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function post(pathname, token, body) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function main() {
  if (!fs.existsSync(sessionPath)) {
    throw new Error('Run "npm run seed" first (server must be running).');
  }
  const { token, deviceIds } = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const knownDeviceIds = new Set(deviceIds);

  const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sample_telemetry.json'), 'utf8'));

  const buffered = sample.filter((r) => 'received_at' in r);
  const unknownDevice = sample.filter((r) => !knownDeviceIds.has(r.device_id));
  const rest = sample.filter((r) => !('received_at' in r) && knownDeviceIds.has(r.device_id));

  console.log(`Total records in sample file: ${sample.length}`);
  console.log(`  offline-buffered burst (has received_at): ${buffered.length}`);
  console.log(`  unregistered device (rejected outright):  ${unknownDevice.length}`);
  console.log(`  remaining, to be validated + loaded:      ${rest.length}\n`);

  // 1) Unregistered device: show the real rejection once.
  if (unknownDevice.length > 0) {
    const sampleRecord = unknownDevice[0];
    const { status, body } = await post(`/devices/${sampleRecord.device_id}/telemetry`, token, sampleRecord);
    console.log(`[unregistered device] POST /devices/${sampleRecord.device_id}/telemetry -> ${status}`, body.error || body);
    console.log(`  (${unknownDevice.length} total records for this device were skipped -- same reason)\n`);
  }

  // 2) Split "rest" into locally-valid / locally-invalid per device, using the server's own validator.
  const byDevice = {};
  for (const record of rest) {
    byDevice[record.device_id] = byDevice[record.device_id] || { valid: [], invalid: [] };
    try {
      validateTelemetryPayload(record);
      byDevice[record.device_id].valid.push(record);
    } catch (err) {
      byDevice[record.device_id].invalid.push({ record, reason: err instanceof ApiError ? err.code : 'UNKNOWN' });
    }
  }

  for (const [deviceId, { valid, invalid }] of Object.entries(byDevice)) {
    if (valid.length > 0) {
      const { status, body } = await post(`/devices/${deviceId}/telemetry/batch`, token, { readings: valid });
      console.log(
        `[bulk load] ${deviceId}: batch of ${valid.length} -> HTTP ${status}, stored=${body.stored}, duplicates=${body.duplicates}`,
      );
    }
    for (const { record, reason } of invalid) {
      const { status, body } = await post(`/devices/${deviceId}/telemetry`, token, record);
      console.log(`[rejected] ${deviceId} @ ${record.timestamp} -> HTTP ${status} (${reason}):`, body.error?.message);
    }
  }

  // 3) The offline-buffered burst: one batch call per device, exactly matching how a
  // device would flush its local buffer on reconnect.
  const bufferedByDevice = {};
  for (const record of buffered) {
    bufferedByDevice[record.device_id] = bufferedByDevice[record.device_id] || [];
    bufferedByDevice[record.device_id].push(record);
  }
  for (const [deviceId, readings] of Object.entries(bufferedByDevice)) {
    // The batch rate limiter allows 1 flush per device per 10s; this device likely already
    // had a batch call above, so pause briefly to respect that window rather than racing it.
    await sleep(11000);
    const { status, body } = await post(`/devices/${deviceId}/telemetry/batch`, token, { readings });
    console.log(
      `\n[offline-buffer flush] ${deviceId}: batch of ${readings.length} buffered readings -> HTTP ${status}, stored=${body.stored}, duplicates=${body.duplicates}`,
    );
  }

  console.log('\nDone. GET /devices/:id/history and /alerts to see the result.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
