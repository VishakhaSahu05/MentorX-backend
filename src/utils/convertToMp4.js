const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const convertToMp4 = (inputPath) => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      path.dirname(inputPath),
      `converted-${Date.now()}.mp4`
    );

    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions("-movflags faststart")
      .format("mp4")
      .save(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject);
  });
};

module.exports = { convertToMp4 };
