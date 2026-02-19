const http = require('http');
const https = require('https');

// Test the typing-analyze endpoint on local server
// First, get a token by logging in

const BASE = 'http://localhost:3000';

function post(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch(e) { resolve({ status: res.statusCode, data: d }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
}

async function main() {
    // Test typing-analyze without auth (should get 401 or similar)
    console.log('Testing typing-analyze without auth...');
    const r1 = await post(`${BASE}/api/practice/typing-analyze`, {
        wpm: 45, accuracy: 92, totalChars: 500, correctChars: 460,
        errorCount: 40, duration: 120, errorDetails: "'a' → 's' (5×)\n'e' → 'r' (3×)"
    });
    console.log('Status:', r1.status);
    console.log('Response:', JSON.stringify(r1.data).substring(0, 200));
    
    if (r1.status === 401 || r1.status === 403) {
        console.log('\nEndpoint requires auth (expected). Testing with auth...');
        // Try to login first
        const loginRes = await post(`${BASE}/api/auth/login`, {
            email: 'mhajan346@gmail.com',
            password: 'admin123'
        });
        console.log('Login status:', loginRes.status);
        
        if (loginRes.data.token) {
            const token = loginRes.data.token;
            console.log('Got token, testing typing-analyze...');
            
            const r2 = await post(`${BASE}/api/practice/typing-analyze`, {
                wpm: 45, accuracy: 92, totalChars: 500, correctChars: 460,
                errorCount: 40, duration: 120, errorDetails: "'a' → 's' (5×)\n'e' → 'r' (3×)"
            }, { 'Authorization': `Bearer ${token}` });
            
            console.log('Status:', r2.status);
            console.log('Response:', JSON.stringify(r2.data).substring(0, 500));
        } else {
            console.log('Login response:', JSON.stringify(loginRes.data).substring(0, 200));
        }
    }
}

main().catch(e => console.error(e)).finally(() => process.exit());
