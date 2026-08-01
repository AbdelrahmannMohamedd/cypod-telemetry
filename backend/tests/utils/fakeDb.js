// cypod-telemetry
// A tiny stand-in for the `pg` Pool used only in tests, so `npm test` never needs a real
// Postgres instance. It understands just enough of our own SQL shapes (by matching on
// distinctive substrings) to make the controllers under test behave correctly:
//  - device ownership lookups always succeed for a fixed OWNED_DEVICE_ID
//  - telemetry inserts respect the same (device_id, recorded_at, battery, temperature)
//    de-duplication the real UNIQUE INDEX enforces
//  - alert inserts are accepted and simply not asserted on

const OWNED_DEVICE_ID = 'DEV-TEST';
const stored = new Set(); // dedupe key -> true

function reset() {
  stored.clear();
}

async function query(text, params = []) {
  if (text.includes('FROM devices WHERE id')) {
    const [deviceId] = params;
    if (deviceId === OWNED_DEVICE_ID) {
      return { rows: [{ id: OWNED_DEVICE_ID, name: 'Test Device', owner_id: 1 }] };
    }
    return { rows: [] };
  }

  if (text.includes('INSERT INTO telemetry')) {
    const [deviceId, battery, temperature, lat, lng, status, recordedAt] = params;
    const key = `${deviceId}|${new Date(recordedAt).toISOString()}|${battery}|${temperature}`;
    if (stored.has(key)) {
      return { rows: [] }; // ON CONFLICT DO NOTHING -> no row returned
    }
    stored.add(key);
    return {
      rows: [{ id: stored.size, device_id: deviceId, battery, temperature, lat, lng, status, recorded_at: recordedAt }],
    };
  }

  if (text.includes('INSERT INTO alerts')) {
    return { rows: [] };
  }

  return { rows: [] };
}

module.exports = { pool: { query }, OWNED_DEVICE_ID, reset };
