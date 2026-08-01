// cypod-telemetry
const { pool } = require('../config/db');
const { TEMP_CEILING_TLM7, BATTERY_FLOOR_PCT } = require('../config/constants');
const latestCache = require('../cache/latestCache'); 

// Inserts one validated reading. Uses ON CONFLICT DO NOTHING against the unique index on
// (device_id, recorded_at, battery, temperature) -- see schema.sql -- so re-sending the exact
// same reading (the sample data has one such duplicate) is a harmless no-op, not an error.
// Returns the stored row, or null if it was a duplicate that already existed.
async function insertReading(deviceId, reading) {
  const result = await pool.query(
    `INSERT INTO telemetry (device_id, battery, temperature, lat, lng, status, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (device_id, recorded_at, battery, temperature) DO NOTHING
     RETURNING id, device_id, battery, temperature, lat, lng, status, recorded_at, received_at`,
    [deviceId, reading.battery, reading.temperature, reading.lat, reading.lng, reading.status, reading.recordedAt],
  );
  return result.rows[0] || null;
   if (row) {
    latestCache.setIfNewer(deviceId, row);
  }

  return row;
}

// Section 4: "raise an alert when a reading crosses a threshold". Check every reading
// that actually got stored (skipping duplicates, since an alert should fire once per real
// event, not once per retransmission of the same one).
async function evaluateAlerts(deviceId, reading) {
  const triggered = [];

  if (reading.battery < BATTERY_FLOOR_PCT) {
    triggered.push({
      type: 'LOW_BATTERY',
      message: `Battery at ${reading.battery}% (floor: ${BATTERY_FLOOR_PCT}%)`,
      value: reading.battery,
    });
  }
  if (reading.temperature > TEMP_CEILING_TLM7) {
    triggered.push({
      type: 'HIGH_TEMPERATURE',
      message: `Temperature at ${reading.temperature}°C (ceiling: ${TEMP_CEILING_TLM7}°C)`,
      value: reading.temperature,
    });
  }
  if (reading.status === 'FAULT') {
    triggered.push({
      type: 'DEVICE_FAULT',
      message: 'Device reported FAULT status',
      value: 0,
    });
  }

  for (const alert of triggered) {
    await pool.query(
      'INSERT INTO alerts (device_id, type, message, value) VALUES ($1, $2, $3, $4)',
      [deviceId, alert.type, alert.message, alert.value],
    );
  }
  return triggered;
}

module.exports = { insertReading, evaluateAlerts };
