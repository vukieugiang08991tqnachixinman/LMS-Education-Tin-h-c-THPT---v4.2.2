export type Role = 'teacher' | 'student';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: Role;
  classId?: string; // For students
  dob?: string; // Ngày sinh
  xp?: number;
  badges?: Badge[];
  level?: number;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
}

export interface Class {
  id: string;
  name: string;
  grade: number;
  teacherId: string;
  teacherName?: string; // Tên GVCN
  academicYear?: string; // Năm học
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  order: number;
}

export type InteractiveQuestionType = 'mcq' | 'true_false' | 'fill_in_the_blank' | 'drag_drop' | 'click_reveal';

export interface InteractiveQuestion {
  id: string;
  type: InteractiveQuestionType;
  question: string;
  options?: string[]; // For MCQ
  correctAnswer?: string | string[]; // For MCQ, True/False, Fill-in-the-blank
  explanation?: string;
}

export interface InteractiveBlock {
  id: string;
  type: 'text' | 'video' | 'quiz' | 'code' | 'image' | 'interactive_question';
  data: {
    content?: string;
    url?: string;
    language?: string; // for code
    question?: string; // for quiz
    options?: string[]; // for quiz
    correctAnswer?: string; // for quiz
    caption?: string; // for image/video
    interactiveQuestion?: InteractiveQuestion; // for interactive_question
  };
}

export interface TeacherFeedback {
  comment: string;
  date: string;
}

export interface EssayQuestion {
  id: string;
  content: string;
}

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  content: string;
  videoUrl?: string;
  pptUrl?: string;
  order: number;
  status: 'draft' | 'published';
  grade: string;
  classId?: string;
  interactiveContent?: InteractiveBlock[];
  essayQuestions?: EssayQuestion[];
}

export interface Assignment {
  id: string;
  lessonId?: string;
  title: string;
  description: string;
  dueDate: string;
  grade?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  studentIds?: string[];
  attachments?: string[];
  questions?: Question[];
  part1?: string;
  part2?: string;
  part3?: string;
  part4?: string;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
export type QuestionDifficulty = 'recognition' | 'understanding' | 'application';

export interface SubQuestion {
  id: string;
  content: string;
  difficulty: QuestionDifficulty;
  correctAnswer: boolean;
  explanation?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  difficulty?: QuestionDifficulty;
  content: string;
  options?: string[]; // For multiple choice
  correctAnswer?: string | boolean | Record<string, boolean>;
  subQuestions?: SubQuestion[]; // For true_false
  points: number;
  explanation?: string;
}

export interface BankQuestion extends Question {
  subjectId?: string;
  topicId?: string;
  createdAt: string;
}

export interface Test {
  id: string;
  title: string;
  topicId?: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  questions: Question[];
  assignedTo: {
    type: 'grade' | 'class';
    ids: string[]; // grade numbers or class ids
  };
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId?: string;
  testId?: string;
  studentId: string;
  content: string;
  part1Content?: string;
  part2Content?: string;
  part3Content?: string;
  part4Content?: string;
  fileName?: string;
  fileUrl?: string;
  submittedAt: string;
  score?: number;
  feedback?: string;
}

export interface Progress {
  id: string;
  studentId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: string;
  lastAccessed?: string;
  quizScores?: Record<string, number>;
  essayAnswers?: Record<string, string>;
  teacherFeedback?: TeacherFeedback;
}

export interface Announcement {
  id: string;
  target: string; // 'all', 'students', or classId
  title: string;
  content: string;
  createdAt: string;
  authorId: string;
}
