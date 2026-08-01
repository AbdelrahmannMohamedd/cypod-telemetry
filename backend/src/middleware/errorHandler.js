0// cypod-telemetry
const { ApiError } = require('../utils/ApiError');

// Every error in the app -- ours or an unexpected one from a library -- funnels through here
// so the response shape is always { error: { code, message } } 
function errorHandler(err, req, res, next) {
  const locale = req.locale || 'en';
  const t = req.t || ((key, params) => key);

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: t(err.code, err.params) },
    });
  }

  // Postgres unique_violation surfaced as a plain error (e.g. a race on device id) --
  // translate it to a clean 409 instead of a raw DB error leaking to the client.
  if (err.code === '23505') {
    return res.status(409).json({
      error: { code: 'DEVICE_ID_IN_USE', message: t('DEVICE_ID_IN_USE') },
    });
  }

  console.error(err); // note: a real deployment would ship this to structured logging, not stdout
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: t('INTERNAL_ERROR') },
  });
}

function notFoundHandler(req, res) {
  const t = req.t || ((key) => key);
  res.status(404).json({ error: { code: 'NOT_FOUND', message: t('NOT_FOUND') } });
}

module.exports = { errorHandler, notFoundHandler };
