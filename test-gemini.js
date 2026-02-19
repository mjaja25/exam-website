const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyBVbtoIW7CcJ8YLmaoTUCHEsV453Mpe7Ag');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function test() {
  console.log('Calling Gemini...');
  try {
    const result = await model.generateContent('Say hello in 3 words');
    console.log('Response:', result.response.text());
  } catch (err) {
    console.error('Gemini Error:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
  }
  process.exit(0);
}

test();
