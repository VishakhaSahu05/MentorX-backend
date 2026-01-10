const express = require("express");
const userRouter = express.Router();
const { userAuth } = require("../middleware/auth");
const User = require("../models/user");
const Block = require("../models/block");
const ConnectionRequestModel = require("../models/connectionRequest");
const { getFeed } = require("../controllers/feedController");
const { getMyPosts } = require("../controllers/getMyPosts");
const { deletePost } = require("../controllers/deletePost");

userRouter.get("/user/requests/received", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    if (loggedInUser.role !== "mentor") {
      return res.status(403).json({
        message: "Only mentors can view pending requests",
      });
    }

    // Exclude blocked students
    const blockedStudents = await Block.find({
      blockedBy: loggedInUser._id,
    }).select("blockedUser");

    const blockedIds = blockedStudents.map((b) => b.blockedUser);

    const pendingRequests = await ConnectionRequestModel.find({
      toUserId: loggedInUser._id,
      status: "interested",
      fromUserId: { $nin: blockedIds },
    }).populate(
      "fromUserId",
      "firstName lastName profilePic skills about department"
    );

    return res.json({
      message:
        pendingRequests.length === 0
          ? "No pending requests"
          : "Pending requests fetched successfully",
      requests: pendingRequests,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET CONNECTIONS (STUDENT + MENTOR)
userRouter.get("/user/connection", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    let connections = [];

    // STUDENT → GET MENTORS
    if (loggedInUser.role === "student") {
      const data = await ConnectionRequestModel.find({
        fromUserId: loggedInUser._id,
        status: "accepted",
      }).populate(
        "toUserId",
        "firstName lastName emailId skills profilePic department"
      );

      connections = data.map((c) => c.toUserId);
    }

    // MENTOR → GET STUDENTS
    if (loggedInUser.role === "mentor") {
      const data = await ConnectionRequestModel.find({
        toUserId: loggedInUser._id,
        status: "accepted",
      }).populate(
        "fromUserId",
        "firstName lastName emailId skills profilePic department"
      );

      connections = data.map((c) => c.fromUserId);
    }

    return res.json({
      message: "Connections fetched successfully",
      count: connections.length,
      connections,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

//STUDENT FEED

userRouter.get("/feed", userAuth, getFeed);
userRouter.get("/my-posts", userAuth, getMyPosts);
userRouter.delete("/post/:postId", userAuth, deletePost);
// GET USER PROFILE BY ID (FOR CHAT / PROFILE)
userRouter.get("/user/profile/:userId", userAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select(
      "firstName lastName role profilePic skills about department"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      user,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

// BLOCK STUDENT (MENTOR)
userRouter.post("/user/block/:studentId", userAuth, async (req, res) => {
  try {
    const mentor = req.user;
    const studentId = req.params.studentId;

    if (mentor.role !== "mentor") {
      return res.status(403).json({
        message: "Only mentors can block students",
      });
    }

    if (mentor._id.equals(studentId)) {
      throw new Error("You cannot block yourself");
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      throw new Error("Invalid student");
    }

    const alreadyBlocked = await Block.findOne({
      blockedBy: mentor._id,
      blockedUser: studentId,
    });

    if (alreadyBlocked) {
      throw new Error("Student already blocked");
    }

    await Block.create({
      blockedBy: mentor._id,
      blockedUser: studentId,
    });

    // Remove requests/connections
    await ConnectionRequestModel.deleteMany({
      $or: [
        { fromUserId: studentId, toUserId: mentor._id },
        { fromUserId: mentor._id, toUserId: studentId },
      ],
    });

    return res.json({
      message: `${student.firstName} has been blocked successfully`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

userRouter.delete("/user/unblock/:studentId", userAuth, async (req, res) => {
  try {
    const mentor = req.user;
    const studentId = req.params.studentId;

    // Only mentor can unblock
    if (mentor.role !== "mentor") {
      return res.status(403).json({
        message: "Only mentors can unblock students",
      });
    }

    const result = await Block.findOneAndDelete({
      blockedBy: mentor._id,
      blockedUser: studentId,
    });

    if (!result) {
      return res.status(404).json({
        message: "User is not blocked",
      });
    }

    res.json({
      message: "User unblocked successfully",
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = userRouter;
