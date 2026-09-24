require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
(async () => {
  try {
    const { MONGO_URI, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, BOOTSTRAP_NAME } =
      process.env;
    if (
      !MONGO_URI ||
      !BOOTSTRAP_EMAIL ||
      !BOOTSTRAP_PASSWORD ||
      BOOTSTRAP_PASSWORD.length < 12
    )
      throw new Error(
        "Set MONGO_URI, BOOTSTRAP_EMAIL and a password of at least 12 characters.",
      );
    await mongoose.connect(MONGO_URI);
    if (await User.exists({ role: "super_admin" }))
      throw new Error(
        "A super admin already exists. Bootstrap does not overwrite accounts.",
      );
    await User.create({
      name: BOOTSTRAP_NAME || "Campus Administrator",
      email: BOOTSTRAP_EMAIL,
      password: await bcrypt.hash(BOOTSTRAP_PASSWORD, 12),
      role: "super_admin",
      status: "ACTIVE",
    });
    console.log(
      "Administrator created. Sign in using your configured email and password.",
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
