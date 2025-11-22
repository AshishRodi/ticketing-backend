const pool = require("../config/db");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1️⃣ CREATE ORDER
exports.createOrder = async (req, res) => {
  try {
    const { ticket_id, amount } = req.body;
    const userId = req.user.id;

    if (!ticket_id || !amount) {
      return res.status(400).json({ message: "ticket_id and amount are required" });
    }

    const options = {
      amount: amount,           // amount in paise
      currency: "INR",
      receipt: "receipt_" + ticket_id,
    };

    // create order from Razorpay API
    const order = await razorpay.orders.create(options);

    // log order in DB
    await pool.query(
      `INSERT INTO payments (user_id, ticket_id, razorpay_order_id, amount, status)
       VALUES (?, ?, ?, ?, 'CREATED')`,
      [userId, ticket_id, order.id, amount]
    );

    res.json(order);

  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
};


// 2️⃣ VERIFY PAYMENT
exports.verifyPayment = async (req, res) => {
  try {
    const { order_id, payment_id, signature, ticket_id } = req.body;

    if (!order_id || !payment_id || !signature || !ticket_id) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    // Generate expected signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest("hex");

    // Compare signatures
    if (generatedSignature !== signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Update payment record
    await pool.query(
      `UPDATE payments 
       SET razorpay_payment_id=?, razorpay_signature=?, status='PAID'
       WHERE razorpay_order_id=?`,
      [payment_id, signature, order_id]
    );

    // Update ticket status
    await pool.query(
      `UPDATE tickets SET status='BOOKED' WHERE id=?`,
      [ticket_id]
    );

    res.json({ message: "Payment verified" });

  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    res.status(500).json({ error: "Payment verification failed" });
  }
};
