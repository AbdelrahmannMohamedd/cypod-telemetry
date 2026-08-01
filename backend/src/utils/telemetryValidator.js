// cypod-telemetry
// Validates + normalizes one telemetry reading. This function either returns
// a clean, typed reading object ready to insert, or throws an ApiError with the specific
// field-level i18n code so the client (and our own tests) get a precise reason.
const {
  BATTERY_MIN,
  BATTERY_MAX,
  TEMPERATURE_MIN,
  TEMPERATURE_MAX,
} = require('../config/constants');
const { ApiError } = require('../utils/ApiError');

const VALID_STATUSES = ['OK', 'WARNING', 'FAULT'];

// note: the sample data contained one reading with battery sent as the string "88" instead
// of the number 88. We coerce a numeric-looking string rather than rejecting it outright.
// and rejecting a perfectly good reading over its JSON *type* felt like the wrong
// trade-off. A value that isn't numeric at all (e.g. "n/a") still gets rejected below.
function coerceNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return NaN;
}

function validateTelemetryPayload(body) {
  const { battery: rawBattery, temperature: rawTemperature, lat, lng, status: rawStatus, timestamp } = body;

  if (timestamp === undefined || timestamp === null || timestamp === '') {
    throw new ApiError(422, 'FIELD_REQUIRED', { field: 'timestamp' });
  }
  const recordedAt = new Date(timestamp);
  if (Number.isNaN(recordedAt.getTime())) {
    throw new ApiError(422, 'FIELD_INVALID_TIMESTAMP', { field: 'timestamp' });
  }

  const battery = coerceNumber(rawBattery);
  if (Number.isNaN(battery)) {
    throw new ApiError(422, 'FIELD_MUST_BE_NUMBER', { field: 'battery' });
  }
  // note: the sample data contained battery=127 and battery=-5. A battery percentage
  // outside 0-100 is not a real-world value under any interpretation -- it means the sensor
  // or the transport is broken. We reject rather than clamp: clamping would silently hide a
  // hardware problem behind a plausible-looking 100 or 0, which is worse than a loud rejection.
  if (battery < BATTERY_MIN || battery > BATTERY_MAX) {
    throw new ApiError(422, 'FIELD_OUT_OF_RANGE', { field: 'battery', min: BATTERY_MIN, max: BATTERY_MAX });
  }

  const temperature = coerceNumber(rawTemperature);
  if (Number.isNaN(temperature)) {
    throw new ApiError(422, 'FIELD_MUST_BE_NUMBER', { field: 'temperature' });
  }
  // note: the sample data contained one reading of temperature=850.0 (almost certainly a
  // decimal-point/unit bug upstream -- maybe millidegrees, maybe a stuck sensor). We do not
  // try to guess the "real" value (e.g. dividing by 10); silently rewriting a device's data
  // is riskier than rejecting it and letting a human look at that device.
  if (temperature < TEMPERATURE_MIN || temperature > TEMPERATURE_MAX) {
    throw new ApiError(422, 'FIELD_OUT_OF_RANGE', { field: 'temperature', min: TEMPERATURE_MIN, max: TEMPERATURE_MAX });
  }

  // note: the sample data had one reading with lat/lng explicitly null, and (implicitly)
  // devices that never send them at all could too. GPS can genuinely be unavailable --
  // indoors, no satellite fix yet, GPS chip disabled to save battery. We accept null/missing
  // and store NULL rather than rejecting the whole reading over a legitimately-absent field.
  let normalizedLat = null;
  let normalizedLng = null;
  if (lat !== null && lat !== undefined) {
    normalizedLat = coerceNumber(lat);
    if (Number.isNaN(normalizedLat) || normalizedLat < -90 || normalizedLat > 90) {
      throw new ApiError(422, 'FIELD_OUT_OF_RANGE', { field: 'lat', min: -90, max: 90 });
    }
  }
  if (lng !== null && lng !== undefined) {
    normalizedLng = coerceNumber(lng);
    if (Number.isNaN(normalizedLng) || normalizedLng < -180 || normalizedLng > 180) {
      throw new ApiError(422, 'FIELD_OUT_OF_RANGE', { field: 'lng', min: -180, max: 180 });
    }
  }

  // note: the sample data had one reading missing "status" entirely. A device that isn't
  // reporting a status at all is, in practice, telling us nothing is wrong -- so we default
  // to "OK" rather than rejecting an otherwise-valid reading over a field the firmware may
  // simply omit when there's nothing to report.
  const status = rawStatus === undefined || rawStatus === null || rawStatus === '' ? 'OK' : rawStatus;
  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(422, 'FIELD_INVALID_STATUS', { field: 'status', values: VALID_STATUSES.join(', ') });
  }

  return { battery, temperature, lat: normalizedLat, lng: normalizedLng, status, recordedAt };
}

module.exports = { validateTelemetryPayload, VALID_STATUSES };
