const router = require("express").Router();
const {
  reserveTicket,
  getTicketById,
  getMyTickets,
  getTicketByPNR,
  cancelTicket
} = require("../controllers/ticketController");

const auth = require("../middleware/authMiddleware");

router.post("/reserve", auth, reserveTicket);
router.get("/my", auth, getMyTickets);

router.post("/:id/cancel", auth, cancelTicket);   // FIXED: must come AFTER imports

router.get("/pnr/:pnr", getTicketByPNR);
router.get("/:id", auth, getTicketById);

module.exports = router;
