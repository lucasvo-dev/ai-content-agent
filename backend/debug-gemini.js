require("dotenv").config();
const { GeminiAIService } = require("./dist/services/GeminiAIService");

async function testGeminiParsing() {
  console.log(
    "🔑 Gemini API Key:",
    process.env.GEMINI_API_KEY ? "Present" : "Missing"
  );
  console.log("🔑 API Key length:", process.env.GEMINI_API_KEY?.length || 0);

  const geminiService = new GeminiAIService();

  const testRequest = {
    type: "social_media",
    topic: "TypeScript Tips",
    targetAudience: "Developers",
    keywords: ["typescript"],
    brandVoice: {
      tone: "casual",
      style: "conversational",
      vocabulary: "simple",
      length: "concise",
    },
    preferredProvider: "gemini",
  };

  try {
    console.log("🧪 Testing Gemini content generation...");
    const result = await geminiService.generateContent(testRequest);

    console.log("\n📊 Final Result:");
    console.log("Title:", result.title);
    console.log("Body length:", result.body.length);
    console.log("Body preview:", result.body.substring(0, 200) + "...");
    console.log("Excerpt:", result.excerpt);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testGeminiParsing();
