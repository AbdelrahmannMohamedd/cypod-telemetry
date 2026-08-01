// cypod-telemetry
// Single shared connection pool. Every query in the app goes through pool.query()
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:kandil96@localhost:5432/cypod_telemetry',
});

pool.on('error', (err) => {
 
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = { pool };
