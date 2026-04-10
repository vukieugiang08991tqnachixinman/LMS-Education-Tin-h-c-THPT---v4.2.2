import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { dataProvider } from '../../core/provider';
import { Announcement } from '../../core/types';
import { Bell, Calendar, Inbox, Sparkles } from 'lucide-react';

export const StudentAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const ann = await dataProvider.getList<Announcement>('announcements');
        const currentUser = dataProvider.getCurrentUser();
        const filteredAnn = ann.filter(a => 
          a.target === 'all' || 
          a.target === 'students' || 
          (currentUser?.classId && a.target === currentUser.classId)
        ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setAnnouncements(filteredAnn);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
          <p className="text-slate-500 font-medium animate-pulse">Đang cập nhật thông báo...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-8 max-w-5xl mx-auto space-y-10 pb-20"
    >
      <header>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-3">
          <Bell size={14} />
          <span>Bản tin trường học</span>
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Thông báo</h1>
        <p className="text-slate-500 mt-2 text-lg">Cập nhật những tin tức mới nhất từ nhà trường và thầy cô.</p>
      </header>

      <div className="grid gap-6">
        {announcements.map((ann, idx) => (
          <motion.div 
            key={ann.id} 
            variants={itemVariants}
            whileHover={{ x: 4 }}
            className="group relative bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 transition-all hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50"
          >
            <div className="flex items-start gap-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'
              }`}>
                {idx === 0 ? <Sparkles size={28} /> : <Bell size={28} />}
              </div>
              
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{ann.title}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl">
                    <Calendar size={14} />
                    {new Date(ann.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                
                <div 
                  className="text-slate-600 leading-relaxed text-lg"
                  dangerouslySetInnerHTML={{ __html: String(ann.content || '') }}
                />
                
                {idx === 0 && (
                  <div className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                    <Sparkles size={12} />
                    Tin mới nhất
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {announcements.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-24 bg-white/60 backdrop-blur-xl rounded-[3rem] border-2 border-dashed border-indigo-100 shadow-sm text-center"
          >
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20"></div>
              <div className="relative w-full h-full bg-gradient-to-tr from-indigo-50 to-white rounded-full flex items-center justify-center shadow-inner border border-indigo-50">
                <Inbox className="h-14 w-14 text-indigo-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center animate-bounce" style={{ animationDelay: '0.6s' }}>
                <Bell className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-slate-800 mb-3 font-display">Hộp thư trống</h3>
            <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed">Hiện tại chưa có thông báo mới nào dành cho bạn.</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
