const express = require("express");
const { userAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const contentRouter = express.Router();
contentRouter.post("/upload", userAuth, upload.single("media"), (req, res) => {
  if (req.user.role !== "mentor") {
    return res.status(403).json({ message: "Only mentor allowed" });
  }
  if (!req.file) {
    return res.status(400).json({ message: "Media required" });
  }
  res.json({ mediaUrl: req.file.location });
});

module.exports = contentRouter;