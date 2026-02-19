require('dotenv').config();
const axios = require('axios');

async function listModels() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        console.log("Available models:");
        response.data.models.forEach(m => {
            console.log(`- ${m.name} (${m.displayName})`);
        });
    } catch (error) {
        console.error("Failed to list models:", error.response?.data || error.message);
    }
}

listModels();
