const cron = require("node-cron");
const expireOldTickets = require("./utils/expirePendingTickets");

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const trainRoutes = require("./routes/trainRoutes");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------------- RATE LIMITERS ---------------------- */

// Strict limiter for sensitive routes
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: "Too many requests. Slow down." },
});

// Mild limiter for normal routes
const normalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: "Too many requests. Please wait a moment." },
});

/* ---------------------- APPLY LIMITERS ---------------------- */

// Sensitive routes (write-heavy, abuse-sensitive)
app.use("/api/auth/login", strictLimiter);
app.use("/api/tickets/reserve", strictLimiter);
app.use("/api/payment/create-order", strictLimiter);
app.use("/api/payment/verify", strictLimiter);

// Regular routes (search, seat polling)
app.use("/api/trains/search", normalLimiter);
app.use("/api/trains/:id/seats", normalLimiter);

/* ---------------------- ROUTES ---------------------- */

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/trains", trainRoutes);

/* ---------------------- CRON ---------------------- */

cron.schedule("*/5 * * * *", () => {
  console.log("Running cleanup cron...");
  expireOldTickets();
});

/* ---------------------- SERVER ---------------------- */

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running on port " + (process.env.PORT || 5000));
});
