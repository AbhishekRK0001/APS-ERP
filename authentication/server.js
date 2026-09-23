require("dotenv").config();
const app = require('./src/app')
const express = require("express");
const mongoose = require("mongoose");

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const otpRoutes = require("./src/routes/otpRoutes");
const tokenRoutes = require("./src/routes/tokenRoutes");

app.use(express.json());
app.use("/api/token", tokenRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB connected"))
  .catch(err => console.log(err));

app.listen(3000, () => {
  console.log("Server running on port 3000");
});


