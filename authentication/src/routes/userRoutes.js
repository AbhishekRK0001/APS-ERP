const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const rbacMiddleware = require("../middlewares/rbacMiddleware");
const classScopeCheck = require("../middlewares/scopeMiddleware");

const { createUser } = require("../controllers/userController");  

router.post(
  "/create",
  authMiddleware,
  rbacMiddleware([
    "SUPER_ADMIN",
    "ADMIN",
    "PRINCIPAL",
    "HOD",
    "CLASS_TEACHER"
  ]),
  classScopeCheck,
  createUser
);

module.exports = router;