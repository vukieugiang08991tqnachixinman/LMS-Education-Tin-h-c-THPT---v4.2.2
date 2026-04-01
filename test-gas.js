const url = 'https://script.google.com/macros/s/AKfycbxwfEbYeNMTEm9V_Pd6y-HwFkGmjrg7P6C9nc52qjNZSfxyrQy7XyNVSf6WuAGNFKkE/exec';

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain;charset=utf-8',
  },
  body: JSON.stringify({ action: 'fetch_all' }),
})
.then(res => {
  console.log('Status:', res.status);
  return res.text();
})
.then(text => {
  console.log('Response:', text.substring(0, 200));
})
.catch(err => {
  console.error('Error:', err);
});
