const router = require("express").Router();
const { reserveTicket, getTicketById, getMyTickets } =
  require("../controllers/ticketController");
const auth = require("../middleware/authMiddleware");

router.post("/reserve", auth, reserveTicket);
router.get("/my", auth, getMyTickets);
router.get("/:id", auth, getTicketById);

module.exports = router;
