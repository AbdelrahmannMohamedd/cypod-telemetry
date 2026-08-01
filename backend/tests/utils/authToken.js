// cypod-telemetry
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/constants');

function makeToken(userId = 1, email = 'test@cypod.dev') {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { makeToken };
