const Post = require("../models/post");
const { s3 } = require("../config/s3");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // helper to extract key safely
    const getKeyFromUrl = (url) =>
      decodeURIComponent(new URL(url).pathname.substring(1));

    // 🔹 delete main media (image / video)
    const mediaKey = getKeyFromUrl(post.mediaUrl);

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: mediaKey,
      })
    );

    // 🔹 delete thumbnail IF EXISTS (video case)
    if (post.mediaType === "video" && post.thumbnailUrl) {
      const thumbKey = getKeyFromUrl(post.thumbnailUrl);

      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: thumbKey,
        })
      );
    }

    await Post.findByIdAndDelete(postId);

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
