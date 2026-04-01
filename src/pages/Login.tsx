import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataProvider } from '../core/provider';
import { Flame } from 'lucide-react';

export const Login: React.FC = () => {
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    const user = dataProvider.getCurrentUser();
    if (user) {
      navigate(user.role === 'teacher' ? '/admin' : '/app');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const user = await dataProvider.login(username, role, password);
      
      if (user) {
        navigate(user.role === 'teacher' ? '/admin' : '/app');
      } else {
        setError('Tên đăng nhập, mật khẩu hoặc vai trò không đúng.');
      }
    } catch (err) {
      setError('Lỗi kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#5a5a5a] flex items-center justify-center p-4 font-sans">
      <div className="flex flex-col md:flex-row w-full max-w-4xl bg-white rounded-[40px] overflow-hidden shadow-2xl min-h-[550px] relative">
        
        {/* Green Background Shape (Desktop) */}
        <div className="hidden md:block absolute top-[-10%] left-[-15%] w-[65%] h-[120%] bg-[#1a7a53] rounded-[50%] z-0"></div>
        
        {/* Left Content */}
        <div className="w-full md:w-1/2 bg-[#1a7a53] md:bg-transparent text-white flex flex-col items-center justify-center p-10 z-10 relative">
          {/* Logo */}
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden p-2 border-4 border-white/20 backdrop-blur-sm">
            <img 
              src="/logo.png" 
              alt="Logo THCS & THPT Nà Chì" 
              className="w-full h-full object-contain drop-shadow-sm"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = 'https://ui-avatars.com/api/?name=LMS&background=fff&color=1a7a53&size=128';
              }}
            />
          </div>
          <h2 className="text-xl font-bold mb-8 tracking-wide text-center">THCS và THPT NÀ CHÌ</h2>
          
          <h1 className="text-3xl font-bold mb-3 text-center">CHÀO MỪNG BẠN TRỞ LẠI!</h1>
          <p className="text-center text-sm mb-10 px-4 opacity-90 leading-relaxed">
            Để duy trì kết nối với chúng tôi<br/>vui lòng đăng nhập bằng thông tin cá nhân của bạn
          </p>
          
          <div className="mt-12 text-[10px] opacity-70 tracking-widest uppercase">
            LMS Tin Học | THPT
          </div>
        </div>

        {/* Right Content */}
        <div className="w-full md:w-1/2 bg-white p-10 flex flex-col justify-center items-center z-10 relative">
          <h2 className="text-4xl font-bold text-[#1a7a53] mb-2">welcome</h2>
          <p className="text-gray-500 text-sm mb-8">Login in to your account to continue</p>
          
          <form className="w-full max-w-xs flex flex-col items-center" onSubmit={handleLogin}>
            {/* Role Selector */}
            <div className="flex w-full mb-6 bg-[#d1e7dd] rounded-full p-1">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${role === 'student' ? 'bg-[#1a7a53] text-white shadow-md' : 'text-[#1a7a53]'}`}
              >
                Học sinh
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${role === 'teacher' ? 'bg-[#1a7a53] text-white shadow-md' : 'text-[#1a7a53]'}`}
              >
                Giáo viên
              </button>
            </div>

            <input
              type="text"
              placeholder="Username........."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#d1e7dd] text-[#1a7a53] px-6 py-3.5 rounded-full mb-4 focus:outline-none text-center placeholder-[#1a7a53]/50 font-medium"
              required
            />
            
            <input
              type="password"
              placeholder="Password........."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#d1e7dd] text-[#1a7a53] px-6 py-3.5 rounded-full mb-2 focus:outline-none text-center placeholder-[#1a7a53]/50 font-medium"
              required
            />
            
            <a href="#" className="text-xs text-gray-400 mb-8 hover:text-[#1a7a53] transition-colors">Forgot your password?</a>
            
            {error && (
              <div className="text-red-500 text-xs mb-4 text-center w-full">
                {error}
              </div>
            )}

            {/* 3D Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="bg-[#1a7a53] text-white font-bold py-3 px-12 rounded-full shadow-[0_6px_0_#115e3e] hover:shadow-[0_4px_0_#115e3e] hover:translate-y-[2px] active:shadow-[0_0px_0_#115e3e] active:translate-y-[6px] transition-all tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'ĐANG ĐĂNG NHẬP...' : 'LOGIN'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
