import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { dataProvider } from '../../core/provider';
import { Lesson, Assignment, Announcement, Topic, Class } from '../../core/types';
import { BookOpen, FileText, Bell, CheckCircle, Clock, Sparkles, ArrowRight, Trophy, Target, Zap, Star, Award } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [les, ass, ann, top, classes] = await Promise.all([
        dataProvider.getList<Lesson>('lessons'),
        dataProvider.getList<Assignment>('assignments'),
        dataProvider.getList<Announcement>('announcements'),
        dataProvider.getList<Topic>('topics'),
        dataProvider.getList<Class>('classes')
      ]);
      const currentUser = dataProvider.getCurrentUser();
      const filteredAnn = ann.filter(a => 
        a.target === 'all' || 
        a.target === 'students' || 
        (currentUser?.classId && a.target === currentUser.classId)
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const uClass = classes.find(c => String(c.id) === String(currentUser?.classId));
      
      const filteredAssignments = ass.filter(a => {
        if (!currentUser) return false;
        
        let studentIds: any = a.studentIds;
        if (typeof studentIds === 'string') {
          try {
            studentIds = JSON.parse(studentIds);
          } catch (e) {
            studentIds = studentIds.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
        
        const sIds = studentIds as string[] | undefined;
        if (sIds && sIds.some(id => String(id) === String(currentUser.id))) return true;
        if (a.classId && String(a.classId) === String(currentUser.classId) && (!sIds || sIds.length === 0)) return true;
        if (a.grade && uClass && String(a.grade) === String(uClass.grade) && !a.classId && (!sIds || sIds.length === 0)) return true;
        
        if (a.lessonId && !a.classId && !a.grade && (!studentIds || studentIds.length === 0)) {
          const lesson = les.find(l => String(l.id) === String(a.lessonId));
          if (lesson && String(lesson.status).toLowerCase() === 'published') {
            if (lesson.classId && String(lesson.classId).trim() !== '' && String(lesson.classId) !== String(currentUser.classId)) return false;
            if (lesson.grade && String(lesson.grade).trim() !== '' && uClass && String(lesson.grade) !== String(uClass.grade)) return false;
            return true;
          }
          return false;
        }
        return false;
      });
      
      const filteredLessons = les.filter(l => {
        if (String(l.status).trim().toLowerCase() !== 'published') return false;
        if (l.classId && String(l.classId).trim() !== '' && String(l.classId) !== String(currentUser?.classId)) return false;
        if (l.grade && String(l.grade).trim() !== '') {
          if (!uClass || String(l.grade) !== String(uClass.grade)) return false;
        }
        return true;
      });
      
      setLessons(filteredLessons);
      setAssignments(filteredAssignments);
      setAnnouncements(filteredAnn);
      setTopics(top);
      setLoading(false);
    };
    
    const syncAndFetch = async () => {
      try {
        await dataProvider.syncWithGAS();
      } catch (e: any) {
        if (e.message !== 'GAS_NOT_CONFIGURED') {
          console.error("Sync error:", e);
        }
      }
      fetchData();
    };
    syncAndFetch();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lms_data') {
        fetchData();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
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
          <p className="text-slate-500 font-medium animate-pulse">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-12"
    >
      {/* Hero Welcome Section */}
      <motion.div 
        variants={itemVariants}
        className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 rounded-[3rem] p-8 sm:p-12 text-white shadow-2xl shadow-purple-200/50"
      >
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Sparkles size={16} className="text-yellow-300" />
            <span>Hành trình học tập mới đang chờ bạn ✨</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Chào nhé, <span className="text-yellow-300">{dataProvider.getCurrentUser()?.fullName}</span>! 👋
          </h2>
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2 border border-white/10">
              <Star size={16} className="text-yellow-300" />
              Cấp độ {dataProvider.getCurrentUser()?.level || 1}
            </div>
            <div className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2 border border-white/10">
              <Zap size={16} className="text-amber-300" />
              {dataProvider.getCurrentUser()?.xp || 0} XP
            </div>
          </div>
          <p className="text-indigo-50 mb-8 text-lg opacity-90">
            Hôm nay là một ngày tuyệt vời để khám phá thêm những kiến thức thú vị về Tin học. Bạn đã sẵn sàng chưa? 🚀
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => navigate('/app/lessons')}
              className="bg-white text-indigo-700 px-8 py-4 rounded-2xl font-bold hover:bg-indigo-50 transition-all shadow-lg hover:shadow-white/20 flex items-center gap-2 group"
            >
              Học bài tiếp theo
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => navigate('/app/leaderboard')}
              className="bg-white/20 border border-white/30 backdrop-blur-sm text-white px-8 py-4 rounded-2xl font-bold hover:bg-white/30 transition-all"
            >
              Xem bảng xếp hạng 🏆
            </button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-fuchsia-400/20 rounded-full blur-3xl"></div>
        <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden lg:block">
          <div className="relative">
            <div className="w-64 h-64 bg-white/10 backdrop-blur-xl rounded-[3.5rem] border border-white/20 flex items-center justify-center rotate-12">
              <BookOpen size={120} className="text-white/40 -rotate-12" />
            </div>
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-yellow-400 rounded-3xl shadow-xl flex items-center justify-center -rotate-12 animate-bounce">
              <Trophy size={48} className="text-indigo-900" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Achievements Card (Indigo) */}
        <motion.div variants={itemVariants} className="md:col-span-2 bento-card bg-indigo-50/50 border-indigo-100 hover:border-indigo-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <Award size={20} />
              </div>
              <h3 className="text-xl font-black text-slate-900">🏆 Thành tích của bạn</h3>
            </div>
            <button 
              onClick={() => navigate('/app/leaderboard')}
              className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-widest"
            >
              Bảng xếp hạng <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-white rounded-2xl border border-indigo-50 shadow-sm">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Cấp độ</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600">{dataProvider.getCurrentUser()?.level || 1}</span>
                <span className="text-xs font-bold text-slate-400">Học viên</span>
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-indigo-50 shadow-sm">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Kinh nghiệm</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600">{dataProvider.getCurrentUser()?.xp || 0}</span>
                <span className="text-xs font-bold text-slate-400">XP</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Huy hiệu đã đạt được ({dataProvider.getCurrentUser()?.badges?.length || 0})</p>
            <div className="flex flex-wrap gap-3">
              {dataProvider.getCurrentUser()?.badges?.map(badge => (
                <div key={badge.id} className="group relative">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-indigo-100 shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform cursor-help">
                    {badge.icon}
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                    {badge.name}
                  </div>
                </div>
              ))}
              {(dataProvider.getCurrentUser()?.badges?.length || 0) === 0 && (
                <p className="text-xs text-slate-400 italic">Chưa có huy hiệu nào. Hãy cố gắng nhé!</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Stats - Tasks (Rose) */}
        <motion.div variants={itemVariants} className="bento-card flex flex-col justify-between bg-rose-50/50 border-rose-100 hover:border-rose-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
              <Target size={24} />
            </div>
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Nhiệm vụ 🎯</span>
          </div>
          <div>
            <h4 className="text-4xl font-black text-slate-900 mb-1">{assignments.length}</h4>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Bài tập đang chờ</p>
          </div>
        </motion.div>

        {/* Recent Lessons - Large Bento Item (Sky Blue) */}
        <motion.div variants={itemVariants} className="md:col-span-2 bento-card bg-sky-50/30 border-sky-100 hover:border-sky-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 text-sky-600 rounded-xl">
                <Zap size={20} />
              </div>
              <h3 className="text-xl font-black text-slate-900">📚 Bài học mới nhất</h3>
            </div>
            <button 
              onClick={() => navigate('/app/lessons')}
              className="text-xs font-black text-sky-600 hover:text-sky-800 flex items-center gap-1 uppercase tracking-widest"
            >
              Xem tất cả <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {lessons.slice(0, 2).map(lesson => {
              const topic = topics.find(t => t.id === lesson.topicId);
              return (
                <div 
                  key={lesson.id} 
                  onClick={() => navigate(`/app/lessons/${lesson.id}`)}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-sky-50 rounded-xl shadow-sm flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
                    <BookOpen size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-0.5">{topic?.name}</p>
                    <h4 className="font-bold text-slate-900 truncate">{lesson.title}</h4>
                  </div>
                  <div className="hidden sm:block">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-sky-600 group-hover:text-white transition-all">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Announcements - Vertical Bento Item (Violet) */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bento-card bg-violet-50/50 border-violet-100 hover:border-violet-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-violet-200 text-violet-700 rounded-xl">
              <Bell size={20} />
            </div>
            <h3 className="text-xl font-black text-violet-900">📢 Thông báo mới</h3>
          </div>
          <div className="space-y-6">
            {announcements.slice(0, 3).map(ann => (
              <div key={ann.id} className="relative pl-6 border-l-2 border-violet-300 hover:border-violet-500 transition-colors">
                <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-violet-500"></div>
                <h4 className="font-bold text-violet-900 text-sm mb-1">{ann.title}</h4>
                <p className="text-slate-600 text-sm line-clamp-2 leading-relaxed">{ann.content}</p>
                <p className="text-[10px] text-violet-500 mt-2 font-black uppercase tracking-widest">
                  {new Date(ann.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="text-center py-8 opacity-40">
                <Bell size={48} className="mx-auto mb-4 text-violet-400" />
                <p className="text-sm text-violet-900 font-medium">Không có thông báo mới</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Assignments - Another Bento Item (Amber) */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bento-card bg-amber-50/30 border-amber-100 hover:border-amber-200">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                <FileText size={20} />
              </div>
              <h3 className="text-xl font-black text-slate-900">✍️ Bài tập cần làm</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assignments.slice(0, 2).map(assignment => (
              <div key={assignment.id} className="p-5 rounded-[2rem] bg-white border border-amber-100 flex flex-col justify-between group hover:shadow-xl hover:border-amber-200 transition-all cursor-pointer" onClick={() => navigate('/app/assignments')}>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-amber-600 transition-colors">{assignment.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                    <Clock size={12} className="text-amber-500" />
                    <span>Hạn: {new Date(assignment.dueDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-widest">Chưa nộp</span>
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            ))}
            {assignments.length === 0 && (
              <div className="sm:col-span-2 text-center py-12 bg-white rounded-[2rem] border border-dashed border-amber-200">
                <CheckCircle size={48} className="mx-auto mb-4 text-amber-400" />
                <p className="text-slate-500 font-bold">Tuyệt vời! Bạn đã hoàn thành tất cả bài tập.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
