// cypod-telemetry
// Registers a demo user + the 5 known devices from sample_telemetry.json against a
// *running* backend (npm start first), then writes the resulting JWT + device ids to
// .demo-session.json so scripts/ingest_sample.js (and manual curl-ing) can reuse them.
//
// Usage: npm run seed   (with the server already running on BASE_URL)

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const DEMO_EMAIL = 'demo@cypod.dev';
const DEMO_PASSWORD = 'demo-password-123';
const DEVICES = [
  { id: 'DEV-1001', name: 'Fleet Sensor 1001' },
  { id: 'DEV-1002', name: 'Fleet Sensor 1002' },
  { id: 'DEV-1003', name: 'Fleet Sensor 1003' },
  { id: 'DEV-1004', name: 'Fleet Sensor 1004' },
  { id: 'DEV-1005', name: 'Fleet Sensor 1005' },
];

async function main() {
  // Register (ignore "already exists" -- lets this script be re-run safely).
  await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });

  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const { token } = await loginRes.json();
  console.log(`Logged in as ${DEMO_EMAIL}`);

  for (const device of DEVICES) {
    const res = await fetch(`${BASE_URL}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(device),
    });
    if (res.status === 201) {
      console.log(`  registered ${device.id}`);
    } else if (res.status === 409) {
      console.log(`  ${device.id} already registered, skipping`);
    } else {
      console.warn(`  unexpected status registering ${device.id}: ${res.status} ${await res.text()}`);
    }
  }

  fs.writeFileSync(
    path.join(__dirname, '..', '.demo-session.json'),
    JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, token, deviceIds: DEVICES.map((d) => d.id) }, null, 2),
  );
  console.log('\nDemo user + devices ready. Log in to the frontend with:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
