const Post = require("../models/post");

exports.getMyPosts = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        message: "Only mentors can view their posts",
      });
    }

    const posts = await Post.find({ mentor: req.user._id })
      .sort({ createdAt: -1 }); 

    res.json({
      count: posts.length,
      posts,
    });

  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch mentor posts",
    });
  }
};
