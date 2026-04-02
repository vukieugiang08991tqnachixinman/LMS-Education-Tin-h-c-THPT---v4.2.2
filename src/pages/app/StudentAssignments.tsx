import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { dataProvider } from '../../core/provider';
import { Assignment, Subject, Topic, Class, Submission } from '../../core/types';
import { FileText, Calendar, Clock, BookOpen, Download, Upload, CheckCircle, ArrowRight, AlertCircle, Inbox } from 'lucide-react';
import { Modal } from '../../components/Modal';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { GoogleGenAI, Type } from "@google/genai";

export const StudentAssignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [userClass, setUserClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'submitted' | 'graded' | 'overdue'>('all');
  
  // Submit modal state
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [part1Content, setPart1Content] = useState('');
  const [part2Content, setPart2Content] = useState('');
  const [part3Content, setPart3Content] = useState('');
  const [part4Content, setPart4Content] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitFileBase64, setSubmitFileBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncAndFetch = async () => {
      fetchData(); // Load immediately from local storage
      
      try {
        await dataProvider.syncWithGAS();
        fetchData(); // Refresh after sync
      } catch (e: any) {
        if (e.message !== 'GAS_NOT_CONFIGURED') {
          console.error("Sync error:", e);
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
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const user = dataProvider.getCurrentUser();
      if (!user) return;

      const [allAssignments, subData, topData, classData, mySubmissions, lesData] = await Promise.all([
        dataProvider.getList<Assignment>('assignments'),
        dataProvider.getList<Subject>('subjects'),
        dataProvider.getList<Topic>('topics'),
        dataProvider.getList<Class>('classes'),
        dataProvider.getList<Submission>('submissions', { studentId: user.id }),
        dataProvider.getList<any>('lessons')
      ]);

      setSubjects(subData);
      setTopics(topData);
      setSubmissions(mySubmissions);

      let uClass = null;
      if (user.classId) {
        uClass = classData.find(c => String(c.id) === String(user.classId));
        setUserClass(uClass || null);
      }

      const myAssignments = allAssignments.filter(a => {
        let studentIds: any = a.studentIds;
        if (typeof studentIds === 'string') {
          try {
            studentIds = JSON.parse(studentIds);
          } catch (e) {
            studentIds = studentIds.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }

        const sIds = Array.isArray(studentIds) ? studentIds : [];
        if (sIds.length > 0 && sIds.some(id => String(id) === String(user.id))) return true;
        if (a.classId && String(a.classId) === String(user.classId) && sIds.length === 0) return true;
        if (a.grade && uClass && String(a.grade) === String(uClass.grade) && !a.classId && sIds.length === 0) return true;
        
        if (a.lessonId && !a.classId && !a.grade && sIds.length === 0) {
          const lesson = lesData.find(l => String(l.id) === String(a.lessonId));
          if (lesson && String(lesson.status).toLowerCase() === 'published') {
            if (lesson.classId && String(lesson.classId).trim() !== '' && String(lesson.classId) !== String(user.classId)) return false;
            if (lesson.grade && String(lesson.grade).trim() !== '' && uClass && String(lesson.grade) !== String(uClass.grade)) return false;
            return true;
          }
          return false;
        }

        return false;
      });

      myAssignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setAssignments(myAssignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSubjectName = (subjectId?: string) => {
    if (!subjectId) return 'Môn học';
    return subjects.find(s => s.id === subjectId)?.name || 'Môn học';
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate).getTime() < new Date().getTime();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSubmitFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setSubmitFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    
    const user = dataProvider.getCurrentUser();
    if (!user) return;

    const combinedContent = `Phần 1: Trắc nghiệm nhiều lựa chọn\n${part1Content || 'Không có'}\n\nPhần 2: Trắc nghiệm Đúng/Sai\n${part2Content || 'Không có'}\n\nPhần 3: Trả lời ngắn\n${part3Content || 'Không có'}\n\nPhần 4: Tự luận\n${part4Content || 'Không có'}`;

    if (!part1Content && !part2Content && !part3Content && !part4Content && !submitFileBase64) {
      alert('Vui lòng nhập nội dung hoặc đính kèm tệp');
      return;
    }

    setIsSubmitting(true);
    try {
      let autoScore: number | undefined = undefined;
      let autoFeedback: string | undefined = undefined;

      // Auto-grade part 1 if present
      if (selectedAssignment.part1 && part1Content) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const prompt = `
            Bạn là một giáo viên chấm bài tự động.
            Dưới đây là đề bài trắc nghiệm (Phần I):
            ${selectedAssignment.part1}

            Dưới đây là bài làm của học sinh:
            ${part1Content}

            Hãy chấm điểm bài làm này trên thang điểm 10 (chỉ tính riêng cho phần này).
            Nếu học sinh làm đúng hết, điểm là 10. Nếu sai một số câu, hãy trừ điểm tương ứng.
            Hãy cung cấp điểm số và nhận xét ngắn gọn.
          `;

          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER, description: "Điểm số từ 0 đến 10" },
                  feedback: { type: Type.STRING, description: "Nhận xét ngắn gọn về bài làm" }
                },
                required: ["score", "feedback"]
              }
            }
          });

          const result = JSON.parse(response.text || "{}");
          if (typeof result.score === 'number') {
            autoScore = result.score;
            autoFeedback = `[Chấm tự động Phần I] Điểm: ${result.score}/10. Nhận xét: ${result.feedback}`;
          }
        } catch (aiError) {
          console.error("Auto-grading failed:", aiError);
        }
      }

      const hasOtherParts = !!(selectedAssignment.part2 || selectedAssignment.part3 || selectedAssignment.part4);
      
      const submissionData: any = {
        assignmentId: selectedAssignment.id,
        studentId: user.id,
        content: combinedContent,
        part1Content,
        part2Content,
        part3Content,
        part4Content,
        fileName: submitFile?.name,
        fileUrl: submitFileBase64 || undefined
      };

      if (autoScore !== undefined && !hasOtherParts) {
        submissionData.score = autoScore;
        submissionData.feedback = autoFeedback;
      } else if (autoScore !== undefined && hasOtherParts) {
        submissionData.feedback = autoFeedback;
      }

      await dataProvider.submitAssignment(submissionData);
      
      alert('Nộp bài thành công!');
      setSelectedAssignment(null);
      setPart1Content('');
      setPart2Content('');
      setPart3Content('');
      setPart4Content('');
      setSubmitFile(null);
      setSubmitFileBase64(null);
      fetchData();
    } catch (error) {
      console.error("Error submitting assignment:", error);
      alert('Có lỗi xảy ra khi nộp bài');
    } finally {
      setIsSubmitting(false);
    }
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
          <p className="text-slate-500 font-medium animate-pulse">Đang tải bài tập...</p>
        </div>
      </div>
    );
  }

  const filteredAssignments = assignments.filter(assignment => {
    const overdue = isOverdue(assignment.dueDate);
    const submission = submissions.find(s => s.assignmentId === assignment.id);
    const isSubmitted = !!submission;
    const isGraded = isSubmitted && submission.score !== undefined && submission.score !== null;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return !isSubmitted && !overdue;
    if (filterStatus === 'submitted') return isSubmitted && !isGraded;
    if (filterStatus === 'graded') return isGraded;
    if (filterStatus === 'overdue') return !isSubmitted && overdue;
    return true;
  });

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-8 max-w-7xl mx-auto space-y-10 pb-20"
    >
      <header>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-600 text-xs font-bold uppercase tracking-wider mb-3">
          <FileText size={14} />
          <span>Nhiệm vụ học tập</span>
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Bài tập của tôi</h1>
        <p className="text-slate-500 mt-2 text-lg">Hoàn thành các bài tập để củng cố kiến thức nhé.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Chưa làm
        </button>
        <button
          onClick={() => setFilterStatus('submitted')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterStatus === 'submitted' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Đã nộp
        </button>
        <button
          onClick={() => setFilterStatus('graded')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterStatus === 'graded' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Đã chấm
        </button>
        <button
          onClick={() => setFilterStatus('overdue')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterStatus === 'overdue' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Quá hạn
        </button>
      </div>

      {filteredAssignments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Inbox className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">Chưa có bài tập nào</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">Tuyệt vời! Bạn đã hoàn thành tất cả các nhiệm vụ được giao hoặc không có bài tập nào phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredAssignments.map(assignment => {
            const overdue = isOverdue(assignment.dueDate);
            const submission = submissions.find(s => s.assignmentId === assignment.id);
            const isSubmitted = !!submission;
            
            return (
              <motion.div 
                key={assignment.id} 
                variants={itemVariants}
                whileHover={{ y: -4 }}
                className={`group relative bg-white border-2 rounded-[2.5rem] p-8 transition-all flex flex-col ${
                  isSubmitted ? 'border-emerald-100 hover:border-emerald-300' : 
                  overdue ? 'border-rose-100 hover:border-rose-300' : 
                  'border-slate-100 hover:border-indigo-300'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                    isSubmitted ? 'bg-emerald-50 text-emerald-600' : 
                    overdue ? 'bg-rose-50 text-rose-600' : 
                    'bg-indigo-50 text-indigo-600'
                  }`}>
                    <BookOpen size={14} />
                    {getSubjectName(assignment.subjectId)}
                  </span>
                  
                  {isSubmitted ? (
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <CheckCircle size={20} />
                    </div>
                  ) : overdue ? (
                    <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <AlertCircle size={20} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <Clock size={20} />
                    </div>
                  )}
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors line-clamp-2">{assignment.title}</h3>
                <p className="text-slate-500 text-sm mb-8 line-clamp-3 leading-relaxed flex-1">{assignment.description}</p>
                
                <div className="space-y-6">
                  {(() => {
                    let attachments = assignment.attachments;
                    if (typeof attachments === 'string') {
                      try {
                        attachments = JSON.parse(attachments);
                      } catch (e) {
                        attachments = attachments.split(',').map((s: string) => s.trim()).filter(Boolean);
                      }
                    }
                    return attachments && attachments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tài liệu đính kèm</p>
                        <div className="flex flex-wrap gap-2">
                          {attachments.map((att: string, idx: number) => (
                            <a 
                              key={idx}
                              href={att}
                              download={`Tai_lieu_bai_tap_${idx + 1}`}
                              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all"
                            >
                              <Download size={14} />
                              <span>Tệp {idx + 1}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-6 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Calendar size={16} className={overdue && !isSubmitted ? 'text-rose-500' : 'text-slate-400'} />
                        <span className={overdue && !isSubmitted ? 'text-rose-600' : 'text-slate-500'}>
                          Hạn: {formatDate(assignment.dueDate)}
                        </span>
                      </div>
                    </div>
                    
                    {isSubmitted ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-sm shadow-sm">
                          <CheckCircle size={18} /> Đã hoàn thành
                        </div>
                        {submission?.score !== undefined && submission?.score !== null && (
                          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-indigo-900">Điểm số:</span>
                              <span className="text-lg font-black text-indigo-600">{submission.score}/10</span>
                            </div>
                            {submission.feedback && (
                              <div className="text-sm text-indigo-700 mt-2 pt-2 border-t border-indigo-100/50">
                                <span className="font-semibold block mb-1">Nhận xét:</span>
                                {submission.feedback}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedAssignment(assignment)}
                        disabled={overdue}
                        className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 group/btn ${
                          overdue 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 hover:-translate-y-1'
                        }`}
                      >
                        {overdue ? 'Đã quá hạn nộp' : 'Bắt đầu làm bài'}
                        {!overdue && <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Submit Assignment Modal */}
      <Modal
        isOpen={!!selectedAssignment}
        onClose={() => {
          setSelectedAssignment(null);
          setPart1Content('');
          setPart2Content('');
          setPart3Content('');
          setPart4Content('');
          setSubmitFile(null);
          setSubmitFileBase64(null);
        }}
        title={`Nộp bài: ${selectedAssignment?.title}`}
      >
        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {selectedAssignment && (
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                Yêu cầu bài tập:
              </h4>
              <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed mb-6">{selectedAssignment.description}</p>
              
              {/* Display 4 Parts if they exist */}
              <div className="space-y-6 mb-8">
                {selectedAssignment.part1 && (
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <h5 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">I</span>
                      Phần I: Bài tập Trắc nghiệm
                    </h5>
                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{selectedAssignment.part1}</p>
                  </div>
                )}
                {selectedAssignment.part2 && (
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <h5 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">II</span>
                      Phần II: Bài tập Trắc nghiệm Đúng/Sai
                    </h5>
                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{selectedAssignment.part2}</p>
                  </div>
                )}
                {selectedAssignment.part3 && (
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <h5 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">III</span>
                      Phần III: Bài tập Trả lời ngắn
                    </h5>
                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{selectedAssignment.part3}</p>
                  </div>
                )}
                {selectedAssignment.part4 && (
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <h5 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">IV</span>
                      Phần IV: Bài tập Tự luận
                    </h5>
                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{selectedAssignment.part4}</p>
                  </div>
                )}
              </div>

              {(() => {
                let attachments = selectedAssignment.attachments;
                if (typeof attachments === 'string') {
                  try {
                    attachments = JSON.parse(attachments);
                  } catch (e) {
                    attachments = attachments.split(',').map((s: string) => s.trim()).filter(Boolean);
                  }
                }
                return attachments && attachments.length > 0 && (
                <div className="space-y-3 mb-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tài liệu tham khảo</p>
                  <div className="flex flex-wrap gap-3">
                    {attachments.map((att: any, idx: number) => (
                      <a 
                        key={idx}
                        href={att}
                        download={`Tai_lieu_bai_tap_${idx + 1}`}
                        className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 bg-white border border-indigo-100 hover:border-indigo-300 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        <Download size={16} />
                        <span>Tải xuống tệp {idx + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
                );
              })()}

              {selectedAssignment.questions && selectedAssignment.questions.length > 0 && (
                <div className="space-y-4 mt-6 border-t border-slate-200 pt-6">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen size={18} className="text-indigo-600" />
                    Danh sách câu hỏi ({selectedAssignment.questions.length} câu)
                  </h4>
                  <div className="space-y-4">
                    {selectedAssignment.questions.map((q, idx) => (
                      <div key={`${q.id || 'q'}-${idx}`} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-lg">
                            {q.type === 'multiple_choice' ? 'Trắc nghiệm' :
                             q.type === 'true_false' ? 'Đúng/Sai' :
                             q.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                            {' • '}{q.points} điểm
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium mb-4">{q.content}</p>
                        
                        {q.type === 'multiple_choice' && q.options && (
                          <div className="space-y-2 pl-2">
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-slate-700">{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === 'true_false' && q.subQuestions && (
                          <div className="space-y-3 pl-2">
                            {q.subQuestions.map((subQ: any, subIdx: number) => (
                              <div key={`${subQ.id || 'sq'}-${subIdx}`} className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50">
                                <span className="text-sm text-slate-700 font-medium flex-1">{subQ.content}</span>
                                <div className="flex gap-2 flex-shrink-0">
                                  <div className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 bg-white">Đúng</div>
                                  <div className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 bg-white">Sai</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">1</span>
                  Trắc nghiệm nhiều lựa chọn
                </label>
                <textarea
                  value={part1Content}
                  onChange={(e) => setPart1Content(e.target.value)}
                  rows={3}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm"
                  placeholder="Ví dụ: 1A, 2B, 3C..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">2</span>
                  Trắc nghiệm Đúng/Sai
                </label>
                <textarea
                  value={part2Content}
                  onChange={(e) => setPart2Content(e.target.value)}
                  rows={3}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm"
                  placeholder="Ví dụ: 1a Đ, 1b S..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">3</span>
                Trả lời ngắn
              </label>
              <textarea
                value={part3Content}
                onChange={(e) => setPart3Content(e.target.value)}
                rows={3}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-sm"
                placeholder="Nhập câu trả lời ngắn của bạn..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">4</span>
                Tự luận
              </label>
              <div className="bg-white rounded-2xl overflow-hidden border-2 border-slate-100 focus-within:border-indigo-500 transition-all">
                <ReactQuill
                  theme="snow"
                  value={part4Content}
                  onChange={setPart4Content}
                  className="h-64 pb-12"
                  placeholder="Trình bày chi tiết bài làm của bạn tại đây..."
                />
              </div>
            </div>

            <div className="p-6 bg-indigo-50 rounded-[2rem] border-2 border-dashed border-indigo-200">
              <label className="block text-sm font-bold text-indigo-900 mb-4">
                Đính kèm tệp bài làm (tùy chọn)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all"
                >
                  <Upload size={18} /> Chọn tệp từ máy tính
                </button>
                <span className="text-sm text-indigo-600/60 font-medium truncate max-w-[250px]">
                  {submitFile ? submitFile.name : 'Chấp nhận các định dạng phổ biến'}
                </span>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                className="px-8 py-4 text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all font-bold"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (!part1Content && !part2Content && !part3Content && !part4Content && !submitFileBase64)}
                className="px-10 py-4 text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-all font-bold disabled:opacity-50 shadow-lg shadow-indigo-100 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    Nộp bài ngay
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </motion.div>
  );
};
