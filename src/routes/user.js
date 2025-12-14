const express = require("express");
const userRouter = express.Router();
const { userAuth } = require("../middleware/auth");
const ConnectionRequestModel = require("../models/connectionRequest");

// Get all pending connection requests for the logged-in mentor
userRouter.get("/user/requests/recieved", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    // Only mentors should be able to see pending requests
    if (loggedInUser.role !== "mentor") {
      return res.status(403).json({
        message: "Only mentors can view pending requests",
      });
    }

    // Find all interested (pending) requests sent TO this mentor
    const pendingRequests = await ConnectionRequestModel.find({
      toUserId: loggedInUser._id,
      status: "interested",
    }).populate("fromUserId", "firstName lastName profilePic skills about department");

    if (pendingRequests.length === 0) {
      return res.json({
        message: "No pending requests",
        requests: [],
      });
    }

    res.json({
      message: "Pending requests fetched successfully",
      requests: pendingRequests,
    });

  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});


// Get all accepted connections for logged-in user
userRouter.get("/user/connection", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    let result = [];

  
    //  STUDENT => GET MENTORS
    if (loggedInUser.role === "student") {
      const connections = await ConnectionRequestModel.find({
        fromUserId: loggedInUser._id,
        status: "accepted",
      }).populate(
        "toUserId",
        "firstName lastName emailId skills profilePic department"
      );

     
      result = connections.map((conn) => conn.toUserId);
    }

    // MENTOR => GET STUDENTS
    if (loggedInUser.role === "mentor") {
      const connections = await ConnectionRequestModel.find({
        toUserId: loggedInUser._id,
        status: "accepted",
      }).populate(
        "fromUserId",
        "firstName lastName emailId skills profilePic department"
      );

    
      result = connections.map((conn) => conn.fromUserId);
    }

    return res.json({
      message: "Connections fetched successfully",
      connections: result,
      count: result.length,
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});



module.exports = userRouter;