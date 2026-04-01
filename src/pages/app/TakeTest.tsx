import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { dataProvider } from '../../core/provider';
import { Test, Question } from '../../core/types';
import { Modal } from '../../components/Modal';
import { Clock, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, Loader2, Timer, Flag, HelpCircle, FileText } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { parseTruncatedJSON } from '../../utils/jsonUtils';

export const TakeTest: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchTest = async () => {
      if (!id) return;
      setLoading(true);
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
        setTest(testData);
        setTimeLeft(testData.durationMinutes * 60);
      } catch (error) {
        console.error("Test not found", error);
        navigate('/app/tests');
      } finally {
        setLoading(false);
      }
    };
    fetchTest();
  }, [id, navigate]);

  useEffect(() => {
    if (timeLeft > 0 && !isSubmitting) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && test && !isSubmitting) {
      handleSubmit();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, isSubmitting, test]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, value: any, subQuestionId?: string) => {
    if (subQuestionId) {
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] || {}),
          [subQuestionId]: value
        }
      }));
    } else {
      setAnswers(prev => ({ ...prev, [questionId]: value }));
    }
  };

  const handlePreSubmit = () => {
    let isComplete = true;
    for (const q of test!.questions) {
      if (q.type === 'true_false' && q.subQuestions) {
        const ans = answers[q.id] || {};
        if (Object.keys(ans).length < q.subQuestions.length) {
          isComplete = false;
          break;
        }
      } else if (answers[q.id] === undefined || answers[q.id] === '') {
        isComplete = false;
        break;
      }
    }

    if (timeLeft > 0 && !isComplete) {
      setShowConfirmSubmit(true);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!test || isSubmitting) return;
    
    setShowConfirmSubmit(false);
    const currentUser = dataProvider.getCurrentUser();
    if (!currentUser) return;

    setIsSubmitting(true);
    
    let totalScore = 0;
    let maxScore = 0;
    
    test.questions.forEach(q => {
      const questionMaxPoints = q.type === 'true_false' ? 1.0 : q.points;
      maxScore += questionMaxPoints;
      if (q.type === 'multiple_choice') {
        if (answers[q.id] === q.correctAnswer) {
          totalScore += questionMaxPoints;
        }
      } else if (q.type === 'true_false' && q.subQuestions) {
        let correctCount = 0;
        const studentAns = answers[q.id] || {};
        q.subQuestions.forEach(sq => {
          if (studentAns[sq.id] === sq.correctAnswer) {
            correctCount++;
          }
        });
        
        let score = 0;
        if (correctCount === 1) score = 0.1;
        else if (correctCount === 2) score = 0.25;
        else if (correctCount === 3) score = 0.5;
        else if (correctCount === 4) score = 1.0;
        
        totalScore += score;
      }
    });

    const questionsToGradeByAI = test.questions.filter(q => 
      (q.type === 'short_answer' || q.type === 'essay') && 
      q.correctAnswer && 
      answers[q.id]
    );

    if (questionsToGradeByAI.length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const gradingPrompt = `Bạn là một giáo viên chấm bài thi. Hãy chấm điểm các câu trả lời của học sinh dựa trên câu hỏi và đáp án/hướng dẫn chấm.
        
        Danh sách các câu hỏi cần chấm:
        ${questionsToGradeByAI.map((q, idx) => `
        Câu ${idx + 1}:
        - ID: ${q.id}
        - Nội dung câu hỏi: ${q.content}
        - Đáp án/Hướng dẫn chấm: ${q.correctAnswer}
        - Điểm tối đa: ${q.points}
        - Câu trả lời của học sinh: ${answers[q.id]}
        `).join('\n')}
        
        Trả về mảng JSON chứa kết quả chấm điểm cho từng câu. Mỗi phần tử gồm:
        - id: ID của câu hỏi
        - score: Điểm số đạt được (từ 0 đến điểm tối đa, có thể cho điểm lẻ như 0.25, 0.5)
        - feedback: Nhận xét ngắn gọn về câu trả lời.
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: gradingPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  feedback: { type: Type.STRING }
                },
                required: ["id", "score", "feedback"]
              }
            }
          }
        });

        const gradingResults = parseTruncatedJSON(response.text);
        gradingResults.forEach((result: any) => {
          totalScore += result.score;
          answers[`${result.id}_feedback`] = result.feedback;
          answers[`${result.id}_score`] = result.score;
        });
      } catch (error) {
        console.error("Error grading with AI:", error);
      }
    }

    const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 10 * 10) / 10 : 0;

    try {
      await dataProvider.submitAssignment({
        testId: test.id,
        studentId: currentUser.id,
        content: JSON.stringify(answers),
        score: finalScore
      });
      
      // Award XP for test completion
      const xpAmount = 100 + Math.round(finalScore * 10);
      await dataProvider.awardXP(currentUser.id, xpAmount);
      
      // Award "Thiên tài" badge if score is 10/10
      if (finalScore === 10) {
        await dataProvider.awardBadge(currentUser.id, {
          id: 'genius',
          name: 'Thiên tài',
          description: 'Đạt điểm tuyệt đối trong một bài kiểm tra.',
          icon: '🏆'
        });
      }
      
      navigate(`/app/tests/${test.id}/result`);
    } catch (error) {
      console.error("Error submitting test", error);
      alert("Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse">Đang tải nội dung bài thi...</p>
      </div>
    );
  }

  if (!test) return null;

  const currentQuestion = test.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === test.questions.length - 1;
  const progress = ((currentQuestionIndex + 1) / test.questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Immersive Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 line-clamp-1">{test.title}</h2>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Câu {currentQuestionIndex + 1} / {test.questions.length}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>{Math.round(progress)}% Hoàn thành</span>
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-mono text-xl font-black shadow-sm transition-colors ${
            timeLeft < 300 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-indigo-50 text-indigo-600'
          }`}>
            <Timer size={24} />
            {formatTime(timeLeft)}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-100">
          <motion.div 
            className="h-full bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 50 }}
          />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Question Navigation Sidebar */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Flag size={14} />
              Danh sách câu hỏi
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-3">
              {test.questions.map((q, idx) => {
                let isAnswered = false;
                if (q.type === 'true_false' && q.subQuestions) {
                  const ans = answers[q.id] || {};
                  isAnswered = Object.keys(ans).length === q.subQuestions.length;
                } else {
                  isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                }

                return (
                  <button
                    key={`${q.id || 'q'}-${idx}`}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`aspect-square rounded-xl text-sm font-bold transition-all flex items-center justify-center border-2 ${
                      currentQuestionIndex === idx 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-110' 
                        : isAnswered
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                <span>Đang làm</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <div className="w-3 h-3 rounded-full bg-emerald-50 border border-emerald-100"></div>
                <span>Đã trả lời</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <div className="w-3 h-3 rounded-full bg-white border border-slate-100"></div>
                <span>Chưa làm</span>
              </div>
            </div>
          </div>
          
          <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-100">
            <HelpCircle className="mb-4 opacity-60" size={32} />
            <h4 className="font-bold mb-2">Cần trợ giúp?</h4>
            <p className="text-sm text-indigo-100 leading-relaxed">Đọc kỹ câu hỏi và các phương án trả lời trước khi chọn nhé. Chúc bạn thi tốt!</p>
          </div>
        </aside>

        {/* Question Content Area */}
        <section className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentQuestionIndex}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-slate-100 shadow-sm min-h-[500px] flex flex-col"
            >
              <div className="mb-10">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-widest">
                    {currentQuestion.type === 'multiple_choice' ? 'Trắc nghiệm' : 
                     currentQuestion.type === 'true_false' ? 'Đúng / Sai' : 
                     currentQuestion.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                  </span>
                  <span className="text-sm font-bold text-slate-400">
                    Điểm: <span className="text-indigo-600">{currentQuestion.type === 'true_false' ? 1 : currentQuestion.points}</span>
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 leading-snug">
                  {currentQuestion.content}
                </h3>
              </div>

              <div className="flex-1 space-y-4">
                {currentQuestion.type === 'multiple_choice' && currentQuestion.options?.map((opt: string, idx: number) => (
                  <label 
                    key={idx} 
                    className={`flex items-center gap-4 p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                      answers[currentQuestion.id] === opt 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-50' 
                        : 'border-slate-50 hover:border-indigo-200 bg-slate-50/30'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      answers[currentQuestion.id] === opt ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                    }`}>
                      {answers[currentQuestion.id] === opt && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <input 
                      type="radio" 
                      name={`question-${currentQuestion.id}`}
                      value={opt}
                      checked={answers[currentQuestion.id] === opt}
                      onChange={() => handleAnswerChange(currentQuestion.id, opt)}
                      className="hidden"
                    />
                    <span className={`text-lg font-medium ${answers[currentQuestion.id] === opt ? 'text-indigo-900' : 'text-slate-600'}`}>
                      {opt}
                    </span>
                  </label>
                ))}

                {currentQuestion.type === 'true_false' && currentQuestion.subQuestions && (
                  <div className="space-y-6">
                    {currentQuestion.subQuestions.map((sq, sqIdx) => (
                      <div key={`${sq.id || 'sq'}-${sqIdx}`} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1 text-lg font-medium text-slate-700">
                          <span className="text-indigo-600 font-black mr-3">{sq.id})</span>
                          {sq.content}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() => handleAnswerChange(currentQuestion.id, true, sq.id)}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                              answers[currentQuestion.id]?.[sq.id] === true
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                                : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'
                            }`}
                          >
                            Đúng
                          </button>
                          <button
                            onClick={() => handleAnswerChange(currentQuestion.id, false, sq.id)}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                              answers[currentQuestion.id]?.[sq.id] === false
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                                : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'
                            }`}
                          >
                            Sai
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'short_answer' && (
                  <input 
                    type="text"
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Nhập câu trả lời của bạn tại đây..."
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-lg font-medium"
                  />
                )}

                {currentQuestion.type === 'essay' && (
                  <textarea 
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Trình bày chi tiết bài làm của bạn..."
                    rows={10}
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-lg leading-relaxed"
                  />
                )}
              </div>

              <div className="mt-12 pt-8 border-t border-slate-50 flex justify-between items-center">
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center gap-2 px-6 py-4 text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 disabled:opacity-50 transition-all font-bold"
                >
                  <ChevronLeft size={20} /> Câu trước
                </button>

                {!isLastQuestion ? (
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(test.questions.length - 1, prev + 1))}
                    className="flex items-center gap-2 px-8 py-4 text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 group/btn"
                  >
                    Câu tiếp theo <ChevronRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={handlePreSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-10 py-4 text-white bg-emerald-600 rounded-2xl hover:bg-emerald-700 font-black transition-all shadow-lg shadow-emerald-100"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={20} className="animate-spin" /> Đang nộp bài...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={20} /> Hoàn thành & Nộp bài
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </section>
      </main>

      <Modal
        isOpen={showConfirmSubmit}
        onClose={() => setShowConfirmSubmit(false)}
        title="Xác nhận nộp bài"
      >
        <div className="p-8">
          <div className="flex items-start gap-4 mb-8 text-amber-600 bg-amber-50 p-6 rounded-3xl border border-amber-100">
            <AlertTriangle className="shrink-0 mt-1" size={24} />
            <div>
              <h4 className="font-bold text-amber-900 mb-1">Bạn chưa hoàn thành bài thi!</h4>
              <p className="text-sm text-amber-700 leading-relaxed">Vẫn còn một số câu hỏi chưa được trả lời. Bạn có chắc chắn muốn nộp bài ngay bây giờ không?</p>
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowConfirmSubmit(false)}
              className="px-6 py-3 text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all font-bold"
            >
              Tiếp tục làm bài
            </button>
            <button
              onClick={handleSubmit}
              className="px-8 py-3 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-100"
            >
              Nộp bài ngay
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
