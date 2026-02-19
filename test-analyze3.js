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
  },
  timeout: 60000
};

console.log('Sending...');
const start = Date.now();

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode, 'after', ((Date.now() - start)/1000).toFixed(1), 's');
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Body length:', data.length);
    console.log('Body preview:', data.substring(0, 500));
    process.exit(0);
  });
});

req.on('timeout', () => {
  console.log('Request timed out after 60s');
  req.destroy();
  process.exit(1);
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
