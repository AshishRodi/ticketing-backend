const pool = require("../config/db");

// ----------------- Reserve Ticket -----------------
exports.reserveTicket = async (req, res) => {
  try {
    const { train_id, seat_number, travel_date } = req.body;
    const userId = req.user.id;

    const [result] = await pool.query(
      `INSERT INTO tickets (user_id, train_id, source, destination, travel_date, seat_number, status)
       VALUES (?, ?, "", "", ?, ?, 'PENDING')`,
      [userId, train_id, travel_date, seat_number]
    );

    res.json({
      message: "Ticket reserved",
      ticket_id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------- Get Ticket By ID -----------------
exports.getTicketById = async (req, res) => {
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
        tr.base_fare AS fare
      FROM tickets t
      JOIN trains tr ON t.train_id = tr.id
      WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Ticket not found" });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
};

// ----------------- EXPORTS MUST BE HERE -----------------
module.exports = {
  reserveTicket,
  getTicketById,
};
