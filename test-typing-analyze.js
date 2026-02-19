require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function testTypingAnalyze() {
    const email = `testuser_${Date.now()}@example.com`;
    const password = 'password123';
    
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            username: `user_${Date.now()}`,
            email: email,
            password: hashedPassword,
            isVerified: true
        });
        await user.save();
        console.log(`User ${email} created.`);

        console.log("Logging in...");
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            email: email,
            password: password
        }, { timeout: 5000 });
        const token = loginRes.data.token;
        console.log("Login successful. Token obtained.");

        console.log("Sending typing-analyze request...");
        const analyzeRes = await axios.post('http://localhost:3000/api/practice/typing-analyze', {
            wpm: 65,
            accuracy: 98,
            duration: 60,
            errorCount: 2,
            errorDetails: "Mistyped 'the' as 'teh', 'was' as 'wsa'",
            historicalProblemKeys: [{ key: 't', count: 5 }, { key: 'e', count: 3 }]
        }, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 30000 // 30s for AI
        });

        console.log("Analysis Result received!");
        console.log(JSON.stringify(analyzeRes.data, null, 2));
        console.log("SUCCESS: Typing analysis is working with gemini-3-flash-preview.");
    } catch (error) {
        if (error.response) {
            console.error("API ERROR:", error.response.status, error.response.data);
        } else {
            console.error("ERROR:", error.message);
        }
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

testTypingAnalyze();
