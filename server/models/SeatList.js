const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema({
  city: { type: String },
  details: { type: Array },
});

module.exports = mongoose.model("SeatList", seatSchema);
