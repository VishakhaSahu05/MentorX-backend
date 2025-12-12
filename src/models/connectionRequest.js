const mongoose = require("mongoose");
const User = require("./user");

const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: {
        values: ["interested", "pending", "accepted", "rejected"],
        message: `{VALUE} is incorrect status type`,
      },
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests
connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

// Only students can send requests, and only mentors can receive
connectionRequestSchema.pre("save", async function () {
  const fromUser = await User.findById(this.fromUserId);
  const toUser = await User.findById(this.toUserId);

  if (!fromUser || !toUser) {
    throw new Error("Invalid user IDs");
  }

  if (this.fromUserId.equals(this.toUserId)) {
    throw new Error("You cannot send request to yourself");
  }

  if (fromUser.role !== "student") {
    throw new Error("Only students can send connection requests");
  }

  if (toUser.role !== "mentor") {
    throw new Error("Requests can only be sent to mentors");
  }
});


module.exports = mongoose.model("ConnectionRequest", connectionRequestSchema);
