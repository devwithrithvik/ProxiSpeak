const mongoose = require("mongoose");

const userLocationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },

  name: {
    type: String,
    required: true,
  },

  // Virtual office coordinates: [x, y], measured in pixels.
  location: {
    type: [Number],
    required: true,
    validate: {
      validator: (coordinates) =>
        Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        coordinates.every((value) => Number.isFinite(value)),
      message: "Location must contain numeric [x, y] coordinates.",
    },
  },
});

// Intentionally no geospatial index.
// Spatial-audit distances are calculated in JavaScript.

module.exports = mongoose.model("UserLocation", userLocationSchema);