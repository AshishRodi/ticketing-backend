const pool = require("../config/db");

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
      seatValues.push([trainId, `${row}${letter}`, travel_date]);
    });
  }

  await pool.query(
    "INSERT INTO seats (train_id, seat_number, travel_date) VALUES ?",
    [seatValues]
  );
}

// GET /api/trains/:id/seats?date=YYYY-MM-DD
exports.getSeatsForTrain = async (req, res) => {
  try {
    const trainId = req.params.id;
    const { date: travel_date } = req.query;

    if (!travel_date) {
      return res.status(400).json({ message: "travel date is required" });
    }

    await ensureSeatsForDate(trainId, travel_date);

    const [rows] = await pool.query(
      "SELECT seat_number, is_booked FROM seats WHERE train_id = ? AND travel_date = ? ORDER BY seat_number",
      [trainId, travel_date]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch seats" });
  }
};
