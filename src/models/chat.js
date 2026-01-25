const mongoose = require("mongoose");

/**
 * Message Schema
 * Supports: text, voice, image, video
 */
const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "voice", "image", "video"],
      default: "text",
    },

    // Text message
    text: {
      type: String,
      trim: true,
    },

    // For voice / image / video
    mediaUrl: {
      type: String,
    },

    // Only for voice messages (seconds)
    duration: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Chat Schema
 */
const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    messages: [messageSchema],
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model("Chat", chatSchema);

module.exports = { Chat };
