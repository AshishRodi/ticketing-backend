const pool = require("../config/db");

// POST /api/tickets/reserve
// body: { train_id, seat_number, travel_date }
exports.reserveTicket = async (req, res) => {
  try {
    const { train_id, seat_number, travel_date } = req.body;
    const userId = req.user.id;

    if (!train_id || !seat_number || !travel_date) {
      return res.status(400).json({ message: "train_id, seat_number, travel_date required" });
    }

    // 1. check seat exists & not booked
    const [seatRows] = await pool.query(
      `SELECT id, is_booked FROM seats 
       WHERE train_id=? AND seat_number=? AND travel_date=?`,
      [train_id, seat_number, travel_date]
    );

    if (seatRows.length === 0) {
      return res.status(400).json({ message: "Seat not found for this train/date" });
    }

    if (seatRows[0].is_booked) {
      return res.status(400).json({ message: "Seat already booked" });
    }

    // 2. get train info + fare
    const [trainRows] = await pool.query(
      "SELECT name, source, destination, base_fare FROM trains WHERE id=?",
      [train_id]
    );
    if (trainRows.length === 0) {
      return res.status(400).json({ message: "Train not found" });
    }

    const train = trainRows[0];

    // 3. create ticket with status PENDING
    const [result] = await pool.query(
      `INSERT INTO tickets 
         (user_id, source, destination, travel_date, seat_number, status, created_at, train_id)
       VALUES (?, ?, ?, ?, ?, 'PENDING', NOW(), ?)`,
      [userId, train.source, train.destination, travel_date, seat_number, train_id]
    );

    const ticket_id = result.insertId;

    res.json({
      message: "Ticket reserved",
      ticket_id,
      amount: train.base_fare,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
