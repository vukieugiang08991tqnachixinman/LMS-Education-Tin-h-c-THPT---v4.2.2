import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { dataProvider } from '../../core/provider';
import { Test, Submission, Class } from '../../core/types';
import { Clock, FileText, CheckCircle, AlertCircle, Play, ArrowRight, Trophy, Calendar } from 'lucide-react';

export const StudentTests: React.FC = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [userClass, setUserClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentUser = dataProvider.getCurrentUser();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);

      try {
        const [allTests, allSubmissions, allClasses] = await Promise.all([
          dataProvider.getList<Test>('tests'),
          dataProvider.getList<Submission>('submissions', { studentId: currentUser.id }),
          dataProvider.getList<Class>('classes')
        ]);

        const myClass = allClasses.find(c => c.id === currentUser.classId);
        setUserClass(myClass || null);

        const myTests = allTests.filter(test => {
          if (!test.assignedTo) return false;
          if (test.assignedTo.type === 'class' && myClass) {
            return test.assignedTo.ids.map(String).includes(String(myClass.id));
          }
          if (test.assignedTo.type === 'grade' && myClass) {
            return test.assignedTo.ids.map(String).includes(String(myClass.grade));
          }
          return false;
        });

        setTests(myTests);
        setSubmissions(allSubmissions);
      } catch (error) {
        console.error("Error fetching tests:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const getTestStatus = (test: Test) => {
    const submission = submissions.find(s => s.testId === test.id);
    const now = new Date();
    const startTime = new Date(test.startTime);
    const endTime = new Date(test.endTime);

    if (submission) {
      return { 
        status: 'completed', 
        label: 'Đã hoàn thành', 
        color: 'bg-emerald-50 text-emerald-600', 
        icon: <CheckCircle size={14} /> 
      };
    }
    if (now < startTime) {
      return { 
        status: 'upcoming', 
        label: 'Sắp diễn ra', 
        color: 'bg-blue-50 text-blue-600', 
        icon: <Clock size={14} /> 
      };
    }
    if (now > endTime) {
      return { 
        status: 'missed', 
        label: 'Đã kết thúc', 
        color: 'bg-rose-50 text-rose-600', 
        icon: <AlertCircle size={14} /> 
      };
    }
    return { 
      status: 'active', 
      label: 'Đang diễn ra', 
      color: 'bg-amber-50 text-amber-600', 
      icon: <Play size={14} /> 
    };
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Đang chuẩn bị bài kiểm tra...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-8 max-w-7xl mx-auto space-y-10 pb-20"
    >
      <header>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-600 text-xs font-bold uppercase tracking-wider mb-3">
          <Trophy size={14} />
          <span>Đánh giá năng lực</span>
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Bài kiểm tra của tôi</h1>
        <p className="text-slate-500 mt-2 text-lg">Thử thách bản thân với các bài kiểm tra định kỳ.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tests.length > 0 ? tests.map(test => {
          const statusInfo = getTestStatus(test);
          const submission = submissions.find(s => s.testId === test.id);
          
          return (
            <motion.div 
              key={test.id} 
              variants={itemVariants}
              whileHover={{ y: -4 }}
              className="group relative bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 transition-all flex flex-col hover:border-indigo-300"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                  <FileText size={28} />
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${statusInfo.color}`}>
                  {statusInfo.icon} {statusInfo.label}
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors line-clamp-2">{test.title}</h3>
              
              <div className="space-y-3 mb-8 flex-1">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <Clock size={16} />
                  </div>
                  <span>Thời gian: <strong>{test.durationMinutes} phút</strong></span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <Calendar size={16} />
                  </div>
                  <span className="line-clamp-1">Hạn chót: <strong>{new Date(test.endTime).toLocaleString('vi-VN')}</strong></span>
                </div>
              </div>
              
              <div className="pt-6 border-t border-slate-50">
                {statusInfo.status === 'completed' ? (
                  <div className="flex justify-between items-center bg-emerald-50/50 p-4 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Kết quả</p>
                      <p className="text-2xl font-black text-emerald-700">
                        {submission?.score !== undefined ? `${submission.score}` : '--'} <span className="text-sm font-bold opacity-60">/ 10</span>
                      </p>
                    </div>
                    <button 
                      onClick={() => navigate(`/app/tests/${test.id}/result`)}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                    >
                      Chi tiết
                    </button>
                  </div>
                ) : statusInfo.status === 'active' ? (
                  <button 
                    onClick={() => navigate(`/app/tests/${test.id}/take`)}
                    className="w-full flex justify-center items-center gap-2 py-4 text-sm font-bold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group/btn"
                  >
                    <Play size={18} fill="currentColor" /> Bắt đầu làm bài
                    <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                ) : statusInfo.status === 'upcoming' ? (
                  <div className="text-center p-4 bg-blue-50 rounded-2xl">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Mở lúc</p>
                    <p className="text-sm font-bold text-blue-800">{new Date(test.startTime).toLocaleString('vi-VN')}</p>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-rose-50 rounded-2xl">
                    <p className="text-sm font-bold text-rose-600">Đã hết hạn làm bài</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        }) : (
          <div className="col-span-full py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="h-12 w-12 text-slate-300" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Không có bài kiểm tra</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">Hiện tại bạn không có bài kiểm tra nào cần thực hiện.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
