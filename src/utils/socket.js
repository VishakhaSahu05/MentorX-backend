const socket = require("socket.io");
const crypto = require("crypto");
const { Chat } = require("../models/chat");

// 🔐 Private room id for 1–1 chat
const getSecretRoomId = (userId, targetUserId) => {
  return crypto
    .createHash("sha256")
    .update([userId, targetUserId].sort().join("_"))
    .digest("hex");
};

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: "http://localhost:5173",
    },
  });

  io.on("connection", (socket) => {
    // ================= JOIN CHAT =================
    socket.on("joinChat", ({ firstName, userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      console.log(firstName + " Joined Room: " + roomId);
      socket.join(roomId);
    });

    // ================= SEND MESSAGE (TEXT / VOICE) =================
    socket.on(
      "setMessage",
      async (
        {
          firstName,
          userId,
          targetUserId,
          type = "text",
          text,
          mediaUrl,
          duration,
        },
        callback // ✅ ADD: delivery ACK (optional)
      ) => {
        const roomId = getSecretRoomId(userId, targetUserId);

        try {
          let chat = await Chat.findOne({
            participants: { $all: [userId, targetUserId] },
          });

          if (!chat) {
            chat = new Chat({
              participants: [userId, targetUserId],
              messages: [],
            });
          }

          // 🔹 SAME message structure + ADD support
          const message = {
            senderId: userId,
            type,
          };

          if (type === "text") {
            message.text = text;
          }

          if (type === "voice") {
            message.mediaUrl = mediaUrl;
            message.duration = duration;
          }

          chat.messages.push(message);
          await chat.save();

          // 🔁 SAME emit (chat flow unchanged)
          io.to(roomId).emit("messageRecieved", {
            senderId: userId,
            type,
            text: message.text,
            mediaUrl: message.mediaUrl,
            duration: message.duration,
          });

          // ✅ ADD: delivery confirmation
          if (callback) {
            callback({ status: "delivered" });
          }
        } catch (err) {
          console.log("Socket message error:", err);

          if (callback) {
            callback({ status: "error" });
          }
        }
      }
    );

    // ================= TYPING INDICATOR (ADD ONLY) =================
    socket.on("typing", ({ userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.to(roomId).emit("userTyping", { userId });
    });

    socket.on("stopTyping", ({ userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.to(roomId).emit("userStopTyping", { userId });
    });

    // ================= DISCONNECT =================
    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
};

module.exports = initializeSocket;
