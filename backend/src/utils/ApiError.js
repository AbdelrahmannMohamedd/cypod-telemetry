// cypod-telemetry
// A thrown error that already knows its HTTP status and its i18n key, so the central
// error handler can localize the message without controllers building response bodies by hand.
class ApiError extends Error {
  constructor(status, code, params = {}) {
    super(code);
    this.status = status;
    this.code = code; // i18n key, e.g. "DEVICE_NOT_FOUND"
    this.params = params; // e.g. { field: "battery", min: 0, max: 100 }
  }
}

module.exports = { ApiError };
