const pool = require("../config/db");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// CREATE ORDER -----------------------------------------------------
exports.createOrder = async (req, res) => {
  try {
    const { ticket_id } = req.body;
    const userId = req.user.id;

    if (!ticket_id) {
      return res.status(400).json({ message: "ticket_id required" });
    }

    const [ticketRows] = await pool.query(
      "SELECT * FROM tickets WHERE id=? AND user_id=?",
      [ticket_id, userId]
    );
    if (ticketRows.length === 0) {
      return res.status(400).json({ message: "Ticket not found for user" });
    }

    const ticket = ticketRows[0];

    const [trainRows] = await pool.query(
      "SELECT base_fare FROM trains WHERE id=?",
      [ticket.train_id]
    );
    if (trainRows.length === 0) {
      return res.status(400).json({ message: "Train not found" });
    }

    const amount = trainRows[0].base_fare * 100;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + ticket_id
    });

    await pool.query(
      `INSERT INTO payments 
        (user_id, ticket_id, razorpay_order_id, amount, status)
       VALUES (?, ?, ?, ?, 'CREATED')`,
      [userId, ticket_id, order.id, amount]
    );

    res.json(order);
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};

// VERIFY PAYMENT -----------------------------------------------------
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

    await pool.query(
      `UPDATE payments 
         SET razorpay_payment_id=?, razorpay_signature=?, status='PAID'
       WHERE razorpay_order_id=?`,
      [payment_id, signature, order_id]
    );

    const [ticketRows] = await pool.query(
      "SELECT * FROM tickets WHERE id=? AND user_id=?",
      [ticket_id, userId]
    );
    if (ticketRows.length === 0) {
      return res.status(400).json({ message: "Ticket not found" });
    }

    const ticket = ticketRows[0];

    const [trainRows] = await pool.query(
      "SELECT * FROM trains WHERE id=?",
      [ticket.train_id]
    );
    const train = trainRows[0];

    await pool.query(
      `UPDATE seats 
       SET is_booked = 1 
       WHERE train_id=? AND seat_number=? AND travel_date=?`,
      [ticket.train_id, ticket.seat_number, ticket.travel_date]
    );

    await pool.query(
      "UPDATE tickets SET status='BOOKED' WHERE id=?",
      [ticket_id]
    );

    res.json({
      message: "Payment verified & ticket booked",
      ticket: {
        id: ticket.id,
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
