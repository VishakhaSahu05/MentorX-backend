const express = require("express");
const voiceRouter = express.Router();
const { upload } = require("../middleware/upload");
const { uploadVoice } = require("../controllers/voiceController");

// ✅ ONLY THIS ROUTE
voiceRouter.post(
  "/upload/voice",
  upload.single("voice"),
  uploadVoice
);

module.exports = voiceRouter;
