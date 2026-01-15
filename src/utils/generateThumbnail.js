const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

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
      .on("end", () => resolve(thumbPath))
      .on("error", reject);
  });
};

module.exports = { generateThumbnail };
