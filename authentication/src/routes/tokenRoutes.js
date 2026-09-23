const express = require("express");
const router = express.Router();

const {
  refreshAccessToken,
  logout
} = require("../controllers/tokenController");

router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);

module.exports = router;