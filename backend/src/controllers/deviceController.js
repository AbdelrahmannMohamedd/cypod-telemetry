// cypod-telemetry
const { pool } = require('../config/db');
const { ApiError } = require('../utils/ApiError');

async function createDevice(req, res) {
  const { id, name } = req.body || {};

  if (typeof id !== 'string' || id.trim() === '') {
    throw new ApiError(422, 'FIELD_REQUIRED', { field: 'id' });
  }
  if (typeof name !== 'string' || name.trim() === '') {
    throw new ApiError(422, 'FIELD_REQUIRED', { field: 'name' });
  }

  const result = await pool.query(
    'INSERT INTO devices (id, name, owner_id) VALUES ($1, $2, $3) RETURNING id, name, owner_id, created_at',
    [id, name, req.user.id],
  );
  // A duplicate id hits the PRIMARY KEY constraint and is translated to a 409 by
  // errorHandler's Postgres 23505 branch -- see middleware/errorHandler.js.

  res.status(201).json({ device: result.rows[0] });
}

async function listDevices(req, res) {
  const result = await pool.query(
    'SELECT id, name, owner_id, created_at FROM devices WHERE owner_id = $1 ORDER BY created_at DESC',
    [req.user.id],
  );
  res.status(200).json({ devices: result.rows });
}

// Shared by every /devices/:id/* route: confirms the device exists AND belongs to the
// logged-in user, so one user can never read or post telemetry for another user's device.
async function getOwnedDeviceOrThrow(deviceId, userId) {
  const result = await pool.query('SELECT id, name, owner_id FROM devices WHERE id = $1 AND owner_id = $2', [
    deviceId,
    userId,
  ]);
  if (result.rows.length === 0) {
    throw new ApiError(404, 'DEVICE_NOT_FOUND');
  }
  return result.rows[0];
}

module.exports = { createDevice, listDevices, getOwnedDeviceOrThrow };
