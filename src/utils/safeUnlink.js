const fs = require("fs");

module.exports = function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.warn("⚠️ Failed to delete temp file:", filePath);
  }
};
