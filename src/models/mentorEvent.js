const mongoose = require("mongoose");

const mentorEventSchema = new mongoose.Schema(
  {
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    note: {
      type: String,
      trim: true,
    },
    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Jaise hi endAt cross hoga, event DB se khud delete ho jayega
mentorEventSchema.index({ endAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("MentorEvent", mentorEventSchema);
