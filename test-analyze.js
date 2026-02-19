const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 'test123', role: 'user' },
  'Tadfjaklugbnmaw3485203u9ja',
  { expiresIn: '1h' }
);

async function test() {
  console.log('Sending request...');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const res = await fetch('http://localhost:3000/api/practice/typing-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        wpm: 45,
        accuracy: 92,
        duration: 120,
        errorCount: 8,
        errorDetails: 'a->s (3x)\ne->r (2x)',
        type: 'typing'
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Raw response:', text.substring(0, 500));
    try {
      const data = JSON.parse(text);
      console.log('Parsed:', JSON.stringify(data, null, 2).substring(0, 2000));
    } catch(e) {
      console.log('Not JSON');
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error('Fetch Error:', err.message || err);
  }
  process.exit(0);
}

test();
