const User = require("../models/user");
const Post = require("../models/post");
const Connection = require("../models/connectionRequest");

const getDashboard = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const loggedInUserId = req.user._id;
    const dashboardUserId = req.params.userId || loggedInUserId;

    const isOwner =
      loggedInUserId.toString() === dashboardUserId.toString();

    const rating = 4.6;

    const [user, posts, followersCount] = await Promise.all([
      User.findById(dashboardUserId),
      Post.find({ mentor: dashboardUserId }).sort({ createdAt: -1 }),
      Connection.countDocuments({
        toUserId: dashboardUserId,
        status: "accepted",
      }),
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      view: isOwner ? "OWNER" : "PUBLIC",
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        skills: user.skills,
        profilePic: user.profilePic,
        department: user.department,
      },
      stats: {
        followersCount,
        rating,
      },
      posts,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR ", err);
    return res.status(500).json({
      error: "Failed to load dashboard",
    });
  }
};

module.exports = { getDashboard };
