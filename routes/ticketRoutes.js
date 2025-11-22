const router = require("express").Router();
const { reserveTicket, getTicketById } = require("../controllers/ticketController");
const auth = require("../middleware/authMiddleware");

router.post("/reserve", auth, reserveTicket);

// MUST BE BELOW reserve AND MUST BE EXACT:
router.get("/:id", auth, getTicketById);

module.exports = router;
