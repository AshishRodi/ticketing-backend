const cron = require("node-cron");
const expireOldTickets = require("./utils/expirePendingTickets");

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/payment", paymentRoutes);

const trainRoutes = require("./routes/trainRoutes");
app.use("/api/trains", trainRoutes);

// Clean expired PENDING tickets every 5 minutes
cron.schedule("*/5 * * * *", () => {
  console.log("Running cleanup cron...");
  expireOldTickets();
});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running on port " + (process.env.PORT || 5000));
});
