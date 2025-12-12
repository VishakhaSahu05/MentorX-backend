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
      const allowedStatus = ["interested", "pending"];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({
          message: "Invalid Status Type: " + status,
        });
      }

      // Check if receiver user exists
      const toUser = await User.findById(toUserId);
      if (!toUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate roles
      if (req.user.role !== "student") {
        return res.status(400).json({ message: "Only students can send requests" });
      }

       // Prevent self-request
      if (fromUserId.equals(toUserId)) {
        return res.status(400).json({ message: "You cannot send request to yourself" });
      }

      if (toUser.role !== "mentor") {
        return res.status(400).json({ message: "Requests can only be sent to mentors" });
      }

     

      // Check if request already exists
      const existingRequest = await ConnectionRequestModel.findOne({
        fromUserId,
        toUserId,
      });
      //@Vishakha950834
      if (existingRequest) {
        throw new Error("Request already sent to this mentor");
      }

      //Create new request
      const connectionRequest = new ConnectionRequestModel({
        fromUserId,
        toUserId,
        status,
      });

      const data = await connectionRequest.save();

      return res.json({
        message: req.user.firstName + " is "+ status + " in " + toUser.firstName ,
        data,
      });

    } catch (err) {
      return res.status(400).send("ERROR : " + err.message);
    }
  }
);

module.exports = requestRouter;
