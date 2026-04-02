import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, CheckCircle, Clock, ArrowRight, Star, Layers, PlayCircle, Video } from 'lucide-react';
import { dataProvider } from '../../core/provider';
import { Lesson, Subject, Topic, Progress } from '../../core/types';

export const StudentLessons = () => {
  const user = dataProvider.getCurrentUser();
  const navigate = useNavigate();
  
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncAndFetch = async () => {
      if (user) {
        await fetchData(); // Load immediately from local storage
        setLoading(false);
        
        try {
          await dataProvider.syncWithGAS();
          await fetchData(); // Refresh after sync
        } catch (e: any) {
          if (e.message !== 'GAS_NOT_CONFIGURED') {
            console.error("Sync error:", e);
          }
        }
      }
    };
    syncAndFetch();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lms_data') {
        fetchData();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    const [lesData, subData, topData, progData, classData] = await Promise.all([
      dataProvider.getList<Lesson>('lessons'),
      dataProvider.getList<Subject>('subjects'),
      dataProvider.getList<Topic>('topics'),
      dataProvider.getList<Progress>('progresses'),
      dataProvider.getList<any>('classes')
    ]);
    
    let uClass = null;
    if (user.classId) {
      uClass = classData.find(c => String(c.id) === String(user.classId));
    }

    const filteredLessons = lesData.filter(l => {
      if (String(l.status).trim().toLowerCase() !== 'published') return false;
      if (l.classId && String(l.classId).trim() !== '' && String(l.classId) !== String(user.classId)) return false;
      if (l.grade && String(l.grade).trim() !== '') {
        if (!uClass || String(l.grade) !== String(uClass.grade)) return false;
      }
      return true;
    });

    setLessons(filteredLessons);
    setSubjects(subData);
    setTopics(topData);
    setProgress(progData.filter(p => p.studentId === user.id));
  };

  const groupedLessons = subjects.map(subject => {
    const subjectTopics = topics.filter(t => String(t.subjectId) === String(subject.id));
    const subjectLessons = lessons.filter(l => subjectTopics.some(t => String(t.id) === String(l.topicId)));
    
    return {
      ...subject,
      topics: subjectTopics.map(topic => ({
        ...topic,
        lessons: subjectLessons.filter(l => String(l.topicId) === String(topic.id)).sort((a, b) => a.order - b.order)
      })).filter(t => t.lessons.length > 0)
    };
  }).filter(s => s.topics.length > 0);

  const getLessonProgress = (lessonId: string) => {
    return progress.find(p => p.lessonId === lessonId);
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
          <p className="text-slate-500 font-medium animate-pulse">Đang chuẩn bị bài học...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-8 max-w-7xl mx-auto space-y-12 pb-20"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-3">
            <Layers size={14} />
            <span>Thư viện bài học</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900">Khám phá kiến thức</h1>
          <p className="text-slate-500 mt-2 text-lg">Hãy chọn một bài học để bắt đầu hành trình hôm nay.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <div className="px-4 py-2 text-center border-r border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Tổng số</p>
            <p className="text-xl font-bold text-slate-900">{lessons.length}</p>
          </div>
          <div className="px-4 py-2 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Hoàn thành</p>
            <p className="text-xl font-bold text-emerald-600">{progress.filter(p => p.completed).length}</p>
          </div>
        </div>
      </header>

      {groupedLessons.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">Chưa có bài học nào</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">Hiện tại giáo viên chưa xuất bản bài học nào cho lớp của bạn. Hãy quay lại sau nhé!</p>
        </div>
      ) : (
        <div className="space-y-16">
          {groupedLessons.map((subject, sIdx) => (
            <section key={subject.id} className="space-y-8">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                  ['bg-indigo-600', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500'][sIdx % 4]
                }`}>
                  <Star size={24} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{subject.name}</h2>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {subject.topics.map(topic => (
                  <div key={topic.id} className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{topic.name}</h3>
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{topic.lessons.length} bài</span>
                    </div>
                    
                    <div className="space-y-4">
                      {topic.lessons.map(lesson => {
                        const prog = getLessonProgress(lesson.id);
                        const isCompleted = prog?.completed;
                        
                        return (
                          <motion.div 
                            key={lesson.id}
                            variants={itemVariants}
                            whileHover={{ y: -4 }}
                            onClick={() => navigate(`/app/lessons/${lesson.id}`)}
                            className={`group relative bg-white border-2 rounded-[2rem] p-6 transition-all cursor-pointer ${
                              isCompleted ? 'border-emerald-100 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-100' : 'border-slate-100 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                                isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                              }`}>
                                {isCompleted ? <CheckCircle size={24} /> : <PlayCircle size={24} />}
                              </div>
                              {isCompleted ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
                                  Đã học
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
                                  Mới
                                </span>
                              )}
                            </div>
                            
                            <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-4">
                              {lesson.title}
                            </h4>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                {lesson.videoUrl && (
                                  <div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-1 rounded-md">
                                    <Video size={12} />
                                    <span>Video</span>
                                  </div>
                                )}
                                <Clock size={14} />
                                <span>{isCompleted && prog.completedAt ? new Date(prog.completedAt).toLocaleDateString('vi-VN') : 'Chưa bắt đầu'}</span>
                              </div>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'
                              }`}>
                                <ArrowRight size={16} />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </motion.div>
  );
};
