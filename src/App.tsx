import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { AdminDashboard } from './pages/admin/Dashboard';
import { ClassManagement } from './pages/admin/ClassManagement';
import { StudentManagement } from './pages/admin/StudentManagement';
import { SubjectManagement } from './pages/admin/SubjectManagement';
import { TestManagement } from './pages/admin/TestManagement';
import LessonManagement from './pages/admin/LessonManagement';
import { AssignmentManagement } from './pages/admin/AssignmentManagement';
import { TestSubmissions } from './pages/admin/TestSubmissions';
import { QuestionBank } from './pages/admin/QuestionBank';
import { Announcements } from './pages/admin/Announcements';
import { Reports } from './pages/admin/Reports';
import { StudentDashboard } from './pages/app/Dashboard';
import { StudentLessons } from './pages/app/StudentLessons';
import { StudentAssignments } from './pages/app/StudentAssignments';
import { LessonDetail } from './pages/app/LessonDetail';
import { StudentTests } from './pages/app/StudentTests';
import { TakeTest } from './pages/app/TakeTest';
import { TestResult } from './pages/app/TestResult';
import { StudentAnnouncements } from './pages/app/StudentAnnouncements';
import { Leaderboard } from './pages/app/Leaderboard';
import { CodeEditor } from './pages/app/CodeEditor';
import { dataProvider } from './core/provider';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode, allowedRole: 'teacher' | 'student' }) => {
  const user = dataProvider.getCurrentUser();
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (user.role !== allowedRole) {
    return <Navigate to={user.role === 'teacher' ? '/admin' : '/app'} replace />;
  }
  
  return <Layout>{children}</Layout>;
};

export default function App() {
  // Initialize and sync data on app load
  useEffect(() => {
    // Initial sync with GAS in background
    dataProvider.syncWithGAS().catch(err => {
      if (err.message !== 'GAS_NOT_CONFIGURED') {
        console.error('Initial sync error:', err);
      }
    });
    
    // Check if data exists, if not seed it (fallback if GAS is empty or fails)
    const stored = localStorage.getItem('lms_data');
    if (!stored) {
      import('./core/providers/mockProvider').then(({ seedData }) => {
        seedData();
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Admin Routes (Teacher) */}
        <Route path="/admin" element={<ProtectedRoute allowedRole="teacher"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/classes" element={<ProtectedRoute allowedRole="teacher"><ClassManagement /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute allowedRole="teacher"><StudentManagement /></ProtectedRoute>} />
        <Route path="/admin/subjects" element={<ProtectedRoute allowedRole="teacher"><SubjectManagement /></ProtectedRoute>} />
        <Route path="/admin/lessons" element={<ProtectedRoute allowedRole="teacher"><LessonManagement /></ProtectedRoute>} />
        <Route path="/admin/assignments" element={<ProtectedRoute allowedRole="teacher"><AssignmentManagement /></ProtectedRoute>} />
        <Route path="/admin/tests" element={<ProtectedRoute allowedRole="teacher"><TestManagement /></ProtectedRoute>} />
        <Route path="/admin/tests/:id/submissions" element={<ProtectedRoute allowedRole="teacher"><TestSubmissions /></ProtectedRoute>} />
        <Route path="/admin/question-bank" element={<ProtectedRoute allowedRole="teacher"><QuestionBank /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute allowedRole="teacher"><Announcements /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allowedRole="teacher"><Reports /></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute allowedRole="teacher"><div className="p-6 text-center text-gray-500">Tính năng đang được phát triển</div></ProtectedRoute>} />
        
        {/* App Routes (Student) */}
        <Route path="/app" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
        <Route path="/app/lessons" element={<ProtectedRoute allowedRole="student"><StudentLessons /></ProtectedRoute>} />
        <Route path="/app/assignments" element={<ProtectedRoute allowedRole="student"><StudentAssignments /></ProtectedRoute>} />
        <Route path="/app/lessons/:id" element={<ProtectedRoute allowedRole="student"><LessonDetail /></ProtectedRoute>} />
        <Route path="/app/tests" element={<ProtectedRoute allowedRole="student"><StudentTests /></ProtectedRoute>} />
        <Route path="/app/tests/:id/take" element={<ProtectedRoute allowedRole="student"><TakeTest /></ProtectedRoute>} />
        <Route path="/app/tests/:id/result" element={<ProtectedRoute allowedRole="student"><TestResult /></ProtectedRoute>} />
        <Route path="/app/code-editor" element={<ProtectedRoute allowedRole="student"><CodeEditor /></ProtectedRoute>} />
        <Route path="/app/leaderboard" element={<ProtectedRoute allowedRole="student"><Leaderboard /></ProtectedRoute>} />
        <Route path="/app/announcements" element={<ProtectedRoute allowedRole="student"><StudentAnnouncements /></ProtectedRoute>} />
        <Route path="/app/*" element={<ProtectedRoute allowedRole="student"><div className="p-6 text-center text-gray-500">Tính năng đang được phát triển</div></ProtectedRoute>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
