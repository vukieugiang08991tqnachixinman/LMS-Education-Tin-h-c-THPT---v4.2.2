import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { dataProvider } from '../core/provider';
import { LogOut, Home, BookOpen, Users, FileText, Bell, ChevronLeft, GraduationCap, Menu, X, Trophy, Zap, Star, Code } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = dataProvider.getCurrentUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    dataProvider.logout();
    navigate('/');
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Đang tải...</div>;
  }

  const isAdmin = user.role === 'teacher';
  const menuItems = isAdmin ? [
    { name: 'Bảng điều khiển', path: '/admin', icon: <Home size={20} /> },
    { name: 'Quản lý Lớp học', path: '/admin/classes', icon: <Users size={20} /> },
    { name: 'Quản lý Học sinh', path: '/admin/students', icon: <GraduationCap size={20} /> },
    { name: 'Môn học & Chủ đề', path: '/admin/subjects', icon: <BookOpen size={20} /> },
    { name: 'Bài giảng', path: '/admin/lessons', icon: <FileText size={20} /> },
    { name: 'Bài tập', path: '/admin/assignments', icon: <FileText size={20} /> },
    { name: 'Ngân hàng câu hỏi', path: '/admin/question-bank', icon: <FileText size={20} /> },
    { name: 'Kiểm tra & Đánh giá', path: '/admin/tests', icon: <FileText size={20} /> },
    { name: 'Báo cáo & Thống kê', path: '/admin/reports', icon: <FileText size={20} /> },
    { name: 'Thông báo', path: '/admin/announcements', icon: <Bell size={20} /> },
  ] : [
    { name: 'Bảng điều khiển', path: '/app', icon: <Home size={20} /> },
    { name: 'Bài học của tôi', path: '/app/lessons', icon: <BookOpen size={20} /> },
    { name: 'Bài tập', path: '/app/assignments', icon: <FileText size={20} /> },
    { name: 'Kiểm tra', path: '/app/tests', icon: <FileText size={20} /> },
    { name: 'Trình biên dịch', path: '/app/code-editor', icon: <Code size={20} /> },
    { name: 'Bảng xếp hạng', path: '/app/leaderboard', icon: <Trophy size={20} /> },
    { name: 'Thông báo', path: '/app/announcements', icon: <Bell size={20} /> },
  ];

  const activeItem = menuItems.find(item => 
    location.pathname === item.path || 
    (item.path !== '/admin' && item.path !== '/app' && location.pathname.startsWith(item.path))
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-indigo-600 leading-tight">
              LMS Tin Học THPT
            </h1>
            <p className="text-xs text-gray-500 mt-1">Trường THCS và THPT Nà Chì</p>
          </div>
          <button 
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && item.path !== '/app' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className={isActive ? 'text-indigo-600' : 'text-gray-400'}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-4 p-2 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
              {user.fullName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user.fullName}</p>
              {!isAdmin && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-black text-indigo-600 flex items-center gap-0.5">
                    <Star size={10} fill="currentColor" />
                    Lv.{user.level || 1}
                  </span>
                  <span className="text-[10px] font-black text-amber-600 flex items-center gap-0.5">
                    <Zap size={10} fill="currentColor" />
                    {user.xp || 0} XP
                  </span>
                </div>
              )}
              {isAdmin && <p className="text-xs text-gray-500">Giáo viên</p>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <button 
              onClick={handleBack}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Quay lại"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 truncate max-w-[150px] sm:max-w-none">
              {activeItem?.name || 'Chi tiết'}
            </h2>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-50/50">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
