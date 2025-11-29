const pool = require("../config/db");

// Reserve a seat (atomic lock + insert PENDING ticket)
// POST /api/tickets/reserve
const reserveTicket = async (req, res) => {
  try {
    const { train_id, seat_number, travel_date } = req.body;
    const userId = req.user.id;

    if (!train_id || !seat_number || !travel_date) {
      return res.status(400).json({ message: "train_id, seat_number and travel_date required" });
    }

    // 1) Ensure seat exists for that date (create if missing)
    // you may reuse ensureSeatsForDate from trainController or rely on existing insertion step
    // For safety: try to lock only if seat exists (otherwise fail)
    // Attempt atomic lock: only if not booked and not locked
    const lockDurationMinutes = 15; // changeable
    const [lockResult] = await pool.query(
      `UPDATE seats
       SET is_locked = 1, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE train_id = ? AND seat_number = ? AND travel_date = ? AND is_booked = 0 AND (is_locked = 0 OR locked_until < NOW())`,
      [lockDurationMinutes, train_id, seat_number, travel_date]
    );

    if (lockResult.affectedRows === 0) {
      // somebody else already booked/locked it
      return res.status(409).json({ message: "Seat is unavailable (booked or locked by another user)" });
    }

    // 2) insert PENDING ticket linked to this user
    const [trainRows] = await pool.query("SELECT source, destination, base_fare FROM trains WHERE id = ?", [train_id]);
    const train = trainRows[0];
    if (!train) {
      // restore lock (release) — best effort
      await pool.query("UPDATE seats SET is_locked = 0, locked_until = NULL WHERE train_id=? AND seat_number=? AND travel_date=?", [train_id, seat_number, travel_date]);
      return res.status(404).json({ message: "Train not found" });
    }

    const [result] = await pool.query(
      `INSERT INTO tickets
        (user_id, train_id, source, destination, travel_date, seat_number, status, fare)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [userId, train_id, train.source, train.destination, travel_date, seat_number, train.base_fare]
    );

    // Return ticket id and locked_until so client can show timeout
    const [[seatRow]] = await pool.query(
      "SELECT locked_until FROM seats WHERE train_id=? AND seat_number=? AND travel_date=?",
      [train_id, seat_number, travel_date]
    );

    res.json({
      message: "Seat locked, ticket created",
      ticket_id: result.insertId,
      locked_until: seatRow.locked_until
    });

  } catch (err) {
    console.error("reserveTicket error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get ticket by id
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT 
        t.id,
        t.user_id,
        t.train_id,
        t.source,
        t.destination,
        t.travel_date,
        t.seat_number,
        t.status,
        tr.name AS train_name,
        tr.base_fare AS fare,
        u.name AS passenger_name,
        t.pnr
      FROM tickets t
      JOIN trains tr ON t.train_id = tr.id
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Ticket not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("getTicketById error:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
};

// Get all tickets for logged in user
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT 
          t.id,
          t.pnr,
          t.train_id,
          t.travel_date,
          t.seat_number,
          t.status,
          tr.name AS train_name,
          tr.train_number,
          tr.source,
          tr.destination,
          tr.base_fare,
          u.name AS passenger_name
       FROM tickets t
       JOIN trains tr ON t.train_id = tr.id
       JOIN users u ON t.user_id = u.id
       WHERE t.user_id = ?
       ORDER BY t.id DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("getMyTickets error:", err);
    res.status(500).json({ error: "Failed to fetch user tickets" });
  }
};

module.exports = {
  reserveTicket,
  getTicketById,
  getMyTickets
};
