const Post = require("../models/post");
const { generateThumbnail } = require("../utils/generateThumbnail");
const uploadFileToS3 = require("../utils/uploadFileToS3");
const safeUnlink = require("../utils/safeUnlink");

exports.createPost = async (req, res) => {
  const safeName = req.file.originalname
    .replace(/\s+/g, "_") // spaces remove
    .replace(/[^a-zA-Z0-9._-]/g, ""); // special chars remove

  let thumbPath;

  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Only mentor allowed" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Media required" });
    }

    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";

    // 1️⃣ Upload main media

    const mediaUrl = await uploadFileToS3(
      req.file.path,
      `${mediaType}s/${Date.now()}-${safeName}`,
      req.file.mimetype
    );

    let thumbnailUrl = null;

    // 2️⃣ Video → generate + upload thumbnail
    if (mediaType === "video") {
      thumbPath = await generateThumbnail(req.file.path);

      thumbnailUrl = await uploadFileToS3(
        thumbPath,
        `thumbnails/${Date.now()}.png`,
        "image/png"
      );
    }

    // 3️⃣ Save DB
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
    // 4️⃣ ALWAYS cleanup local temp files
    safeUnlink(req.file?.path);
    safeUnlink(thumbPath);
  }
};
