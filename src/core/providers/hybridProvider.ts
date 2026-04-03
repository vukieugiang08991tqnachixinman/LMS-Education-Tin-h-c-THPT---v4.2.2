import { DataProvider } from '../dataProvider';
import { User, Submission, Badge } from '../types';
import LZString from 'lz-string';

const STORAGE_KEY = 'lms_data';

const getData = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    // First check if it's plain JSON (starts with { or [)
    if (stored.startsWith('{') || stored.startsWith('[')) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse uncompressed stored data:', e);
      }
    }
    
    try {
      // Try to decompress UTF16 first (the correct way)
      const decompressed = LZString.decompressFromUTF16(stored);
      if (decompressed) {
        return JSON.parse(decompressed);
      }
      // Fallback to standard decompress in case it was saved with the old method
      const oldDecompressed = LZString.decompress(stored);
      if (oldDecompressed) {
        return JSON.parse(oldDecompressed);
      }
    } catch (e) {
      console.error('Failed to decompress stored data:', e);
    }
  }
  return null;
};

const saveData = (data: any) => {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = LZString.compressToUTF16(jsonString);
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (e) {
    console.error('Storage quota exceeded or failed to save:', e);
    // If compression still fails, try to save without compression as a last resort (unlikely to help if quota is reached)
    // Or just alert the user
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      alert('Dung lượng lưu trữ trình duyệt đã đầy. Vui lòng xóa bớt bài giảng hoặc bài nộp có dung lượng lớn.');
    }
  }
};

let currentUser: User | null = null;

export const hybridProvider: DataProvider = {
  login: async (username, role, password) => {
    let data = getData();
    
    // If local data is empty, seed it immediately
    if (!data || !data.users || data.users.length === 0) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
      saveData(data);
    }

    // GUARANTEE LOGIN FOR DEMO ACCOUNTS
    if (username === 'admin' && password === '123' && role === 'teacher') {
      let user = data?.users?.find((u: any) => u.username === 'admin');
      if (!user) {
         user = { id: 't1', username: 'admin', password: '123', fullName: 'Giáo viên Quản trị', role: 'teacher' };
         if (data && data.users) { data.users.push(user); saveData(data); }
      }
      currentUser = user;
      localStorage.setItem('lms_current_user', JSON.stringify(user));
      return user;
    }

    if (username === 'student' && password === '123' && role === 'student') {
      let user = data?.users?.find((u: any) => u.username === 'student');
      if (!user) {
         user = { id: 's1', username: 'student', password: '123', fullName: 'Học sinh Demo', role: 'student', classId: 'c1' };
         if (data && data.users) { data.users.push(user); saveData(data); }
      }
      currentUser = user;
      localStorage.setItem('lms_current_user', JSON.stringify(user));
      return user;
    }

    if (data && data.users) {
      const user = data.users.find((u: any) => String(u.username) === String(username) && String(u.role) === String(role) && String(u.password) === String(password));
      if (user) {
        currentUser = user;
        localStorage.setItem('lms_current_user', JSON.stringify(user));
        return user;
      }
    }
    
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
  },
  getCurrentUser: () => {
    if (currentUser) return currentUser;
    const stored = localStorage.getItem('lms_current_user');
    if (stored) {
      try {
        currentUser = JSON.parse(stored);
        return currentUser;
      } catch (e) {
        console.error("Error parsing current user:", e);
        return null;
      }
    }
    return null;
  },
  logout: () => {
    currentUser = null;
    localStorage.removeItem('lms_current_user');
  },

  getList: async <T>(resource: string, params?: any): Promise<T[]> => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
      saveData(data);
    }
    
    let list = data[resource] || [];
    if (params) {
      list = list.filter((item: any) => {
        for (const key in params) {
          if (item[key] !== params[key]) return false;
        }
        return true;
      });
    }
    return list;
  },
  getOne: async <T>(resource: string, id: string): Promise<T> => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
      saveData(data);
    }
    
    const list = data[resource] || [];
    const item = list.find((i: any) => i.id === id);
    if (!item) throw new Error('Not found');
    return item;
  },
  create: async <T>(resource: string, payload: any): Promise<T> => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
    }
    const newItem = { id: payload.id || Math.random().toString(36).substr(2, 9), ...payload };
    
    if (!data[resource]) data[resource] = [];
    data[resource].push(newItem);
    saveData(data);
    
    // Background sync to GAS
    import('./gasProvider').then(({ gasProvider }) => {
      gasProvider.create(resource, newItem).catch(err => console.warn('[Hybrid] Background create failed:', err));
    });
    
    return newItem;
  },
  createMany: async <T>(resource: string, payloads: any[]): Promise<T[]> => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
    }
    const newItems = payloads.map(payload => ({ id: payload.id || Math.random().toString(36).substr(2, 9), ...payload }));
    
    if (!data[resource]) data[resource] = [];
    data[resource].push(...newItems);
    saveData(data);

    // Background sync to GAS
    import('./gasProvider').then(({ gasProvider, mapToBackend }) => {
      // Use sync_all since sync_table might not be implemented in GAS
      const mappedData: any = {};
      Object.keys(data).forEach(resource => {
        mappedData[resource] = data[resource].map((item: any) => mapToBackend(resource, item));
      });
      gasProvider.callGAS?.('sync_all', mappedData).catch(err => console.warn('[Hybrid] Background createMany failed:', err));
    });
    
    return newItems as T[];
  },
  update: async <T>(resource: string, id: string, payload: any): Promise<T> => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
    }
    let fullUpdatedItem = { ...payload, id };
    
    const list = data[resource] || [];
    const index = list.findIndex((i: any) => i.id === id);
    if (index !== -1) {
      fullUpdatedItem = { ...list[index], ...payload };
      list[index] = fullUpdatedItem;
      saveData(data);

      // Background sync to GAS
      import('./gasProvider').then(({ gasProvider }) => {
        gasProvider.update(resource, id, fullUpdatedItem).catch(err => console.warn('[Hybrid] Background update failed:', err));
      });
    } else {
      throw new Error('Not found');
    }
    
    return fullUpdatedItem as T;
  },
  delete: async (resource: string, id: string): Promise<void> => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
    }
    
    const list = data[resource] || [];
    data[resource] = list.filter((i: any) => i.id !== id);
    saveData(data);

    // Background sync to GAS
    import('./gasProvider').then(({ gasProvider }) => {
      gasProvider.delete(resource, id).catch(err => console.warn('[Hybrid] Background delete failed:', err));
    });
  },

  submitAssignment: async (submission) => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
    }
    
    if (!data.submissions) data.submissions = [];
    const existingIndex = data.submissions.findIndex(
      (s: any) => s.studentId === submission.studentId && 
        ((submission.assignmentId && s.assignmentId === submission.assignmentId) || 
         (submission.testId && s.testId === submission.testId))
    );
    
    let newSubmission: Submission;
    if (existingIndex !== -1) {
      newSubmission = {
        ...data.submissions[existingIndex],
        ...submission,
        submittedAt: new Date().toISOString()
      };
      data.submissions[existingIndex] = newSubmission;
    } else {
      newSubmission = {
        ...submission,
        id: Math.random().toString(36).substr(2, 9),
        submittedAt: new Date().toISOString()
      };
      data.submissions.push(newSubmission);
    }
    
    saveData(data);

    // Background sync to GAS
    import('./gasProvider').then(({ gasProvider }) => {
      gasProvider.submitAssignment(newSubmission).catch(err => console.warn('[Hybrid] Background submitAssignment failed:', err));
    });

    return newSubmission;
  },
  gradeSubmission: async (submissionId, score, feedback) => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
    }
    let updated: any = null;
    
    const index = data.submissions.findIndex((s: any) => s.id === submissionId);
    if (index !== -1) {
      data.submissions[index] = { ...data.submissions[index], score, feedback };
      updated = data.submissions[index];
      saveData(data);

      // Background sync to GAS
      import('./gasProvider').then(({ gasProvider }) => {
        gasProvider.gradeSubmission(submissionId, score, feedback).catch(err => console.warn('[Hybrid] Background gradeSubmission failed:', err));
      });
    } else {
      throw new Error('Not found');
    }
    
    return updated;
  },
  getStudentReport: async (studentId) => {
    return { message: 'Báo cáo học sinh từ Local Storage' };
  },
  getClassReport: async (classId) => {
    return { message: 'Báo cáo lớp học từ Local Storage' };
  },
  syncWithGAS: async () => {
    try {
      const { gasProvider } = await import('./gasProvider');
      const allData = await gasProvider.fetchAll?.();
      if (allData) {
        saveData(allData);
        console.log('[Hybrid] Synced with GAS successfully');
      }
    } catch (error) {
      console.warn('[Hybrid] Sync with GAS failed, using local data:', error);
      throw error;
    }
  },
  testConnection: async () => {
    try {
      const { gasProvider } = await import('./gasProvider');
      const gasResult = await gasProvider.testConnection();
      return gasResult;
    } catch (error) {
      return { ok: false, message: `Lỗi kết nối Google Sheet: ${error instanceof Error ? error.message : String(error)}` };
    }
  },
  awardXP: async (userId: string, amount: number) => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
    }
    const userIndex = data.users.findIndex((u: any) => u.id === userId);
    if (userIndex === -1) throw new Error('User not found');
    
    const user = data.users[userIndex];
    user.xp = (user.xp || 0) + amount;
    user.level = Math.floor(Math.sqrt(user.xp / 100)) + 1;
    
    data.users[userIndex] = user;
    saveData(data);
    
    // Update current user if it's the one logged in
    if (currentUser && currentUser.id === userId) {
      currentUser = user;
      localStorage.setItem('lms_current_user', JSON.stringify(user));
    }
    
    return user;
  },
  awardBadge: async (userId: string, badge: Omit<Badge, 'unlockedAt'>) => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
    }
    const userIndex = data.users.findIndex((u: any) => u.id === userId);
    if (userIndex === -1) throw new Error('User not found');
    
    const user = data.users[userIndex];
    if (!Array.isArray(user.badges)) user.badges = [];
    
    // Check if badge already exists
    if (user.badges.some((b: any) => b.id === badge.id)) return user;
    
    const newBadge = { ...badge, unlockedAt: new Date().toISOString() };
    user.badges.push(newBadge);
    
    data.users[userIndex] = user;
    saveData(data);
    
    // Update current user if it's the one logged in
    if (currentUser && currentUser.id === userId) {
      currentUser = user;
      localStorage.setItem('lms_current_user', JSON.stringify(user));
    }
    
    return user;
  },
  getLeaderboard: async () => {
    let data = getData();
    if (!data) {
      const { seedData } = await import('./mockProvider');
      data = seedData();
      saveData(data);
    }
    return (data.users || []).filter((u: any) => u.role === 'student').sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0));
  }
};
