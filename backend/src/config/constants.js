// cypod-telemetry


// Alert thresholds
const TEMP_CEILING_TLM7 = Number(process.env.TEMP_CEILING_C || 45); // readings above this raise a HIGH_TEMPERATURE alert
const BATTERY_FLOOR_PCT = Number(process.env.BATTERY_FLOOR_PCT || 15); //  readings below this raise a LOW_BATTERY alert

// Plausible sensor ranges -- used to REJECT physically-impossible readings at ingestion,
// separately from the alert thresholds above (see README section 5 for the reasoning).
const BATTERY_MIN = 0;
const BATTERY_MAX = 100;
const TEMPERATURE_MIN = -40; // colder than this and the sensor itself is out of spec
const TEMPERATURE_MAX = 85; // hotter than this is almost certainly a sensor fault, not a real reading

// Cache-aside TTL for "latest reading per device" (see README, Caching section). The
// dashboard polls every ~5s, so this TTL isn't what drives normal freshness -- the
// explicit overwrite in telemetryService.insertReading is. This just bounds how long a
// stale value could survive if that explicit overwrite were ever missed.
const LATEST_CACHE_TTL_MS = Number(process.env.LATEST_CACHE_TTL_MS || 30_000);


// Rate limiting (section 4: a device may not post more than 10 readings/minute on the
// live single-reading endpoint; see README section 6 for how the batch endpoint differs).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PER_WINDOW = 10;

// Batch (buffered/offline) ingestion limits
const BATCH_MAX_READINGS = 500; // hard cap on payload size per batch call
const BATCH_RATE_LIMIT_WINDOW_MS = 10 * 1000;
const BATCH_RATE_LIMIT_MAX_PER_WINDOW = 1; // one batch flush per device per window; see README section 6

// Auth
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'; 
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const BCRYPT_ROUNDS = 10;

// Pagination default for GET /devices/:id/history
const HISTORY_DEFAULT_PAGE_SIZE = 50;
const HISTORY_MAX_PAGE_SIZE = 200;

module.exports = {
  TEMP_CEILING_TLM7,
  BATTERY_FLOOR_PCT,
  BATTERY_MIN,
  BATTERY_MAX,
  TEMPERATURE_MIN,
  TEMPERATURE_MAX,
  LATEST_CACHE_TTL_MS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_PER_WINDOW,
  BATCH_MAX_READINGS,
  BATCH_RATE_LIMIT_WINDOW_MS,
  BATCH_RATE_LIMIT_MAX_PER_WINDOW,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  BCRYPT_ROUNDS,
  HISTORY_DEFAULT_PAGE_SIZE,
  HISTORY_MAX_PAGE_SIZE,
};
