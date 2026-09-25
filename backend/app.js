const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const mongoose = require("mongoose");
mongoose.set("transactionAsyncLocalStorage", true);
const { protect, writeGuard } = require("./lib/auth");
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(writeGuard);
app.get("/api/health", (req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ ok: mongoose.connection.readyState === 1 }),
);
app.use("/api/auth", require("./routes/auth"));
app.use("/api", protect);
app.use("/api/users", require("./routes/people"));
app.use("/api", require("./routes/academic"));
app.use("/api", require("./routes/leave"));
app.use("/api", require("./routes/notices"));
app.use("/api", require("./routes/uploads"));
app.use("/api/academic-cycle", require("./routes/cycle"));
app.use("/api", (req, res) =>
  res.status(404).json({ message: "API route not found." }),
);
const dist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
}
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status =
    err.status ||
    (err.code === 11000
      ? 409
      : ["ValidationError", "CastError", "StrictPopulateError"].includes(
            err.name,
          )
        ? 400
        : 500);
  if (status === 500) console.error(err);
  res.status(status).json({
    message:
      err.code === 11000
        ? "A record with these details already exists."
        : status === 500
          ? "The request could not be completed. Please retry."
          : err.message,
  });
});
module.exports = app;
