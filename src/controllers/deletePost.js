const Post = require("../models/post");
const { s3 } = require("../config/s3");

exports.deletePost = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        message: "Only mentors can delete post",
      });
    }
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    //Mentor can delete only own post
    if (post.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to delete this posts",
      });
    }
    //delete from S3
    const mediaUrl = post.mediaUrl;
    const key = mediaUrl.split(".com/")[1];
    await s3
      .deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      })
      .promise();
    //delete from MongoDb database
    await Post.findByIdAndDelete(postId);

    res.json({
      message: "Post deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to delete post",
    });
  }
};
