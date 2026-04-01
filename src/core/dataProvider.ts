import { User, Class, Subject, Topic, Lesson, Assignment, Test, Submission, Progress, Announcement, Badge } from './types';

export interface DataProvider {
  // Auth
  login(username: string, role: 'teacher' | 'student', password?: string): Promise<User | null>;
  getCurrentUser(): User | null;
  logout(): void;

  // Generic CRUD-like
  getList<T>(resource: string, params?: any): Promise<T[]>;
  getOne<T>(resource: string, id: string): Promise<T>;
  create<T>(resource: string, data: any): Promise<T>;
  createMany?<T>(resource: string, data: any[]): Promise<T[]>;
  update<T>(resource: string, id: string, data: any): Promise<T>;
  delete(resource: string, id: string): Promise<void>;

  // Specific Actions
  submitAssignment(submission: Omit<Submission, 'id' | 'submittedAt'>): Promise<Submission>;
  gradeSubmission(submissionId: string, score: number, feedback: string): Promise<Submission>;
  getStudentReport(studentId: string): Promise<any>;
  getClassReport(classId: string): Promise<any>;
  syncWithGAS(): Promise<void>;
  fetchAll?(): Promise<any>;
  callGAS?(action: string, payload: any): Promise<any>;
  testConnection(): Promise<{ ok: boolean, message: string }>;

  // Gamification
  awardXP(userId: string, amount: number): Promise<User>;
  awardBadge(userId: string, badge: Omit<Badge, 'unlockedAt'>): Promise<User>;
  getLeaderboard(): Promise<User[]>;
}
