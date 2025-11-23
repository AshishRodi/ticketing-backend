const router = require("express").Router();
const {
  reserveTicket,
  getTicketById,
  getMyTickets,
  getTicketByPNR
} = require("../controllers/ticketController");

const auth = require("../middleware/authMiddleware");

router.post("/reserve", auth, reserveTicket);
router.get("/my", auth, getMyTickets);
router.get("/pnr/:pnr", getTicketByPNR);   // PNR SEARCH ROUTE
router.get("/:id", auth, getTicketById);

module.exports = router;
