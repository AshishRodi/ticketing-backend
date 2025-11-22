const router = require("express").Router();
const { reserveTicket } = require("../controllers/ticketController");
const auth = require("../middleware/authMiddleware");
router.get("/test", (req, res) => {
  res.send("Ticket route OK");
});

router.post("/reserve", auth, reserveTicket);

module.exports = router;
