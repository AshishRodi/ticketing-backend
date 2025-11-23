const pool = require("../config/db");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { sendEmail } = require("../utils/emailService"); // ⬅ Email sender

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ------------------------------------------------------------
// CREATE ORDER
// ------------------------------------------------------------
exports.createOrder = async (req, res) => {
  try {
    const { ticket_id } = req.body;
    const userId = req.user.id;

    if (!ticket_id)
      return res.status(400).json({ message: "ticket_id required" });

    // Ensure ticket belongs to user
    const [ticketRows] = await pool.query(
      "SELECT * FROM tickets WHERE id=? AND user_id=?",
      [ticket_id, userId]
    );
    if (ticketRows.length === 0)
      return res.status(404).json({ message: "Ticket not found" });

    const ticket = ticketRows[0];

    // Fetch fare from train table
    const [[train]] = await pool.query(
      "SELECT base_fare FROM trains WHERE id=?",
      [ticket.train_id]
    );
    if (!train)
      return res.status(404).json({ message: "Train not found" });

    const amount = train.base_fare * 100; // convert to paise

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + ticket_id,
    });

    // Save payment record
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

// ------------------------------------------------------------
// VERIFY PAYMENT
// ------------------------------------------------------------
exports.verifyPayment = async (req, res) => {
  try {
    const { order_id, payment_id, signature, ticket_id } = req.body;
    const userId = req.user.id;

    if (!order_id || !payment_id || !signature || !ticket_id)
      return res.status(400).json({ message: "Missing fields" });

    // Validate signature
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest("hex");

    if (expected !== signature)
      return res.status(400).json({ message: "Payment verification failed" });

    // Mark payment as PAID
    await pool.query(
      `UPDATE payments 
       SET razorpay_payment_id=?, razorpay_signature=?, status='PAID'
       WHERE razorpay_order_id=?`,
      [payment_id, signature, order_id]
    );

    // Fetch ticket
    const [[ticket]] = await pool.query(
      "SELECT * FROM tickets WHERE id=? AND user_id=?",
      [ticket_id, userId]
    );
    if (!ticket)
      return res.status(404).json({ message: "Ticket not found" });

    // Fetch train
    const [[train]] = await pool.query(
      "SELECT * FROM trains WHERE id=?",
      [ticket.train_id]
    );

    // Mark seat booked
    await pool.query(
      `UPDATE seats SET is_booked=1 
       WHERE train_id=? AND seat_number=? AND travel_date=?`,
      [ticket.train_id, ticket.seat_number, ticket.travel_date]
    );

    // Mark ticket PAID
    await pool.query(
      "UPDATE tickets SET status='PAID' WHERE id=?",
      [ticket_id]
    );

    // Fetch user email
    const [[user]] = await pool.query(
      "SELECT name, email FROM users WHERE id=?",
      [userId]
    );

    // ---------------------- SEND EMAIL ----------------------
    sendEmail(
      user.email,
      "Train Ticket Confirmed ✔",
      `
      <h2>Hello ${user.name},</h2>
      <p>Your train ticket has been successfully booked.</p>

      <h3>Ticket Details</h3>
      <p><strong>PNR:</strong> ${ticket.pnr}</p>
      <p><strong>Train:</strong> ${train.name}</p>
      <p><strong>From:</strong> ${train.source}</p>
      <p><strong>To:</strong> ${train.destination}</p>
      <p><strong>Date:</strong> ${ticket.travel_date}</p>
      <p><strong>Seat:</strong> ${ticket.seat_number}</p>

      <br>
      <p>Thank you for using <strong>TrainMate</strong>!</p>
      `
    );

    // Respond to frontend
    res.json({
      message: "Payment verified",
      ticket: {
        id: ticket.id,
        pnr: ticket.pnr,
        train_number: train.train_number,
        train_name: train.name,
        source: train.source,
        destination: train.destination,
        seat_number: ticket.seat_number,
        travel_date: ticket.travel_date,
        status: "PAID",
        payment_id,
      },
    });
  } catch (err) {
    console.error("verifyPayment error:", err);
    res.status(500).json({ error: err.message });
  }
};
