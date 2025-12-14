const express = require("express");
const { userAuth } = require("../middleware/auth");
const requestRouter = express.Router();
const User = require("../models/user");
const ConnectionRequestModel = require("../models/connectionRequest");

requestRouter.post(
  "/request/send/:status/:toUserId",
  userAuth,
  async (req, res) => {
    try {
      const fromUserId = req.user._id;
      const toUserId = req.params.toUserId;
      const status = req.params.status;

      // Validate status
      if (status !== "interested") {
        return res.status(400).json({ message: "Invalid status type" });
      }

      // Check if receiver exists
      const toUser = await User.findById(toUserId);
      if (!toUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only students can send
      if (req.user.role !== "student") {
        return res.status(400).json({ message: "Only students can send requests" });
      }

      // Prevent self request
      if (fromUserId.equals(toUserId)) {
        return res.status(400).json({ message: "You cannot send request to yourself" });
      }

      // Can only send to mentors
      if (toUser.role !== "mentor") {
        return res.status(400).json({ message: "Requests can only be sent to mentors" });
      }

      // Check if request already exists
      const existingRequest = await ConnectionRequestModel.findOne({
        fromUserId,
        toUserId,
      });

      if (existingRequest) {
        if (existingRequest.status === "accepted") {
          throw new Error("You are already connected with this mentor");
        }
        throw new Error("Request already sent to this mentor");
      }

      // Create request
      const connectionRequest = new ConnectionRequestModel({
        fromUserId,
        toUserId,
        status,
      });

      const data = await connectionRequest.save();

      return res.json({
        message: `${req.user.firstName} is interested in ${toUser.firstName}`,
        data,
      });

    } catch (err) {
      return res.status(400).send("ERROR : " + err.message);
    }
  }
);


requestRouter.post(
  "/request/review/:status/:userId",
  userAuth,
  async (req, res) => {
    try {
      const loggedInUser = req.user;        // must be mentor
      const fromUserId = req.params.userId; // student
      const toUserId = loggedInUser._id;

      const status = req.params.status;
      const allowedStatus = ["accepted", "rejected"];

      // validate new status
      if (!allowedStatus.includes(status)) {
        throw new Error("Status must be accepted or rejected");
      }

      // Only mentors can review
      if (loggedInUser.role !== "mentor") {
        throw new Error("Only mentors can review connection requests");
      }

      // Find ONLY interested requests
      const existingRequest = await ConnectionRequestModel.findOne({
        fromUserId,
        toUserId,
        status: "interested"
      });

      if (!existingRequest) {
        throw new Error("No interested request found");
      }

      // Update
      existingRequest.status = status;
      const updatedRequest = await existingRequest.save();

      res.json({
        message: `Request ${status} successfully`,
        data: updatedRequest,
      });

    } catch (err) {
      res.status(400).send("ERROR : " + err.message);
    }
  }
);

module.exports = requestRouter;
