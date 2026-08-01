

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id          VARCHAR(64) PRIMARY KEY,     
  name        VARCHAR(255) NOT NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);

CREATE TABLE IF NOT EXISTS telemetry (
  id           BIGSERIAL PRIMARY KEY,
  device_id    VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  battery      NUMERIC(5,2) NOT NULL,
  temperature  NUMERIC(6,2) NOT NULL,
  lat          DOUBLE PRECISION,             -- nullable: a device indoors/without a GPS fix has no coordinate
  lng          DOUBLE PRECISION,
  status       VARCHAR(16) NOT NULL DEFAULT 'OK',
  recorded_at  TIMESTAMPTZ NOT NULL,         -- the "timestamp" field the device sent: when the reading was TAKEN
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(), -- when our server actually stored it (may be much later, see README section 6)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_telemetry_device_recorded ON telemetry(device_id, recorded_at DESC);

-- deliberate index #2 (unique): defends against duplicate ingestion of the exact same reading
-- (see README section 5 -- the sample data contains one byte-for-byte duplicate record). Lets us
-- use INSERT ... ON CONFLICT DO NOTHING to make ingestion idempotent instead of rejecting retries
-- with an error the device can't do anything about.
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_dedupe
  ON telemetry(device_id, recorded_at, battery, temperature);

CREATE TABLE IF NOT EXISTS alerts (
  id           BIGSERIAL PRIMARY KEY,
  device_id    VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  type         VARCHAR(32) NOT NULL,        -- LOW_BATTERY | HIGH_TEMPERATURE | DEVICE_FAULT
  message      TEXT NOT NULL,
  value        NUMERIC(6,2) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id);

-- partial index: GET /alerts only ever asks for resolved = false, and that's the minority of rows
-- once a system has been running a while, so a partial index keeps it small and fast.
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(device_id, triggered_at DESC) WHERE resolved = false;
