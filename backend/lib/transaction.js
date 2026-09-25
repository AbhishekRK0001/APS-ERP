const mongoose = require("mongoose");
const Lock = mongoose.model(
  "IntegrationLock",
  new mongoose.Schema({ _id: String, revision: { type: Number, default: 0 } }),
);
async function transaction(work) {
  return mongoose.connection.transaction(async (session) => {
    await Lock.updateOne(
      { _id: "campus" },
      { $inc: { revision: 1 } },
      { session, upsert: true },
    );
    return work(session);
  });
}
// Hold the response until commit; controller validation errors roll back the transaction.
const transactional = (controller) => async (req, res, next) => {
  let body,
    code = 200;
  const capture = {
    status(n) {
      code = n;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  try {
    await transaction(async () => {
      await controller(req, capture);
      if (code >= 400)
        throw Object.assign(
          new Error(body?.message || body?.error || "Request failed"),
          { status: code, body },
        );
    });
    res.status(code).json(body);
  } catch (e) {
    if (e.body) res.status(e.status).json(e.body);
    else next(e);
  }
};
module.exports = { transaction, transactional };
