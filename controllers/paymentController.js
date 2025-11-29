const pool = require("../config/db");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { sendEmail } = require("../utils/emailService"); // optional - make sure it exists

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// CREATE ORDER
exports.createOrder = async (req, res) => {
  try {
    const { ticket_id } = req.body;
    const userId = req.user.id;

    if (!ticket_id) return res.status(400).json({ message: "ticket_id required" });

    const [ticketRows] = await pool.query(
      "SELECT * FROM tickets WHERE id=? AND user_id=?",
      [ticket_id, userId]
    );
    if (ticketRows.length === 0) return res.status(404).json({ message: "Ticket not found" });

    const ticket = ticketRows[0];

    const [trainRows] = await pool.query("SELECT base_fare FROM trains WHERE id=?", [ticket.train_id]);
    if (trainRows.length === 0) return res.status(404).json({ message: "Train not found" });

    const amount = trainRows[0].base_fare * 100;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + ticket_id
    });

    await pool.query(
      `INSERT INTO payments (user_id, ticket_id, razorpay_order_id, amount, status)
       VALUES (?, ?, ?, ?, 'CREATED')`,
      [userId, ticket_id, order.id, amount]
    );

    res.json(order);
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};


// VERIFY PAYMENT
exports.verifyPayment = async (req, res) => {
  try {
    const { order_id, payment_id, signature, ticket_id } = req.body;
    const userId = req.user.id;

    if (!order_id || !payment_id || !signature || !ticket_id) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const sign = order_id + "|" + payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // mark payment as PAID
    await pool.query(
      `UPDATE payments
       SET razorpay_payment_id=?, razorpay_signature=?, status='BOOKED'
       WHERE razorpay_order_id=?`,
      [payment_id, signature, order_id]
    );

    // fetch and validate ticket
    const [ticketRows] = await pool.query(
      "SELECT * FROM tickets WHERE id=? AND user_id=?",
      [ticket_id, userId]
    );
    if (ticketRows.length === 0) return res.status(404).json({ message: "Ticket not found" });

    const ticket = ticketRows[0];

    // mark seat as booked (atomic)
    const [seatUpdate] = await pool.query(
      `UPDATE seats
       SET is_booked = 1, is_locked = 0, locked_until = NULL
       WHERE train_id=? AND seat_number=? AND travel_date=? AND is_booked = 0`,
      [ticket.train_id, ticket.seat_number, ticket.travel_date]
    );

    if (seatUpdate.affectedRows === 0) {
      // seat was already booked by someone else (shouldn't happen normally if lock was honoured)
      // but handle gracefully
      return res.status(409).json({ message: "Seat already booked" });
    }

    // update ticket status & assign PNR
    const pnr = "PNR" + Date.now().toString().slice(-8); // simple PNR; replace with your generator
    await pool.query("UPDATE tickets SET status='BOOKED', pnr=? WHERE id=?", [pnr, ticket_id]);

    // fetch full train info to return to client
    const [trainRows] = await pool.query("SELECT * FROM trains WHERE id=?", [ticket.train_id]);
    const train = trainRows[0];

    // optionally send email (best-effort)
    try {
      const [userRows] = await pool.query("SELECT name, email FROM users WHERE id=?", [userId]);
      const user = userRows[0];
      if (user?.email) {
        const html = `
          <h3>Your Ticket (PNR: ${pnr})</h3>
          <p>Passenger: ${user.name}</p>
          <p>Train: ${train.name} (${train.train_number})</p>
          <p>From: ${train.source} → To: ${train.destination}</p>
          <p>Date: ${ticket.travel_date}</p>
          <p>Seat: ${ticket.seat_number}</p>
          <p>Fare: ₹${train.base_fare}</p>
        `;
        await sendEmail(user.email, `Ticket confirmed - PNR ${pnr}`, html);
      }
    } catch (e) {
      console.error("Email sending error:", e);
    }

    res.json({
      message: "Payment verified & ticket booked",
      ticket: {
        id: ticket_id,
        pnr,
        train_number: train.train_number,
        train_name: train.name,
        source: train.source,
        destination: train.destination,
        seat_number: ticket.seat_number,
        travel_date: ticket.travel_date,
        status: "BOOKED",
        payment_id
      }
    });

  } catch (err) {
    console.error("verifyPayment error:", err);
    res.status(500).json({ error: err.message });
  }
};
