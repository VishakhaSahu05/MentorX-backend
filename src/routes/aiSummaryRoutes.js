const express = require("express");
const router = express.Router();

const { summarizeConversation } = require("../controllers/aiSummaryController");
const { userAuth } = require("../middleware/auth");

router.post(
  "/conversation/:conversationId",
  userAuth,
  summarizeConversation
);

module.exports = router;