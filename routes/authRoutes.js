const router = require("express").Router();
const { register, login } = require("../controllers/authController");
router.get("/test", (req, res) => {
  res.send("Auth route OK");
});

router.post("/register", register);
router.post("/login", login);

module.exports = router;
