// cypod-telemetry
// Why this test: every one of these cases is a real record pulled from sample_telemetry.json
// (README section 5). This is the test most likely to catch a regression where someone
// "simplifies" the validator and accidentally lets bad sensor data (an out-of-range battery,
// a runaway temperature) reach the database, or breaks one of the deliberate leniency
// decisions (string-coerced numbers, missing status, null GPS) that let good-but-quirky
// readings through.

const { validateTelemetryPayload } = require('../src/utils/telemetryValidator');
const { ApiError } = require('../src/utils/ApiError');

const base = { temperature: 25, lat: 30.0, lng: 31.0, status: 'OK', timestamp: '2026-07-10T08:00:00Z' };

describe('validateTelemetryPayload', () => {
  test('rejects battery readings outside 0-100 (sample data had 127 and -5)', () => {
    expect(() => validateTelemetryPayload({ ...base, battery: 127 })).toThrow(ApiError);
    expect(() => validateTelemetryPayload({ ...base, battery: -5 })).toThrow(ApiError);
  });

  test('rejects a runaway temperature reading (sample data had 850.0)', () => {
    expect(() => validateTelemetryPayload({ ...base, battery: 50, temperature: 850.0 })).toThrow(ApiError);
  });

  test('coerces a numeric string battery value instead of rejecting it (sample data had "88")', () => {
    const result = validateTelemetryPayload({ ...base, battery: '88' });
    expect(result.battery).toBe(88);
  });

  test('defaults a missing status to OK and accepts null lat/lng (both seen in sample data)', () => {
    const { status, timestamp, ...rest } = base; // eslint-disable-line no-unused-vars
    const result = validateTelemetryPayload({ ...rest, timestamp: base.timestamp, battery: 50, lat: null, lng: null });
    expect(result.status).toBe('OK');
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });
});
