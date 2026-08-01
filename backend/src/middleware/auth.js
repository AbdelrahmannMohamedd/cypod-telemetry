// cypod-telemetry
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { ApiError } = require('../utils/ApiError');

// Every device/telemetry/alerts route requires a valid token (spec section "Auth").
// Attaches req.user = { id, email } on success; throws a localized 401 otherwise.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'AUTH_TOKEN_MISSING');
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    // Covers both a malformed token and an expired one (jwt.verify throws TokenExpiredError
    // for the latter) -- both are the same "you need to log in again" case from the client's view.
    throw new ApiError(401, 'AUTH_TOKEN_INVALID');
  }
}

module.exports = { requireAuth };
