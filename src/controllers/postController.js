const Post = require("../models/post");
exports.createPost = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Only mentor allowed" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Media required" });
    }

    const post = await Post.create({
      mentor: req.user._id,
      mediaUrl: req.file.location,
      caption: req.body.caption || "",
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
