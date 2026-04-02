import { DataProvider } from '../dataProvider';
import { User, Class, Subject, Topic, Lesson, Assignment, Test, Submission, Progress, Announcement, Badge } from '../types';

export const GAS_URL = 'https://script.google.com/macros/s/AKfycbxwfEbYeNMTEm9V_Pd6y-HwFkGmjrg7P6C9nc52qjNZSfxyrQy7XyNVSf6WuAGNFKkE/exec';

let currentUser: User | null = null;

export async function callGAS(action: string, payload: any = {}) {
  console.log(`[GAS] Calling action: ${action}`, payload);
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action, payload }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      if (text.includes('LMS Backend') || text.trim().startsWith('<')) {
        console.warn(`[GAS] Backend is not configured to return JSON for ${action}. Falling back to local data.`);
        throw new Error('GAS_NOT_CONFIGURED');
      }
      console.error(`[GAS] Invalid JSON response for ${action}:`, text.substring(0, 100));
      throw new Error(`Invalid response from server. Expected JSON but got: ${text.substring(0, 50)}...`);
    }

    console.log(`[GAS] Response for ${action}:`, result);
    
    if (!result.ok) {
      throw new Error(result.error || 'Lỗi không xác định từ Google Script');
    }

    // Map backend fields with "Json" suffix back to frontend fields
    let finalData = result.data;
    if (action === 'fetch_all' && finalData) {
      Object.keys(finalData).forEach(tableName => {
        if (Array.isArray(finalData[tableName])) {
          finalData[tableName] = finalData[tableName].map((item: any) => {
            const newItem = { ...item };
            Object.keys(item).forEach(key => {
              if (key.endsWith('Json')) {
                const originalKey = key.replace('Json', '');
                try {
                  const val = item[key];
                  if (typeof val === 'string' && val.trim() !== '') {
                    newItem[originalKey] = JSON.parse(val);
                  } else if (typeof val === 'string') {
                    // Empty string or whitespace, default to array/object/string based on field
                    if (originalKey === 'correctAnswer' || originalKey === 'explanation') {
                      newItem[originalKey] = '';
                    } else {
                      newItem[originalKey] = tableName === 'users' || tableName === 'lessons' || tableName === 'assignments' || tableName === 'bank_questions' || tableName === 'tests' ? [] : {};
                    }
                  } else {
                    newItem[originalKey] = val;
                  }
                } catch (e) {
                  const val = item[key];
                  if (typeof val === 'string') {
                    if (val.trim().startsWith('[') || val.trim().startsWith('{')) {
                      newItem[originalKey] = val.trim().startsWith('[') ? [] : {};
                    } else {
                      newItem[originalKey] = val; // It's a raw string
                    }
                  } else {
                    newItem[originalKey] = [];
                  }
                }
                delete newItem[key];
              }
            });
            return newItem;
          });
        }
      });
    }

    return finalData;
  } catch (error: any) {
    if (error.message !== 'GAS_NOT_CONFIGURED') {
      console.error(`[GAS] Connection Error (${action}):`, error);
    }
    throw error;
  }
}

// Helper to map frontend record to backend schema (adding Json suffix where needed)
function mapToBackend(resource: string, record: any) {
  const mapped: any = { ...record };
  const jsonFields: Record<string, string[]> = {
    'users': ['badges'],
    'lessons': ['interactiveContent', 'essayQuestions'],
    'assignments': ['studentIds', 'attachments', 'questions'],
    'bank_questions': ['options', 'correctAnswer', 'subQuestions'],
    'tests': ['questions', 'assignedTo'],
    'progresses': ['quizScores', 'essayAnswers', 'teacherFeedback'],
    'reports': ['data']
  };

  if (jsonFields[resource]) {
    jsonFields[resource].forEach(field => {
      if (record[field] !== undefined) {
        mapped[`${field}Json`] = JSON.stringify(record[field]);
        delete mapped[field];
      }
    });
  }
  return mapped;
}

export const gasProvider: DataProvider = {
  login: async (username, role, password) => {
    const allData = await callGAS('fetch_all');
    const users = allData.users || [];
    const user = users.find((u: User) => String(u.username) === String(username) && String(u.role) === String(role) && String(u.password) === String(password));
    if (user) {
      // Sync all data from GAS to local storage on login
      localStorage.setItem('lms_data', JSON.stringify(allData));
      
      currentUser = user;
      localStorage.setItem('lms_current_user', JSON.stringify(user));
      return user;
    }
    return null;
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
    const allData = await callGAS('fetch_all');
    let list = allData[resource] || [];
    
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
    const allData = await callGAS('fetch_all');
    const list = allData[resource] || [];
    const item = list.find((i: any) => i.id === id);
    if (!item) throw new Error('Not found');
    return item;
  },
  create: async <T>(resource: string, payload: any): Promise<T> => {
    const newItem = { id: payload.id || Math.random().toString(36).substr(2, 9), ...payload };
    const record = mapToBackend(resource, newItem);
    await callGAS('upsert_record', { table: resource, record });
    return newItem;
  },
  update: async <T>(resource: string, id: string, payload: any): Promise<T> => {
    const record = mapToBackend(resource, { ...payload, id });
    await callGAS('upsert_record', { table: resource, record });
    return { ...payload, id } as T;
  },
  delete: async (resource: string, id: string): Promise<void> => {
    await callGAS('delete_record', { table: resource, id });
  },

  submitAssignment: async (submission) => {
    const newSubmission: Submission = {
      ...submission,
      id: (submission as any).id || Math.random().toString(36).substr(2, 9),
      submittedAt: new Date().toISOString()
    };
    await callGAS('upsert_record', { table: 'submissions', record: newSubmission });
    return newSubmission;
  },
  gradeSubmission: async (submissionId, score, feedback) => {
    const submission = await gasProvider.getOne<Submission>('submissions', submissionId);
    const updated = { ...submission, score, feedback };
    await callGAS('upsert_record', { table: 'submissions', record: updated });
    return updated;
  },
  getStudentReport: async (studentId) => {
    return { message: 'Báo cáo học sinh từ Google Sheet' };
  },
  getClassReport: async (classId) => {
    return { message: 'Báo cáo lớp học từ Google Sheet' };
  },
  fetchAll: async () => {
    return await callGAS('fetch_all');
  },
  callGAS: async (action, payload) => {
    return await callGAS(action, payload);
  },
  syncWithGAS: async () => {
    // gasProvider is already synced with GAS by definition
    return;
  },
  testConnection: async () => {
    try {
      const data = await callGAS('fetch_all');
      if (data) {
        return { ok: true, message: 'Kết nối Google Sheet thành công!' };
      }
      return { ok: false, message: 'Kết nối thành công nhưng không có dữ liệu.' };
    } catch (error) {
      return { ok: false, message: `Lỗi kết nối: ${error instanceof Error ? error.message : String(error)}` };
    }
  },
  awardXP: async (userId, amount) => {
    const user = await gasProvider.getOne<User>('users', userId);
    user.xp = (user.xp || 0) + amount;
    user.level = Math.floor(Math.sqrt(user.xp / 100)) + 1;
    await callGAS('upsert_record', { table: 'users', record: user });
    return user;
  },
  awardBadge: async (userId: string, badge: Omit<Badge, 'unlockedAt'>) => {
    const user = await gasProvider.getOne<User>('users', userId);
    if (!user.badges) user.badges = [];
    if (user.badges.some((b: any) => b.id === badge.id)) return user;
    const newBadge = { ...badge, unlockedAt: new Date().toISOString() };
    user.badges.push(newBadge);
    await callGAS('upsert_record', { table: 'users', record: user });
    return user;
  },
  getLeaderboard: async () => {
    const users = await gasProvider.getList<User>('users');
    return users.filter(u => u.role === 'student').sort((a, b) => (b.xp || 0) - (a.xp || 0));
  }
};
