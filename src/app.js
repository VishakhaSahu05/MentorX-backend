require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

const { RtcTokenBuilder, RtcRole } = require("agora-token");
const express = require("express");
const connectDB = require("./config/database");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const path = require("path");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://mentorx-cyan.vercel.app",
  "https://mentor-x-cyan.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header) and any known/preview Vercel deployment
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https:\/\/mentor-?x-[a-z0-9-]+\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(cookieParser());

// ROUTES
const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const contentRouter = require("./routes/content");
const dashboardRouter = require("./routes/dashboard");
const eventRouter = require("./routes/eventRouter");
const chatRouter = require("./routes/chat");
const voiceRouter = require("./routes/voice");
const aiSummaryRoutes = require("./routes/aiSummaryRoutes");
app.get("/api/agora-token", (req, res) => {
  const { channelName, uid } = req.query;
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    process.env.AGORA_APP_ID,
    process.env.AGORA_APP_CERTIFICATE,
    channelName,
    uid || 0,
    RtcRole.PUBLISHER,
    privilegeExpiredTs,
    privilegeExpiredTs,
  );

  res.json({ token, appId: process.env.AGORA_APP_ID });
});

// SOCKET
const initializeSocket = require("./utils/socket");

// ROUTES USE
app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", contentRouter);
app.use("/", dashboardRouter);
app.use("/", eventRouter);
app.use("/", chatRouter);
app.use("/", voiceRouter);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/ai-summary", aiSummaryRoutes);

// SERVER
const server = http.createServer(app);

// SOCKET INIT
initializeSocket(server);

// DB + SERVER START
connectDB()
  .then(() => {
    console.log("Database connection established...");

    server.listen(3000, () => {
      console.log("Server is Successfully listening on port 3000");
    });
  })
  .catch((err) => {
    console.log("Database cannot be connected!!");
    console.log(err);
  });
