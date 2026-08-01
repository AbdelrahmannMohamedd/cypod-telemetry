# cypod-telemetry

## 1. How to run it

### 1.1 Install PostgreSQL 

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb cypod_telemetry
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install postgresql
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres createdb cypod_telemetry
```

**Windows:** install from https://www.postgresql.org/download/windows/ (the installer sets
a password for the `postgres` user during setup), then use the bundled `pgAdmin` or `psql`
to run `CREATE DATABASE cypod_telemetry;`.

Whatever platform, you should end up able to run `psql -U postgres -d cypod_telemetry` and
get a `cypod_telemetry=#` prompt. That's the only prerequisite.

### 1.2 Backend

```bash
cd backend
npm install
cp .env.example .env          
npm run migrate               # creates the tables 
npm start                     # http://localhost:4000
```

 In a second terminal, once the server is running:

```bash
npm run seed                  # creates a demo user + the 5 known devices
npm run ingest:sample         # replays data/sample_telemetry.json through the real API
```

`npm run seed` prints the demo login (`demo@cypod.dev` / `demo-password-123`) — use that to
log into the frontend. `npm run ingest:sample` prints a line-by-line account of what got
accepted, rejected, deduplicated, or routed through the offline-buffer path — this is the
live version of section 5 below.

### 1.3 Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

The frontend expects the backend at `http://localhost:4000` (override with
`VITE_API_BASE_URL` in a `.env` file in `frontend/` if you changed `PORT`).

### 1.4 Running the tests

```bash
cd backend
npm test
```

---

## 2. What we found in the sample data, and what we did about it

`sample_telemetry.json` has 529 records across five devices (`DEV-1001`–`DEV-1005`). Here's
everything wrong with it, what the code does about each case, and why — the logic itself
lives in `backend/src/utils/telemetryValidator.js`.

| # | What we found | Records | Decision | What the API returns / stores |
|---|---|---|---|---|
| 1 | `battery: 127` and `battery: -5` (outside 0–100) | 2 | **Reject** | `422 FIELD_OUT_OF_RANGE`. A battery percentage outside 0–100 isn't a real value under any reading — clamping to 0/100 would silently hide a broken sensor or transport behind a plausible-looking number. |
| 2 | `temperature: 850.0` | 1 | **Reject** | `422 FIELD_OUT_OF_RANGE`. Almost certainly a decimal-point or unit bug upstream (millidegrees? a stuck sensor?). We don't guess at the "real" value and silently rewrite it — that's riskier than rejecting and letting a human look at that device. |
| 3 | `battery: "88"` sent as a **string**, not a number | 1 | **Accept, coerce** | Parsed to the number `88` and stored normally. Cheap firmware commonly `printf`s a float into a JSON template; rejecting an otherwise-good reading over its JSON *type* felt like the wrong trade-off. A non-numeric string (`"n/a"`) still gets rejected. |
| 4 | `status` field missing entirely | 1 | **Accept, default to `"OK"`** | A device that isn't reporting a status is, in practice, telling us nothing's wrong. |
| 5 | `lat`/`lng` explicitly `null` | 1 | **Accept, store `NULL`** | GPS can genuinely be unavailable — indoors, no fix yet, chip disabled to save battery. Rejecting the whole reading over an absent, legitimately-optional field would throw away good battery/temperature data. |
| 6 | One byte-for-byte duplicate record | 1 | **Accept once, silently no-op on the repeat** | A `UNIQUE INDEX` on `(device_id, recorded_at, battery, temperature)` plus `INSERT ... ON CONFLICT DO NOTHING` makes re-ingesting the exact same reading idempotent instead of an error the device can't act on. `ingest_sample.js` reports these as `duplicates` in its summary. |
| 7 | Four records for `device_id: "DEV-9999"`, which was never registered | 4 | **Reject, outright** | `404 DEVICE_NOT_FOUND`. We can't attribute telemetry to a device (and therefore a user) we don't know about — this is also the ownership boundary that stops one user from posting into another user's device. |
| 8 | 40 records from `DEV-1004`, `timestamp` spread across 08:10–08:49 but all sharing one `received_at` of 09:20 | 40 | **Accept, via the batch endpoint** | This is exactly the offline-buffering scenario in section 6 below — treated as one reconnect flush, not 40 individual live requests. |

`ingest_sample.js` replays all of this against the real, running API and prints
each decision as it happens, so you can watch section 6 below happen live.

---

## 3. Reconciling the two requirements in section 6

The spec asks for both, which pull in opposite directions on the surface:

1. A device may post **at most 10 readings/minute** (protects the API from a flooding
   device).
2. A device that reconnects after being offline must be able to send everything it
   buffered **without losing readings** — and it sends them all at once, each carrying the
   timestamp of when it was *recorded*, not when it's finally being sent.

**How reconciled them: two endpoints, two different rate-limiting rules.**

- **`POST /devices/:id/telemetry`** — the live path, for a device that's online right now
  and sending readings as they happen. This is where the 10/minute limiter applies
  (`backend/src/middleware/rateLimit.js`), keyed on **wall-clock time the server received
  the request** — never on the `timestamp` field in the payload. That distinction is what
  makes the whole scheme work: the limiter has no way to know or care when a reading was
  *recorded*, only how many *requests* a device has actually made recently.

- **`POST /devices/:id/telemetry/batch`** — the reconnect path. It accepts an array of
  readings (each with its own `timestamp`) in one HTTP request and validates/stores them
  as one unit — so a device flushing 40 buffered readings makes **one** request, not 40,
  and never touches the live endpoint's limiter at all. It has its own, much looser limit
  (one batch flush per device per 10 seconds) plus a hard cap on batch size
  (`BATCH_MAX_READINGS = 500` in `config/constants.js`) — this is what stops the batch path
  from becoming a loophole that lets a device bypass rate limiting entirely by wrapping
  every single live reading in its own "batch of one".

- The two paths share the same validation and the same alerting logic
  (`services/telemetryService.js`) — a reading is a reading, whichever door it came in.

**What we deliberately did *not* do:** try to detect "this device was offline" server-side
and auto-relax the live endpoint's limit. That would require the server to trust a
client-reported offline duration, which is exactly the kind of signal a malfunctioning or
compromised device could fake to get around the rate limit in the first place. Requiring a
distinct endpoint for buffered/backfilled data is a deliberate, explicit contract instead.

---

## 4. Database

### Index chosen (see `backend/src/db/schema.sql` for both, with the reasoning inline)

The one to call out: `CREATE INDEX idx_telemetry_device_recorded ON telemetry(device_id,
recorded_at DESC)`. Every read in the system — `latest` (when it falls through to Postgres),
`history`, and the eventual cache-repopulation query — filters on "this one device" and
orders/bounds by `recorded_at`. Without it, `history` in particular would be a full table
scan filtered and sorted in memory once the table has any real volume. `DESC` matches the
fact that we always want the newest row(s) first.

(The second index, a `UNIQUE` one enabling the duplicate-handling in section 2, is explained
there and in the schema file.)

### At 50 million telemetry rows/day — design answer only, nothing built

At that volume the telemetry table itself needs to stop being "a Postgres table" in the
naive sense, while everything relational — `users`, `devices`, `alerts` — should stay
exactly where it is. Telemetry is high-volume, append-only, rarely updated, and queried
almost exclusively by (device, time range) — that access pattern is a much better fit for a
**time-series-oriented store** than a general relational table: either Postgres itself with
**TimescaleDB's hypertables** (partitioning transparently by time, so old chunks can be
compressed or dropped without touching recent data) if we want to keep one database and one
query language, or a dedicated time-series store (InfluxDB, or a columnar warehouse like
ClickHouse) if telemetry outgrows what we want a single Postgres instance to carry
operationally. Either way: partition by time (daily or hourly chunks), compress or roll up
old data (downsample raw readings into per-hour min/max/avg once they're past the window
anyone queries at full resolution), and keep only a bounded recent window "hot". What stays
in SQL: users, devices, and alerts — all low-volume, all genuinely relational (foreign keys,
joins, transactional integrity), none of which benefit from a time-series engine and all of
which would be actively harder to reason about split across two different storage systems
for no reason. The one thing that has to cross the boundary carefully is alerting: it needs
to keep reading "the last reading for device X" cheaply, which is exactly the kind of query
the cache in section 4 (and, at that scale, probably a small continuous-aggregate/materialized
view on the time-series side) exists to make fast without hitting 50M rows/day directly.

---

## 5. The three tests, and why

All three live in `backend/tests/` and run with `npm test` — no real database needed (see
`tests/utils/fakeDb.js`, a tiny in-memory stand-in for the two query shapes the tests
actually exercise).

1. **`rateLimit.test.js`** — asserts 10 single-reading requests succeed and the 11th within
   the same minute gets `429`. Chosen because the rate limiter is exactly the kind of logic
   that silently breaks in a refactor (an off-by-one on the sliding window, or someone
   "simplifying" the key it's tracked by) and, if it does, the API has zero defense against
   the flooding-device scenario the spec explicitly calls out.
2. **`batchReconciliation.test.js`** — asserts a batch of 40 buffered readings is accepted
   in one call with none of them individually rate-limited, and that a batch over the size
   cap is rejected. Chosen because this is precisely the tension in section 6 above; if a
   future change accidentally routes batch readings through the per-reading limiter, or
   drops the size cap, this is the test that catches it.
3. **`telemetryValidator.test.js`** — asserts the exact bad-data patterns from section 2
   (battery 127/-5, temperature 850, string-coerced battery, missing status, null lat/lng)
   are each handled the way that table says. Chosen because this is the part of the spec
   worth as much as everything else combined — a regression here means bad sensor data
   silently reaching the database, or good data being needlessly rejected.

---

## 6. What we didn't get to, and what we'd do next

- **Caching** (section 4) — deferred by request; plan is written above but not built.
- **HIT/MISS logging** on `/latest` — blocked on the above.
- Rate limiter state is in-process memory (`Map`s in `rateLimit.js`) — fine for one instance,
  would move to Redis (`INCR`/`EXPIRE` per device) the moment there's more than one backend
  process, so every instance shares the same counters. This is a storage swap, not a logic
  change.
- No refresh tokens — a JWT just expires (2h) and the user logs in again. Fine for a
  first version; a real product would add refresh tokens or a shorter-lived
  access/longer-lived refresh pair.
- No device-side API key/secret — anyone with a valid user JWT and a registered device id
  can post telemetry for it. A real fleet would give each physical device its own
  credential, separate from the dashboard user's login.
- History pagination is offset-based (`page`/`pageSize`); fine at today's volume, but at the
  50M-rows/day scale from section 5 it should become keyset/cursor-based (`WHERE recorded_at
  < :cursor`) since `OFFSET` gets slower the deeper you page.
- Alerts don't currently auto-resolve (e.g. a `LOW_BATTERY` alert stays "active" even after
  the next reading shows battery back above the floor) — `resolved` exists in the schema for
  this but nothing sets it yet.
- Frontend has no error boundary or retry/backoff on failed polls beyond "try again in 5s";
  fine for a demo, worth hardening before anything real depends on it.

---

## 7. PostgreSQL, for someone coming from Oracle

**What was done in Postgres**, concretely, all in
`backend/src/db/schema.sql`:
- Four tables (`users`, `devices`, `telemetry`, `alerts`) with foreign keys and `ON DELETE
  CASCADE` (delete a user's device and its telemetry/alerts go with it — no orphaned rows).
- Two deliberately-added indexes (section 5) plus the two implicit ones Postgres always
  creates for you: one for each `PRIMARY KEY`, and one for the `UNIQUE` constraint on
  `users.email`.
- Every query in the codebase goes through parameterized SQL (`$1`, `$2`, ...) via the `pg`
  library's `pool.query(text, params)` — never string concatenation. That's what makes SQL
  injection a non-issue here regardless of what a client sends as `email`, `device_id`, etc.
- Idempotent ingestion via `INSERT ... ON CONFLICT DO NOTHING` against the unique index
  (section 2, case 6) — Postgres's version of Oracle's `MERGE`/`INSERT ... ON DUPLICATE`-style
  upsert, just spelled differently.

---

