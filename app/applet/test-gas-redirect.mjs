import fetch from 'node-fetch';

const url = 'https://script.google.com/macros/s/AKfycbxwfEbYeNMTEm9V_Pd6y-HwFkGmjrg7P6C9nc52qjNZSfxyrQy7XyNVSf6WuAGNFKkE/exec';

async function test() {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action: 'fetch_all' }),
      redirect: 'manual'
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', response.headers.raw());
  } catch (e) {
    console.error(e);
  }
}

test();
