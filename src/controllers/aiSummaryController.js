const { Chat } = require("../models/chat"); 
const { generateChatSummary } = require("../services/aiSummaryServices");

const summarizeConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const chat = await Chat.findOne({
      participants: { $all: [req.user._id, conversationId] },
    })
      .populate("messages.senderId", "firstName lastName")
      .lean();

    if (!chat || !chat.messages || chat.messages.length === 0) {
      return res.status(200).json({
        success: true,
        summary:
          "What Happened: No messages found in this conversation.\n\nImportant Points:\n• This conversation has no messages yet.\n\nAction Items:\n• Start chatting to generate a summary.",
        messageCount: 0,
      });
    }

    // Latest 100 messages
    const messages = chat.messages.slice(-100);

    const summary = await generateChatSummary(messages);

    return res.status(200).json({
      success: true,
      summary,
      messageCount: messages.length,
    });
  } catch (error) {
    console.error("[AI Summary] Error:", error.status, error.message);

    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: "AI service is busy. Please try again in a moment.",
      });
    }

    if (error.status === 401 || error.status === 403) {
      console.error("[AI Summary] Groq authentication failed — check GROQ_API_KEY.");
      return res.status(503).json({
        success: false,
        error: "AI service is temporarily unavailable.",
      });
    }

    if (error.status === 404) {
      console.error("[AI Summary] Groq model not found — check the model name in aiSummaryServices.js.");
      return res.status(503).json({
        success: false,
        error: "AI service is temporarily unavailable.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to generate summary. Please try again.",
    });
  }
};

module.exports = { summarizeConversation };