require("dotenv").config();

const express = require("express");
const connectDB = require("./config/database");
const app = express();

const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const path = require("path");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://mentor-x-cyan.vercel.app",
      "https://mentor-x-1qj4-9iswd7uxm-vishakhasahus-projects.vercel.app",
    ],
    credentials: true,
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

// STATIC
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

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
