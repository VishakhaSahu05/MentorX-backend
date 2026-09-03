const fs = require("fs");
const uploadFileToS3 = require("../utils/uploadFileToS3");
exports.uploadVoice = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No audio file uploaded" });
    }

    // multer temp file
    const tempPath = req.file.path;

    // S3 key (folder + filename)
    const s3Key = `voice/${Date.now()}.webm`;

    // Upload to S3
    const s3Url = await uploadFileToS3(
      tempPath,
      s3Key,
      req.file.mimetype
    );

    // 4️⃣ DELETE TEMP FILE (MOST IMPORTANT)
    fs.unlinkSync(tempPath);

    // 5️⃣ Return S3 URL
    return res.status(200).json({
      audioUrl: s3Url,
    });
  } catch (err) {
    console.error("Upload voice error:", err);
    return res.status(500).json({ message: "Voice upload failed" });
  }
};
