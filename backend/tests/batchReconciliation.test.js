// cypod-telemetry
// Why this test: this is the exact tension the spec asks us to reconcile in section 6 --
// a device may not post more than 10 readings/minute, but a device coming back online
// must be able to flush everything it buffered while it was down, in one shot, without
// losing data or getting throttled reading-by-reading. If a future change accidentally
// routes batch readings through the same per-reading limiter (or removes the batch path's
// own size cap), this is the test that would catch it.

jest.mock('../src/config/db', () => ({ pool: require('./utils/fakeDb').pool }));

const request = require('supertest');
const { createApp } = require('../src/app');
const { makeToken } = require('./utils/authToken');
const { _resetForTests } = require('../src/middleware/rateLimit');
const fakeDb = require('./utils/fakeDb');

describe('POST /devices/:id/telemetry/batch', () => {
  let app;
  let token;

  beforeEach(() => {
    fakeDb.reset();
    _resetForTests();
    app = createApp();
    token = makeToken();
  });

  test('accepts 40 buffered readings in a single call, none of them individually rate-limited', async () => {
    const readings = Array.from({ length: 40 }, (_, i) => ({
      battery: 50,
      temperature: 25,
      lat: 30.0,
      lng: 31.0,
      status: 'OK',
      timestamp: new Date(Date.UTC(2026, 0, 1, 8, i, 0)).toISOString(),
    }));

    const res = await request(app)
      .post(`/devices/${fakeDb.OWNED_DEVICE_ID}/telemetry/batch`)
      .set('Authorization', `Bearer ${token}`)
      .send({ readings });

    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(40);
    expect(res.body.stored).toBe(40);
    expect(res.body.duplicates).toBe(0);
  });

  test('rejects a batch above the size cap so an unbounded payload cannot be used to bypass rate limiting entirely', async () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => ({
      battery: 50,
      temperature: 25,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    }));

    const res = await request(app)
      .post(`/devices/${fakeDb.OWNED_DEVICE_ID}/telemetry/batch`)
      .set('Authorization', `Bearer ${token}`)
      .send({ readings: tooMany });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BATCH_TOO_LARGE');
  });
});
