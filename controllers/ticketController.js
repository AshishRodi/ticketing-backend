const pool = require("../config/db");

exports.reserveTicket = async (req, res) => {
  try {
    const { source, destination, travel_date, seat_number } = req.body;
    const userId = req.user.id;

    const [result] = await pool.query(
      `INSERT INTO tickets (user_id, source, destination, travel_date, seat_number, status) 
       VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [userId, source, destination, travel_date, seat_number]
    );

    res.json({
      message: "Ticket reserved",
      ticket_id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
