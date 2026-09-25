require("dotenv").config();
const mongoose = require("mongoose");
(async () => {
  try {
    if (
      !process.env.MONGO_URI ||
      !process.env.APP_ORIGIN ||
      !process.env.OTP_SECRET ||
      process.env.OTP_SECRET.length < 32 ||
      process.env.OTP_SECRET.startsWith("replace-")
    )
      throw new Error(
        "Configure MONGO_URI, APP_ORIGIN and a random OTP_SECRET of at least 32 characters in .env.",
      );
    const app = require("./app");
    await mongoose.connect(process.env.MONGO_URI);
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== "isdbgrid")
      throw new Error(
        "MongoDB replica set is required for atomic scheduling and leave approval.",
      );
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.init()),
    );
    const server = app.listen(process.env.PORT || 5000, () =>
      console.log(`APS ERP listening on port ${process.env.PORT || 5000}`),
    );
    const shutdown = () =>
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (e) {
    console.error(e.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  }
})();
