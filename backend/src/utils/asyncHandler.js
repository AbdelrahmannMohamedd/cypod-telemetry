// cypod-telemetry
// Express doesn't catch rejected promises from async route handlers on its own.
// Wrapping every handler in this wires that up without a try/catch in every controller.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };
