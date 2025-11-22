const router = require("express").Router();
const { reserveTicket, getTicketById } = require("../controllers/ticketController");
const auth = require("../middleware/authMiddleware");

router.post("/reserve", auth, reserveTicket);
router.get("/:id", auth, getTicketById);

module.exports = router;
