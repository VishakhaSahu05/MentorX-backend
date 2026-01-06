const Post = require("../models/post");
exports.getFeed = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Feed is only available for students",
      });
    }
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate("mentor", "_id firstName lastName profilePic role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const cleanPosts = posts.filter((post) => post.mentor);
    res.json({
      page,
      postsPerPage: limit,
      count: cleanPosts.length,
      posts: cleanPosts,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load the feed" });
  }
};
