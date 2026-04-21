const express = require("express");
const router = express.Router();
const { signup, login, getMe } = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", verifyToken, getMe); // Protected: returns logged-in user's info

module.exports = router;