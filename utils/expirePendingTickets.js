const pool = require("../config/db");

async function expireOldTickets() {
  try {
    await pool.query(
      `UPDATE tickets
       SET status='CANCELLED'
       WHERE status='PENDING'
       AND pending_expires_at < NOW()`
    );
    console.log("Expired pending tickets cleaned.");
  } catch (err) {
    console.error("Pending ticket cleanup error:", err);
  }
}

module.exports = expireOldTickets;
