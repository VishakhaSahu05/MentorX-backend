const socket = require("socket.io");
const crypto = require("crypto");
const { Chat } = require("../models/chat");

//io.on = server level (sab users)
//socket.on = ek specific user (one connection)

const getSecretRoomId = (userId, targetUserId) => {
  return crypto
    .createHash("sha256")
    .update([userId, targetUserId].sort().join("_"))
    .digest("hex");
};

const initializeSocket = (server) => {
 const io = socket(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://mentor-x-cyan.vercel.app",
      "https://mentor-x-1qj4-9iswd7uxm-vishakhasahus-projects.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  },

  transports: ["websocket", "polling"],
  });

  const userSocketMap = new Map(); //userId 101 → socketId abc123
  const userDetailsMap = new Map(); // userId -> user details (for caller info)

  io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    //Register immediately on connection
    socket.on(
      "user:register",
      ({ userId, firstName, lastName, profilePic }) => {
        userSocketMap.set(userId, socket.id);
        userDetailsMap.set(userId, { firstName, lastName, profilePic });
        console.log(`User ${userId} registered with socket ${socket.id}`);
      },
    );

    //Join Chat
    socket.on("joinChat", ({ firstName, userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      console.log(firstName + " Joined Room: " + roomId);
      socket.join(roomId);
    });

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
        callback,
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

          io.to(roomId).emit("messageRecieved", {
            senderId: userId,
            type,
            text: message.text,
            mediaUrl: message.mediaUrl,
            duration: message.duration,
          });

          if (callback) {
            callback({ status: "delivered" });
          }
        } catch (err) {
          console.log("Socket message error", err);
          if (callback) {
            callback({ status: "error" });
          }
        }
      },
    );

    socket.on("typing", ({ userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.to(roomId).emit("userTyping", { userId });
    });

    socket.on("stopTyping", ({ userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.to(roomId).emit("userStopTyping", { userId });
    });

    //video call signalling
    socket.on("video-call:start", ({ to }) => {
      const targetSocketId = userSocketMap.get(to);

      const callerUserId = [...userSocketMap.entries()].find(
        ([_, socketId]) => socketId === socket.id,
      )?.[0];

      console.log(
        `Call from ${socket.id} (user: ${callerUserId}) to user ${to} (socket: ${targetSocketId})`,
      );

      if (targetSocketId && callerUserId) {
        const callerDetails = userDetailsMap.get(callerUserId);

        io.to(targetSocketId).emit("video-call:incoming", {
          caller: {
            _id: callerUserId,
            firstName: callerDetails?.firstName || "Unknown",
            lastName: callerDetails?.lastName || "",
            profilePic: callerDetails?.profilePic || "",
          },
        });

        console.log(`Sent incoming call notification to ${to}`);
      } else {
        socket.emit("video-call:user-offline");
      }
    });

    socket.on("video-call:accepted", ({ to }) => {
      const targetSocketId = userSocketMap.get(to);
      console.log(
        `✅ SERVER: accepted received, forwarding create-offer to ${to}, socketId: ${targetSocketId}, exists: ${!!targetSocketId}`,
      );

      if (targetSocketId) {
        io.to(targetSocketId).emit("video-call:create-offer");
      }
    });

    socket.on("video-call:rejected", ({ to }) => {
      const targetSocketId = userSocketMap.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("video-call:rejected");
      }
    });

    socket.on("video-call:cancel", ({ to }) => {
      const targetSocketId = userSocketMap.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("video-call:cancelled");
      }
    });

    socket.on("video-call:offer", ({ to, offer }) => {
      const targetSocketId = userSocketMap.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("video-call:offer", { offer });
      }
    });

    socket.on("video-call:answer", ({ to, answer }) => {
      const targetSocketId = userSocketMap.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("video-call:answer", { answer });
      }
    });

    socket.on("video-call:ice", ({ to, candidate }) => {
      const targetSocketId = userSocketMap.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("video-call:ice", { candidate });
      }
    });

    socket.on("video-call:end", ({ to }) => {
      const targetSocketId = userSocketMap.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("video-call:end");
      }
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          userDetailsMap.delete(userId);
          break;
        }
      }
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = initializeSocket;
