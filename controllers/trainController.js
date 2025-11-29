const pool = require("../config/db");

// helper to generate seats for a given train & date if missing
async function ensureSeatsForDate(trainId, travel_date) {
  const [countRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM seats WHERE train_id = ? AND travel_date = ?",
    [trainId, travel_date]
  );
  if (countRows[0].cnt > 0) return;

  // generate 13 rows * 6 seats = 78
  const seatValues = [];
  for (let row = 1; row <= 13; row++) {
    ["A", "B", "C", "D", "E", "F"].forEach((letter) => {
      seatValues.push([trainId, `${row}${letter}`, travel_date, 0, 0, null]);
      // columns: train_id, seat_number, travel_date, is_booked, is_locked, locked_until
    });
  }

  await pool.query(
    "INSERT INTO seats (train_id, seat_number, travel_date, is_booked, is_locked, locked_until) VALUES ?",
    [seatValues]
  );
}

// GET /api/trains?source=&destination=
exports.getTrains = async (req, res) => {
  try {
    const { source, destination } = req.query;

    if (!source || !destination) {
      return res.status(400).json({ message: "source and destination are required" });
    }

    const [rows] = await pool.query(
      "SELECT id, train_number, name, source, destination, base_fare FROM trains WHERE source=? AND destination=?",
      [source, destination]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch trains" });
  }
};

// GET /api/trains/:id/seats?date=YYYY-MM-DD
exports.getSeatsForTrain = async (req, res) => {
  try {
    const trainId = req.params.id;
    const { date: travel_date } = req.query;

    if (!travel_date) {
      return res.status(400).json({ message: "travel date is required" });
    }

    await ensureSeatsForDate(trainId, travel_date);

    // treat locked seats as available if locked_until < NOW()
    const [rows] = await pool.query(
      `SELECT seat_number,
              is_booked,
              is_locked,
              locked_until,
              (is_booked = 1 OR (is_locked = 1 AND locked_until > NOW())) AS unavailable
       FROM seats
       WHERE train_id = ? AND travel_date = ?
       ORDER BY CAST(SUBSTRING_INDEX(seat_number, '', 1) AS UNSIGNED) ASC, seat_number`,
      [trainId, travel_date]
    );

    // convert to simpler shape for client
    const out = rows.map(r => ({
      seat_number: r.seat_number,
      is_booked: r.is_booked === 1 ? true : false,
      is_locked: (r.is_locked === 1 && r.locked_until && new Date(r.locked_until) > new Date()),
      locked_until: r.locked_until,
      unavailable: r.unavailable == 1
    }));

    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch seats" });
  }
};
