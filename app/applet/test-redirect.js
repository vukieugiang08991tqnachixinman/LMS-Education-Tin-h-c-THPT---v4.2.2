const https = require('https');

const data = JSON.stringify({ action: 'fetch_all' });

const options = {
  hostname: 'script.google.com',
  path: '/macros/s/AKfycbxwfEbYeNMTEm9V_Pd6y-HwFkGmjrg7P6C9nc52qjNZSfxyrQy7XyNVSf6WuAGNFKkE/exec',
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain;charset=utf-8',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
