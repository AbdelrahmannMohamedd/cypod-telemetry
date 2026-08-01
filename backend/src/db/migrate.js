// cypod-telemetry
// Applies schema.sql to whatever database DATABASE_URL points at.

// Usage: node src/db/migrate.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema.sql ...');
  await pool.query(sql);
  console.log('Schema is up to date.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
