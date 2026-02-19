const https = require('https');

const data = JSON.stringify({ email: 'test@test.com', password: 'wrongpassword123' });

const options = {
  hostname: 'nssbcptbeta.onrender.com',
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', e => console.error('Error:', e.message));
req.setTimeout(15000, () => { console.log('TIMEOUT - server still not responding'); req.destroy(); });
req.write(data);
req.end();
