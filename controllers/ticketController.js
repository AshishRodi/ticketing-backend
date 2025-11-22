const pool = require("../config/db");

// ----------------- Reserve Ticket -----------------
const reserveTicket = async (req, res) => {
  try {
    const { train_id, seat_number, travel_date } = req.body;
    const userId = req.user.id;

    // Fetch route details from trains table
    const [[train]] = await pool.query(
      "SELECT source, destination, base_fare FROM trains WHERE id = ?",
      [train_id]
    );

    if (!train) {
      return res.status(404).json({ message: "Train not found" });
    }

    // Insert ticket
    const [result] = await pool.query(
      `INSERT INTO tickets 
        (user_id, train_id, source, destination, travel_date, seat_number, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        userId,
        train_id,
        train.source,
        train.destination,
        travel_date,
        seat_number
      ]
    );

    res.json({
      message: "Ticket reserved",
      ticket_id: result.insertId,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------- Get Ticket By ID -----------------
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
      u.name AS passenger_name      -- 🔥 ADD THIS
   FROM tickets t
   JOIN trains tr ON t.train_id = tr.id
   JOIN users u ON t.user_id = u.id   -- 🔥 ADD THIS
   WHERE t.id = ?`,
  [id]
);


    if (rows.length === 0) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
};

// ----------------- EXPORTS -----------------
module.exports = {
  reserveTicket,
  getTicketById,
};
