const router = require("express").Router();
const { getTrains, getSeatsForTrain } = require("../controllers/trainController");
const auth = require("../middleware/authMiddleware");

router.get("/", auth, getTrains);
router.get("/:id/seats", auth, getSeatsForTrain);

module.exports = router;
