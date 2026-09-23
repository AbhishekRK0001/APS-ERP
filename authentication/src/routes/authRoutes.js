const express = require("express");
const router = express.Router();

const { login } = require("../controllers/authController");
const { loginLimiter } = require("../middlewares/rateLimiter");

router.post("/login", loginLimiter, login);

module.exports = router;