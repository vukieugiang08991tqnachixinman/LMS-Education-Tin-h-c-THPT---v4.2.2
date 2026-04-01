import fetch from 'node-fetch';
const url = 'https://script.google.com/macros/s/AKfycbxwfEbYeNMTEm9V_Pd6y-HwFkGmjrg7P6C9nc52qjNZSfxyrQy7XyNVSf6WuAGNFKkE/exec';
async function test() {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'fetch_all' }),
      redirect: 'follow'
    });
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 100));
  } catch (e) {
    console.error(e);
  }
}
test();
