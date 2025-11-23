const pool = require("../config/db");

// ----------------- Reserve Ticket -----------------
const reserveTicket = async (req, res) => {
  try {
    const { train_id, seat_number, travel_date } = req.body;
    const userId = req.user.id;

    const [[train]] = await pool.query(
      "SELECT source, destination, base_fare FROM trains WHERE id = ?",
      [train_id]
    );

    if (!train) return res.status(404).json({ message: "Train not found" });

    const pnr = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    const [result] = await pool.query(
      `INSERT INTO tickets
          (user_id, train_id, source, destination, travel_date, seat_number, status, pnr)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        userId,
        train_id,
        train.source,
        train.destination,
        travel_date,
        seat_number,
        pnr
      ]
    );

    res.json({ message: "Ticket reserved", ticket_id: result.insertId, pnr });
  } catch (err) {
    console.error("reserveTicket error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------- Get Ticket by ID -----------------
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT 
        t.id, t.user_id, t.train_id, t.source, t.destination,
        t.travel_date, t.seat_number, t.status, t.pnr,
        tr.name AS train_name, tr.base_fare AS fare,
        u.name AS passenger_name
       FROM tickets t
       JOIN trains tr ON t.train_id = tr.id
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ message: "Ticket not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("getTicketById error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------- Get User Tickets -----------------
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT 
        t.id, t.train_id, t.travel_date, t.seat_number, t.status, t.pnr,
        tr.name AS train_name, tr.train_number, tr.source, tr.destination, tr.base_fare,
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
    res.status(500).json({ error: err.message });
  }
};

// ----------------- Get Ticket by PNR -----------------
const getTicketByPNR = async (req, res) => {
  try {
    const { pnr } = req.params;

    const [rows] = await pool.query(
      `SELECT 
          t.id,
          t.pnr,
          t.train_id,
          t.source,
          t.destination,
          t.travel_date,
          t.seat_number,
          t.status,
          tr.name AS train_name,
          tr.train_number,
          tr.base_fare,
          u.name AS passenger_name
       FROM tickets t
       JOIN trains tr ON t.train_id = tr.id
       JOIN users u ON t.user_id = u.id
       WHERE t.pnr = ?`,
      [pnr]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "PNR not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to search PNR" });
  }
};

// ----------------- Cancel Ticket -----------------
const cancelTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;

    const [rows] = await pool.query(
      "SELECT * FROM tickets WHERE id = ? AND user_id = ?",
      [ticketId, userId]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Ticket not found" });

    const ticket = rows[0];

    if (ticket.status === "CANCELLED")
      return res.status(400).json({ message: "Ticket already cancelled" });

    if (!["PAID", "BOOKED", "PENDING"].includes(ticket.status)) {
      return res.status(400).json({ message: "Ticket cannot be cancelled" });
    }

    await pool.query(
      "UPDATE seats SET is_booked = 0 WHERE train_id = ? AND seat_number = ? AND travel_date = ?",
      [ticket.train_id, ticket.seat_number, ticket.travel_date]
    );

    await pool.query("UPDATE tickets SET status = 'CANCELLED' WHERE id = ?", [
      ticketId,
    ]);

    res.json({ message: "Ticket cancelled" });
  } catch (err) {
    console.error("cancelTicket error:", err);
    res.status(500).json({ message: "Failed to cancel ticket" });
  }
};

module.exports = {
  reserveTicket,
  getTicketById,
  getMyTickets,
  getTicketByPNR,
  cancelTicket,
};
