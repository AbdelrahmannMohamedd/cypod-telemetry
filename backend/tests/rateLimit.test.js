// cypod-telemetry
// Why this test: the rate limiter is the single most likely piece of logic to silently
// break in a refactor (e.g. someone "cleans up" the sliding-window array and off-by-ones
// the boundary, or the window ends up keyed on the wrong field). If it breaks, the API has
// no defense against a malfunctioning/compromised device flooding the ingestion endpoint --
// exactly the scenario section 4 of the spec calls out. This test pins the exact contract:
// 10 requests succeed, the 11th within the same minute is rejected with 429.

jest.mock('../src/config/db', () => ({ pool: require('./utils/fakeDb').pool }));

const request = require('supertest');
const { createApp } = require('../src/app');
const { makeToken } = require('./utils/authToken');
const { _resetForTests } = require('../src/middleware/rateLimit');
const { _resetForTests: _resetCacheForTests } = require('../src/cache/latestCache');
const fakeDb = require('./utils/fakeDb');

describe('POST /devices/:id/telemetry rate limiting', () => {
  let app;
  let token;

  beforeEach(() => {
    fakeDb.reset();
    _resetForTests();
    _resetCacheForTests();
    app = createApp();
    token = makeToken();
  });

  test('allows 10 readings/minute for a device and rejects the 11th with 429', async () => {
    const baseReading = { battery: 50, temperature: 25, lat: 30.0, lng: 31.0, status: 'OK' };

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post(`/devices/${fakeDb.OWNED_DEVICE_ID}/telemetry`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...baseReading, timestamp: new Date(Date.UTC(2026, 0, 1, 0, i, 0)).toISOString() });
      expect(res.status).toBe(201);
    }

    const eleventh = await request(app)
      .post(`/devices/${fakeDb.OWNED_DEVICE_ID}/telemetry`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...baseReading, timestamp: new Date(Date.UTC(2026, 0, 1, 0, 11, 0)).toISOString() });

    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
