import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { dataProvider } from '../../core/provider';
import { Test, Submission } from '../../core/types';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft, Trophy, Target, Clock, Calendar, Sparkles } from 'lucide-react';

export const TestResult: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      const currentUser = dataProvider.getCurrentUser();
      if (!currentUser) return;

      try {
        const testData = await dataProvider.getOne<Test>('tests', id);
        if (testData && testData.questions) {
          testData.questions = testData.questions.map(q => {
            let options = q.options;
            if (typeof options === 'string') {
              try { options = JSON.parse(options); } catch { options = []; }
            }
            let subQuestions = q.subQuestions;
            if (typeof subQuestions === 'string') {
              try { subQuestions = JSON.parse(subQuestions); } catch { subQuestions = []; }
            }
            return { ...q, options, subQuestions };
          });
        }
        const submissions = await dataProvider.getList<Submission>('submissions', { 
          testId: id, 
          studentId: currentUser.id 
        });
        
        setTest(testData);
        if (submissions.length > 0) {
          setSubmission(submissions[0]);
          try {
            setAnswers(typeof submissions[0].content === 'string' ? JSON.parse(submissions[0].content) : submissions[0].content);
          } catch (e) {
            console.error("Error parsing submission content:", e);
            setAnswers({});
          }
        }
      } catch (error) {
        console.error("Error fetching result", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse">Đang tải kết quả...</p>
      </div>
    );
  }

  if (!test || !submission) return (
    <div className="max-w-4xl mx-auto p-8 text-center">
      <div className="bg-white rounded-[2.5rem] p-12 shadow-sm border border-slate-100">
        <AlertCircle size={64} className="mx-auto text-slate-300 mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Không tìm thấy kết quả</h2>
        <p className="text-slate-500 mb-8">Có vẻ như bạn chưa thực hiện bài kiểm tra này hoặc kết quả đã bị xóa.</p>
        <button 
          onClick={() => navigate('/app/tests')}
          className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          Quay lại danh sách
        </button>
      </div>
    </div>
  );

  const isFullyGraded = !test.questions.some(q => q.type === 'essay' || q.type === 'short_answer');
  const score = submission.score !== undefined ? submission.score : 0;
  
  const getScoreColor = (s: number) => {
    if (s >= 8) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (s >= 5) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-rose-600 bg-rose-50 border-rose-100';
  };

  const getScoreMessage = (s: number) => {
    if (s >= 9) return 'Xuất sắc! Bạn đã hoàn thành rất tốt.';
    if (s >= 8) return 'Giỏi lắm! Tiếp tục phát huy nhé.';
    if (s >= 6.5) return 'Khá tốt! Bạn có thể làm tốt hơn nữa.';
    if (s >= 5) return 'Đạt yêu cầu. Cần cố gắng thêm nhé.';
    return 'Chưa đạt. Hãy ôn tập kỹ hơn cho lần sau.';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <motion.button 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        onClick={() => navigate('/app/tests')}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> 
        Quay lại danh sách bài thi
      </motion.button>

      {/* Hero Result Section */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 text-white text-center relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-400/20 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-widest mb-6">
              <Trophy size={14} />
              Kết quả bài thi
            </div>
            <h2 className="text-4xl font-black mb-3 tracking-tight">{test.title}</h2>
            <p className="text-indigo-100 text-lg font-medium mb-10 max-w-2xl mx-auto">
              {getScoreMessage(score)}
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="bg-white text-slate-900 rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-900/20 min-w-[240px] transform hover:scale-105 transition-transform">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Điểm số của bạn</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className={`text-7xl font-black ${score >= 5 ? 'text-indigo-600' : 'text-rose-500'}`}>
                    {submission.score !== undefined ? submission.score : '?'}
                  </span>
                  <span className="text-2xl font-bold text-slate-300">/ 10</span>
                </div>
                {!isFullyGraded && submission.score === undefined && (
                  <div className="mt-4 px-4 py-2 rounded-xl bg-amber-50 text-amber-600 text-xs font-bold flex items-center justify-center gap-2">
                    <AlertCircle size={14} /> Chờ giáo viên chấm tự luận
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 text-left border border-white/10">
                  <Target className="text-indigo-200 mb-3" size={24} />
                  <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Độ chính xác</p>
                  <p className="text-2xl font-black">{Math.round((score / 10) * 100)}%</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 text-left border border-white/10">
                  <Calendar className="text-indigo-200 mb-3" size={24} />
                  <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Ngày nộp</p>
                  <p className="text-lg font-black">
                    {submission.createdAt ? new Date(submission.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-12 space-y-12">
          <div className="flex items-center justify-between border-b border-slate-50 pb-6">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <Sparkles className="text-indigo-600" />
              Chi tiết bài làm
            </h3>
            <div className="hidden sm:flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span>Đúng</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <span>Sai</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span>Một phần</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            {test.questions.map((q, idx) => {
              const studentAnswer = answers[q.id];
              const isAIGraded = (q.type === 'short_answer' || q.type === 'essay') && answers[`${q.id}_score`] !== undefined;
              const aiScore = answers[`${q.id}_score`];
              const aiFeedback = answers[`${q.id}_feedback`];
              
              let isCorrect: boolean | null = null;
              let tfScore = 0;
              const questionMaxPoints = q.type === 'true_false' ? 1.0 : q.points;

              if (q.type === 'multiple_choice') {
                isCorrect = studentAnswer === q.correctAnswer;
              } else if (q.type === 'true_false' && q.subQuestions) {
                let correctCount = 0;
                const studentAns = studentAnswer || {};
                q.subQuestions.forEach(sq => {
                  if (studentAns[sq.id] === sq.correctAnswer) {
                    correctCount++;
                  }
                });
                
                if (correctCount === q.subQuestions.length) isCorrect = true;
                else if (correctCount > 0) isCorrect = null;
                else isCorrect = false;

                if (correctCount === 1) tfScore = 0.1;
                else if (correctCount === 2) tfScore = 0.25;
                else if (correctCount === 3) tfScore = 0.5;
                else if (correctCount === 4) tfScore = 1.0;
                
              } else if (isAIGraded) {
                isCorrect = aiScore === questionMaxPoints ? true : (aiScore > 0 ? null : false);
              }

              return (
                <motion.div 
                  key={`${q.id || 'q'}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-slate-50/50 rounded-[2rem] p-8 border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                          {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 
                           q.type === 'true_false' ? 'Đúng / Sai' : 
                           q.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                        </span>
                        {q.difficulty && (
                          <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                            {q.difficulty === 'recognition' ? 'Nhận biết' :
                             q.difficulty === 'understanding' ? 'Thông hiểu' : 'Vận dụng'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xl font-bold text-slate-900 leading-relaxed">
                        <span className="text-indigo-600 mr-2">Câu {idx + 1}.</span>
                        {q.content}
                      </h4>
                    </div>
                    
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className={`px-4 py-2 rounded-2xl font-bold text-sm flex items-center gap-2 border ${
                        isCorrect === true ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                        isCorrect === false ? 'text-rose-600 bg-rose-50 border-rose-100' :
                        'text-amber-600 bg-amber-50 border-amber-100'
                      }`}>
                        {isCorrect === true ? <CheckCircle size={18} /> : isCorrect === false ? <XCircle size={18} /> : <AlertCircle size={18} />}
                        {isCorrect === true ? 'Chính xác' : isCorrect === false ? 'Chưa đúng' : 'Đúng một phần'}
                      </div>
                      
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Điểm: <span className="text-indigo-600">
                          {q.type === 'true_false' ? tfScore : (isAIGraded ? aiScore : (isCorrect ? questionMaxPoints : 0))}
                        </span> / {questionMaxPoints}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {q.type === 'true_false' && q.subQuestions ? (
                      <div className="grid grid-cols-1 gap-3">
                        {q.subQuestions.map((sq, sqIndex) => {
                          const sAns = (studentAnswer || {})[sq.id];
                          const isSubCorrect = sAns === sq.correctAnswer;
                          return (
                            <div key={`${sq.id || 'sq'}-${sqIndex}`} className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                              <div className="flex-1 flex items-start gap-3">
                                <span className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">{sq.id}</span>
                                <span className="text-slate-700 font-medium">{sq.content}</span>
                              </div>
                              <div className="flex items-center gap-6 shrink-0 text-sm">
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bạn chọn</span>
                                  <span className={`font-bold ${sAns !== undefined ? (isSubCorrect ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-300 italic'}`}>
                                    {sAns !== undefined ? (sAns ? 'Đúng' : 'Sai') : 'Bỏ trống'}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đáp án</span>
                                  <span className="font-bold text-emerald-600">
                                    {sq.correctAnswer ? 'Đúng' : 'Sai'}
                                  </span>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSubCorrect ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                  {isSubCorrect ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Câu trả lời của bạn</p>
                          <div className={`text-lg font-bold ${
                            isCorrect === true ? 'text-emerald-700' : 
                            isCorrect === false ? 'text-rose-700' : 'text-slate-900'
                          }`}>
                            {studentAnswer !== undefined 
                              ? studentAnswer 
                              : <span className="italic text-slate-300">Không trả lời</span>}
                          </div>
                        </div>

                        {(isCorrect === false || isCorrect === true || isAIGraded) && q.correctAnswer && (
                          <div className="p-6 rounded-2xl bg-emerald-50/30 border border-emerald-100 shadow-sm">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Đáp án / Hướng dẫn</p>
                            <div className="text-lg font-bold text-emerald-700">
                              {q.correctAnswer}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {isAIGraded && aiFeedback && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-4 p-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-4"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100">
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <span className="text-indigo-900 font-black text-xs uppercase tracking-widest block mb-1">Nhận xét từ AI</span>
                          <p className="text-indigo-700 font-medium leading-relaxed">{aiFeedback}</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
