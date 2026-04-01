import { DataProvider } from '../dataProvider';
import { User, Class, Subject, Topic, Lesson, Assignment, Test, Submission, Progress, Announcement, BankQuestion, Badge } from '../types';
import LZString from 'lz-string';

const STORAGE_KEY = 'lms_data';

interface MockData {
  users: User[];
  classes: Class[];
  subjects: Subject[];
  topics: Topic[];
  lessons: Lesson[];
  assignments: Assignment[];
  tests: Test[];
  submissions: Submission[];
  progresses: Progress[];
  announcements: Announcement[];
  bank_questions: BankQuestion[];
}

export const seedData = (): MockData => {
  const data: MockData = {
    users: [
      { id: 't1', username: 'admin', password: '123', fullName: 'Giáo viên Quản trị', role: 'teacher' },
      { id: 's1', username: 'student', password: '123', fullName: 'Học sinh Demo', role: 'student', classId: 'c1', dob: '2008-05-15' },
      { id: 's2', username: 'hs_binh', password: '123', fullName: 'Lê Thanh Bình', role: 'student', classId: 'c1', dob: '2008-08-20' },
    ],
    classes: [
      { id: 'c1', name: '10A1', grade: 10, teacherId: 't1', teacherName: 'Nguyễn Văn A', academicYear: '2023-2024' },
      { id: 'c2', name: '10A2', grade: 10, teacherId: 't1', teacherName: 'Nguyễn Văn A', academicYear: '2023-2024' },
    ],
    subjects: [
      { id: 'sub1', name: 'Tin học 10 - Kết nối tri thức', description: 'Môn Tin học lớp 10 theo bộ sách Kết nối tri thức với cuộc sống' }
    ],
    topics: [
      { id: 'top1', subjectId: 'sub1', name: 'Chủ đề 1: Máy tính và xã hội tri thức', order: 1 },
      { id: 'top2', subjectId: 'sub1', name: 'Chủ đề 2: Mạng máy tính và Internet', order: 2 },
    ],
    lessons: [
      { 
        id: 'l1', 
        topicId: 'top1', 
        title: 'Bài 1: Thông tin và xử lý thông tin', 
        content: 'Yêu cầu cần đạt:\n- Nhận biết được thông tin và dữ liệu.\n- Hiểu được quá trình xử lý thông tin.', 
        order: 1, 
        status: 'published', 
        grade: '10',
        interactiveContent: [
          {
            id: 'b1',
            type: 'text',
            data: { content: 'Chào mừng các em đến với bài học đầu tiên của môn Tin học 10. Trong bài này, chúng ta sẽ tìm hiểu về khái niệm cơ bản nhất: Thông tin.' }
          },
          {
            id: 'b2',
            type: 'video',
            data: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: 'Video giới thiệu về xử lý thông tin' }
          },
          {
            id: 'b3',
            type: 'quiz',
            data: { 
              question: 'Dữ liệu sau khi được xử lý và mang lại ý nghĩa cho con người được gọi là gì?', 
              options: ['Thông tin', 'Tín hiệu', 'Vật mang tin', 'Tri thức'],
              correctAnswer: 'Thông tin'
            }
          },
          {
            id: 'b4',
            type: 'code',
            data: { 
              language: 'python', 
              content: 'print("Hello World")\n# Đây là ví dụ về xử lý thông tin trong lập trình' 
            }
          }
        ],
        essayQuestions: [
          {
            id: 'eq1',
            content: 'Em hãy nêu một ví dụ về thông tin và cách con người xử lý thông tin đó trong đời sống hàng ngày.'
          }
        ]
      },
      { id: 'l2', topicId: 'top1', title: 'Bài 2: Vai trò của thiết bị thông minh', content: 'Nội dung bài 2...', order: 2, status: 'draft', grade: '10' },
    ],
    assignments: [
      { id: 'a1', lessonId: 'l1', title: 'Bài tập: Phân biệt Dữ liệu và Thông tin', description: 'Hãy nêu 3 ví dụ phân biệt dữ liệu và thông tin.', dueDate: new Date(Date.now() + 86400000 * 7).toISOString() }
    ],
    tests: [
      { 
        id: 'test1', 
        title: 'Kiểm tra 15 phút Chủ đề 1', 
        topicId: 'top1',
        durationMinutes: 15, 
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 86400000 * 2).toISOString(),
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            content: 'Đâu là thiết bị đầu vào?',
            options: ['Màn hình', 'Bàn phím', 'Máy in', 'Loa'],
            correctAnswer: 'Bàn phím',
            points: 2.5
          }
        ],
        assignedTo: {
          type: 'class',
          ids: ['c1']
        },
        createdAt: new Date().toISOString()
      }
    ],
    submissions: [],
    progresses: [],
    announcements: [
      { id: 'ann1', target: 'all', title: 'Chào mừng năm học mới', content: 'Chúc các em học tốt môn Tin học!', createdAt: new Date().toISOString(), authorId: 't1' }
    ],
    bank_questions: [
      {
        id: 'bq1',
        subjectId: 'sub1',
        topicId: 'top1',
        type: 'multiple_choice',
        difficulty: 'recognition',
        content: 'Đâu là thiết bị đầu vào?',
        options: ['Màn hình', 'Bàn phím', 'Máy in', 'Loa'],
        correctAnswer: 'Bàn phím',
        points: 2.5,
        createdAt: new Date().toISOString()
      },
      {
        id: 'bq2',
        subjectId: 'sub1',
        topicId: 'top1',
        type: 'short_answer',
        difficulty: 'understanding',
        content: 'CPU là viết tắt của từ gì?',
        correctAnswer: 'Central Processing Unit',
        points: 2.5,
        createdAt: new Date().toISOString()
      }
    ]
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
};

const getData = (): MockData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    if (stored.startsWith('{') || stored.startsWith('[')) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing stored data:", e);
      }
    } else {
      try {
        const decompressed = LZString.decompressFromUTF16(stored);
        if (decompressed) {
          return JSON.parse(decompressed);
        }
        const oldDecompressed = LZString.decompress(stored);
        if (oldDecompressed) {
          return JSON.parse(oldDecompressed);
        }
      } catch (e) {
        console.error("Error parsing stored data:", e);
      }
    }
  }
  return seedData();
};

const saveData = (data: MockData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

let currentUser: User | null = null;

export const mockProvider: DataProvider = {
  login: async (username, role, password) => {
    const data = getData();
    const user = data.users.find(u => u.username === username && u.role === role && (!password || u.password === password));
    if (user) {
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
    const data = getData();
    let list = (data as any)[resource] || [];
    
    // Basic filtering
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
    const data = getData();
    const list = (data as any)[resource] || [];
    const item = list.find((i: any) => i.id === id);
    if (!item) throw new Error('Not found');
    return item;
  },
  create: async <T>(resource: string, payload: any): Promise<T> => {
    const data = getData();
    const newItem = { ...payload, id: Math.random().toString(36).substr(2, 9) };
    (data as any)[resource].push(newItem);
    saveData(data);
    return newItem;
  },
  update: async <T>(resource: string, id: string, payload: any): Promise<T> => {
    const data = getData();
    const list = (data as any)[resource] || [];
    const index = list.findIndex((i: any) => i.id === id);
    if (index === -1) throw new Error('Not found');
    const updatedItem = { ...list[index], ...payload };
    list[index] = updatedItem;
    saveData(data);
    return updatedItem;
  },
  delete: async (resource: string, id: string): Promise<void> => {
    const data = getData();
    const list = (data as any)[resource] || [];
    (data as any)[resource] = list.filter((i: any) => i.id !== id);
    saveData(data);
  },

  submitAssignment: async (submission) => {
    const data = getData();
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
    return newSubmission;
  },
  gradeSubmission: async (submissionId, score, feedback) => {
    const data = getData();
    const index = data.submissions.findIndex(s => s.id === submissionId);
    if (index === -1) throw new Error('Submission not found');
    data.submissions[index] = { ...data.submissions[index], score, feedback };
    saveData(data);
    return data.submissions[index];
  },
  getStudentReport: async (studentId) => {
    return { message: 'Báo cáo học sinh' };
  },
  getClassReport: async (classId) => {
    return { message: 'Báo cáo lớp học' };
  },
  syncWithGAS: async () => {
    return;
  },
  testConnection: async () => {
    return { ok: true, message: 'Mock connection is always OK' };
  },

  awardXP: async (userId, amount) => {
    const data = getData();
    const index = data.users.findIndex(u => u.id === userId);
    if (index === -1) throw new Error('User not found');
    const user = data.users[index];
    user.xp = (user.xp || 0) + amount;
    user.level = Math.floor(Math.sqrt(user.xp / 100)) + 1;
    data.users[index] = user;
    saveData(data);
    if (currentUser?.id === userId) {
      currentUser = user;
      localStorage.setItem('lms_current_user', JSON.stringify(user));
    }
    return user;
  },
  awardBadge: async (userId: string, badge: Omit<Badge, 'unlockedAt'>) => {
    const data = getData();
    const index = data.users.findIndex(u => u.id === userId);
    if (index === -1) throw new Error('User not found');
    const user = data.users[index];
    if (!user.badges) user.badges = [];
    if (user.badges.some(b => b.id === badge.id)) return user;
    const newBadge = { ...badge, unlockedAt: new Date().toISOString() };
    user.badges.push(newBadge);
    data.users[index] = user;
    saveData(data);
    if (currentUser?.id === userId) {
      currentUser = user;
      localStorage.setItem('lms_current_user', JSON.stringify(user));
    }
    return user;
  },
  getLeaderboard: async () => {
    const data = getData();
    return data.users.filter(u => u.role === 'student').sort((a, b) => (b.xp || 0) - (a.xp || 0));
  }
};
