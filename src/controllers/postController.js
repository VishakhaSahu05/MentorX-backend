const Post = require("../models/post");
const { generateThumbnail } = require("../utils/generateThumbnail");
const uploadFileToS3 = require("../utils/uploadFileToS3");
const safeUnlink = require("../utils/safeUnlink");
const { convertToMp4 } = require("../utils/convertToMp4");

exports.createPost = async (req, res) => {
  if (req.user.role !== "mentor") {
    return res.status(403).json({ message: "Only mentor allowed" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Media required" });
  }

  let thumbPath;
  let finalPath = req.file.path;

  try {
    const isVideo = req.file.mimetype.startsWith("video");
    const mediaType = isVideo ? "video" : "image";

    // Convert ONLY video
    if (isVideo) {
      finalPath = await convertToMp4(req.file.path);
    }

    // Upload with correct path & content-type
    const mediaUrl = await uploadFileToS3(
      finalPath,
      `${mediaType}s/${Date.now()}${isVideo ? ".mp4" : ""}`,
      isVideo ? "video/mp4" : req.file.mimetype
    );

    let thumbnailUrl = null;

    // Thumbnail from FINAL video
    if (isVideo) {
      thumbPath = await generateThumbnail(finalPath);

      thumbnailUrl = await uploadFileToS3(
        thumbPath,
        `thumbnails/${Date.now()}.png`,
        "image/png"
      );
    }

    const post = await Post.create({
      mentor: req.user._id,
      mediaUrl,
      mediaType,
      thumbnailUrl,
      caption: req.body.caption || "",
    });

    res.status(201).json(post);
  } catch (err) {
    console.error("CREATE POST ERROR:", err);
    res.status(500).json({ message: err.message });
  } finally {
    
    safeUnlink(req.file?.path);
    safeUnlink(finalPath);
    safeUnlink(thumbPath);
  }
};
