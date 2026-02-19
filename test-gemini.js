require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testModel() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const result = await model.generateContent("Say OK if you are working.");
        console.log("Model response:", result.response.text());
        console.log("SUCCESS: gemini-3.0-flash is available.");
    } catch (error) {
        console.error("ERROR: gemini-3.0-flash is NOT available or API key is invalid.");
        console.error(error.message);
        
        // Let's also list available models
        try {
            console.log("\nAttempting to list models...");
            // The SDK might not have a direct listModels, but we can try common ones if this fails
        } catch (e) {}
    }
}

testModel();
