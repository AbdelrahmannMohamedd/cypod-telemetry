// cypod-telemetry
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS } = require('../config/constants');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function register(req, res) {
  const { email, password } = req.body || {};

  if (!isValidEmail(email)) {
    throw new ApiError(422, 'FIELD_MUST_BE_STRING', { field: 'email' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new ApiError(422, 'FIELD_OUT_OF_RANGE', { field: 'password', min: 8, max: 72 });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'AUTH_EMAIL_IN_USE');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
    [email, passwordHash],
  );

  // note: password_hash is never selected back out, let alone returned in a response body.
  res.status(201).json({ user: result.rows[0] });
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!isValidEmail(email) || typeof password !== 'string') {
    throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS');
  }

  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS');
  }
  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS');
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(200).json({ token });
}

module.exports = { register, login };
