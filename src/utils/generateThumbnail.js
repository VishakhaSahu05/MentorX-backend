const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const generateThumbnail = (videoPath) => {
  return new Promise((resolve, reject) => {
    const thumbPath = path.join(
      __dirname,
      `thumb-${Date.now()}.png`
    );

    ffmpeg(videoPath)
      .screenshots({
        timestamps: ["1"],
        filename: path.basename(thumbPath),
        folder: path.dirname(thumbPath),
        size: "400x?"
      })
      .on("end", () => {
        console.log("Thumbnail generated:", thumbPath);
        resolve(thumbPath);
      })
      .on("error", (err) => {
        console.error("Thumbnail error:", err);
        reject(err);
      });
  });
};

module.exports = { generateThumbnail };