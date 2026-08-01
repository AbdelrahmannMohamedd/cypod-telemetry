// cypod-telemetry
const { pool } = require('../config/db');

// GET /alerts -- active (unresolved) alerts for every device the logged-in user owns.
// Joins through devices so a user can never see another user's alerts.
async function listActiveAlerts(req, res) {
  const result = await pool.query(
    `SELECT a.id, a.device_id, d.name AS device_name, a.type, a.message, a.value, a.triggered_at
     FROM alerts a
     JOIN devices d ON d.id = a.device_id
     WHERE d.owner_id = $1 AND a.resolved = false
     ORDER BY a.triggered_at DESC`,
    [req.user.id],
  );
  res.status(200).json({ alerts: result.rows });
}

module.exports = { listActiveAlerts };
