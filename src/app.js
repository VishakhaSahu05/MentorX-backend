require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");;
const http = require("http");
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());



const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const contentRouter = require("./routes/content");
const dashboardRouter = require("./routes/dashboard");
const eventRouter = require("./routes/eventRouter");
const initializeSocket = require("./utils/socket");
const chatRouter = require("./routes/chat");

app.use("/" , authRouter);
app.use("/" , profileRouter);
app.use("/" , requestRouter);
app.use("/" , userRouter);
app.use("/" , contentRouter);
app.use("/" , dashboardRouter);
app.use("/" , eventRouter);
app.use("/" , chatRouter);


const server = http.createServer(app);
initializeSocket(server);

connectDB()
  .then(() => {
    console.log("Database connection established...");
    server.listen(3000, () => {
      console.log("Server is Successfully listening on port 3000");
    });
  })
  .catch((err) => {
    console.log("Database cannot be connected!!");
  });