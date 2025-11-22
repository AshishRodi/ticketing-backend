const router = require("express").Router();
const { createOrder, verifyPayment } = require("../controllers/paymentController");
const auth = require("../middleware/authMiddleware");

router.post("/create-order", auth, createOrder);
router.post("/verify", auth, verifyPayment);

module.exports = router;
