const http = require('http');
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 'test123', role: 'user' }, 'Tadfjaklugbnmaw3485203u9ja', { expiresIn: '1h' });

const postData = JSON.stringify({ wpm: 45, accuracy: 92, duration: 120, errorCount: 8, errorDetails: 'a->s (3x)', type: 'typing' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/practice/typing-analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Body:', data.substring(0, 2000));
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
console.log('Request sent, waiting...');
