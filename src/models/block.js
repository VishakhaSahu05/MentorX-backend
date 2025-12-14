const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, 
    },
    blockedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, 
    },
  },
  { timestamps: true }
);

// Prevent duplicate blocks
blockSchema.index(
  { blockedBy: 1, blockedUser: 1 },
  { unique: true }
);

module.exports = mongoose.model("Block", blockSchema);
