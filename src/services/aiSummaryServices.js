const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const buildTranscript = (messages) => {
  if (!messages || messages.length === 0) return "";

  return messages
    .map((msg) => {
      const senderName =
        msg.senderId?.firstName ||
        msg.senderId?.name ||
        "Unknown";
      const content = msg.text || "";
      return `${senderName}: ${content}`;
    })
    .filter((line) => line.includes(": ") && !line.endsWith(": "))
    .join("\n");
};

const generateChatSummary = async (messages) => {
  if (!messages || messages.length === 0) throw new Error("NO_MESSAGES");

  const transcript = buildTranscript(messages);
  if (!transcript.trim()) throw new Error("EMPTY_TRANSCRIPT");

  const chatCompletion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: `You are an intelligent assistant that summarizes mentoring conversations.
Always respond in this EXACT format:

What Happened: <one or two sentence summary>

Important Points:
- <key point 1>
- <key point 2>
- <key point 3>

Action Items:
- <action item 1>
- <action item 2>

Rules:
- If no action items, write "• No specific action items identified."
- Keep points concise and clear.
- Focus on technical topics and tasks discussed.`,
      },
      {
        role: "user",
        content: `Summarize this mentoring chat:\n\n${transcript}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 1024,
  });

  const summary = chatCompletion.choices?.[0]?.message?.content;
  if (!summary) throw new Error("GROQ_EMPTY_RESPONSE");

  return summary.trim();
};

module.exports = { generateChatSummary, buildTranscript };