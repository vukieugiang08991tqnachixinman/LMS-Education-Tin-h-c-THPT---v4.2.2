const LZString = require('lz-string');
const json = JSON.stringify({a: 1});
try {
  const decompressed = LZString.decompress(json);
  console.log('decompressed:', decompressed);
} catch (e) {
  console.log('error:', e);
}
