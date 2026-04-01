import { gasProvider, GAS_URL, callGAS } from '../providers/gasProvider';
import { seedData } from '../providers/mockProvider';
import LZString from 'lz-string';

export async function initialSyncToGAS() {
  const stored = localStorage.getItem('lms_data');
  let data;
  try {
    if (stored) {
      if (stored.startsWith('{') || stored.startsWith('[')) {
        data = JSON.parse(stored);
      } else {
        const decompressed = LZString.decompressFromUTF16(stored);
        if (decompressed) {
          data = JSON.parse(decompressed);
        } else {
          const oldDecompressed = LZString.decompress(stored);
          data = oldDecompressed ? JSON.parse(oldDecompressed) : seedData();
        }
      }
    } else {
      data = seedData();
    }
  } catch (e) {
    console.error("Error parsing stored data:", e);
    data = seedData();
  }
  
  console.log('Starting sync to Google Sheets...');
  
  try {
    await callGAS('sync_all', data);
    console.log('Sync completed successfully!');
  } catch (error) {
    console.error('Failed to sync all data:', error);
    throw error;
  }
}
