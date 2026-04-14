import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { dataProvider } from '../../core/provider';
import { Test, Question } from '../../core/types';
import { Modal } from '../../components/Modal';
import { Clock, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, Loader2, Timer, Flag, HelpCircle, FileText, AlertCircle } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { parseTruncatedJSON } from '../../utils/jsonUtils';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { ensureArray } from '../../core/utils/data';

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
  const [violations, setViolations] = useState(0);
  const [activityLog, setActivityLog] = useState<{time: string, event: string}[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [lastViolationMsg, setLastViolationMsg] = useState('');
  const [isTimeUp, setIsTimeUp] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const addLog = (event: string) => {
    const now = new Date().toLocaleTimeString();
    setActivityLog(prev => [...prev, { time: now, event }]);
  };

  const enterFullscreen = async () => {
    try {
      const elem = containerRef.current as any;
      if (elem?.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem?.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem?.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      } else {
        // Fallback for iOS Safari / unsupported browsers
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err);
      // Fallback if request fails
      setIsFullscreen(true);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitting && test) {
        setViolations(prev => prev + 1);
        const msg = "Chuyển tab hoặc rời khỏi trình duyệt";
        setLastViolationMsg(msg);
        addLog(msg);
        setShowViolationWarning(true);
        toast.error('Cảnh báo: Không được rời khỏi trang làm bài!', { icon: '⚠️' });
      }
    };

    const handleBlur = () => {
      if (!isSubmitting && test) {
        setViolations(prev => prev + 1);
        const msg = "Mất tiêu điểm cửa sổ (có thể đang dùng ứng dụng khác)";
        setLastViolationMsg(msg);
        addLog(msg);
        setShowViolationWarning(true);
      }
    };

    const handleFullscreenChange = () => {
      const isFull = !!(
        document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFull);
      if (!isFull && !isSubmitting && test) {
        setViolations(prev => prev + 1);
        const msg = "Thoát chế độ toàn màn hình";
        setLastViolationMsg(msg);
        addLog(msg);
        setShowViolationWarning(true);
      }
    };

    const preventShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'p')) {
        e.preventDefault();
        toast.error('Hành động bị cấm trong khi thi!');
        return false;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('keydown', preventShortcuts);
    window.addEventListener('contextmenu', preventContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', preventShortcuts);
      window.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [isSubmitting, test]);

  useEffect(() => {
    const fetchTest = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const testData = await dataProvider.getOne<Test>('tests', id);
        if (testData && testData.questions) {
          // Shuffle questions
          let shuffledQuestions = [...ensureArray(testData.questions)].sort(() => Math.random() - 0.5);
          
          shuffledQuestions = shuffledQuestions.map(q => {
            let options = q.options;
            if (typeof options === 'string') {
              try { options = JSON.parse(options); } catch { options = []; }
            }
            let subQuestions = q.subQuestions;
            if (typeof subQuestions === 'string') {
              try { subQuestions = JSON.parse(subQuestions); } catch { subQuestions = []; }
            }
            
            // Shuffle options for multiple choice
            let shuffledOptions = options;
            if (q.type === 'multiple_choice' && Array.isArray(options)) {
              shuffledOptions = [...options].sort(() => Math.random() - 0.5);
            }

            return { ...q, options: shuffledOptions, subQuestions };
          });
          
          testData.questions = shuffledQuestions;
        }
        setTest(testData);
        
        // Calculate actual remaining time based on access time
        const durationMinutes = testData.durationMinutes;
        const startTime = new Date(testData.startTime);
        const endTime = new Date(testData.endTime);
        const currentTime = new Date();
        
        let remainingMinutes = 0;
        
        if (currentTime <= startTime) {
          // Case 1: Vào đúng giờ hoặc sớm hơn
          remainingMinutes = durationMinutes;
        } else if (currentTime > startTime && currentTime < endTime) {
          // Case 2: Vào muộn
          const lateMilliseconds = currentTime.getTime() - startTime.getTime();
          const lateMinutes = lateMilliseconds / (1000 * 60);
          remainingMinutes = Math.max(0, durationMinutes - lateMinutes);
        } else {
          // Case 3: Vào sau giờ kết thúc
          remainingMinutes = 0;
        }
        
        setTimeLeft(Math.floor(remainingMinutes * 60));
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
    if (timeLeft > 0 && !isSubmitting && !isTimeUp) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft <= 0 && test && !isSubmitting && !isTimeUp) {
      setIsTimeUp(true);
      handleSubmit();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, isSubmitting, test, isTimeUp]);

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

    const finalScore = maxScore > 0 ? Number(((totalScore / maxScore) * 10).toFixed(2)) : 0;

    try {
      await dataProvider.submitAssignment({
        testId: test.id,
        studentId: currentUser.id,
        content: JSON.stringify(answers),
        score: finalScore,
        feedback: JSON.stringify({
          violations,
          activityLog
        })
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
      
      toast.success('Nộp bài thành công!');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
      });
      navigate(`/app/tests/${test.id}/result`);
    } catch (error) {
      console.error("Error submitting test", error);
      toast.error("Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.");
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

  if (!test || !Array.isArray(test.questions) || test.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Không tìm thấy bài kiểm tra</h2>
          <p className="text-slate-600 mb-6">Bài kiểm tra này không tồn tại hoặc không có câu hỏi nào.</p>
          <button 
            onClick={() => navigate('/app/tests')}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  if (!currentQuestion) return null;

  const isLastQuestion = currentQuestionIndex === test.questions.length - 1;
  const progress = ((currentQuestionIndex + 1) / test.questions.length) * 100;

  return (
    <div ref={containerRef} className="h-[100dvh] bg-slate-50 pb-20 select-none overflow-y-auto">
      {/* Immersive Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <FileText size={18} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-bold text-slate-900 truncate">{test.title}</h2>
              <div className="flex items-center gap-1 md:gap-2 text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest truncate">
                <span>Câu {currentQuestionIndex + 1} / {test.questions.length}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                <span className="truncate">{Math.round(progress)}% Hoàn thành</span>
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl font-mono text-base md:text-xl font-black shadow-sm transition-colors shrink-0 ${
            timeLeft < 300 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-indigo-50 text-indigo-600'
          }`}>
            <Timer size={20} className="md:w-6 md:h-6" />
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

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:grid lg:grid-cols-4 gap-8">
        {/* Question Navigation Sidebar */}
        <aside className="lg:col-span-1 space-y-4 md:space-y-6 order-last lg:order-first">
          <div className="bg-white rounded-3xl md:rounded-[2rem] p-5 md:p-6 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 md:mb-6 flex items-center gap-2">
              <Flag size={14} />
              Danh sách câu hỏi
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-4 gap-2 md:gap-3">
              {ensureArray(test.questions).map((q, idx) => {
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
          
          <div className="bg-indigo-600 rounded-3xl md:rounded-[2rem] p-5 md:p-6 text-white shadow-xl shadow-indigo-100">
            <HelpCircle className="mb-3 md:mb-4 opacity-60" size={28} />
            <h4 className="font-bold mb-1 md:mb-2">Cần trợ giúp?</h4>
            <p className="text-xs md:text-sm text-indigo-100 leading-relaxed">Đọc kỹ câu hỏi và các phương án trả lời trước khi chọn nhé. Chúc bạn thi tốt!</p>
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
              className="bg-white rounded-3xl md:rounded-[2.5rem] p-5 sm:p-8 md:p-12 border border-slate-100 shadow-sm min-h-[400px] md:min-h-[500px] flex flex-col"
            >
              <div className="mb-6 md:mb-10">
                <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4 mb-4 md:mb-6">
                  <span className="inline-flex items-center gap-1 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl bg-indigo-50 text-indigo-600 text-[10px] md:text-xs font-black uppercase tracking-widest">
                    {currentQuestion.type === 'multiple_choice' ? 'Trắc nghiệm' : 
                     currentQuestion.type === 'true_false' ? 'Đúng / Sai' : 
                     currentQuestion.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                  </span>
                  <span className="text-xs md:text-sm font-bold text-slate-400">
                    Điểm: <span className="text-indigo-600">{currentQuestion.type === 'true_false' ? 1 : currentQuestion.points}</span>
                  </span>
                </div>

                <div 
                  className="text-xl md:text-2xl font-bold text-slate-900 leading-snug overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: String(currentQuestion.content || '') }}
                />
              </div>

              <div className="flex-1 space-y-3 md:space-y-4">
                {currentQuestion.type === 'multiple_choice' && ensureArray(currentQuestion.options).map((opt: string, idx: number) => (
                  <label 
                    key={idx} 
                    className={`flex items-center gap-3 md:gap-4 p-4 md:p-6 rounded-xl md:rounded-2xl border-2 transition-all ${
                      isSubmitting || isTimeUp ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                    } ${
                      answers[currentQuestion.id] === opt 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-50' 
                        : 'border-slate-50 hover:border-indigo-200 bg-slate-50/30'
                    }`}
                  >
                    <div className={`w-5 h-5 md:w-6 md:h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                      answers[currentQuestion.id] === opt ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                    }`}>
                      {answers[currentQuestion.id] === opt && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white" />}
                    </div>
                    <input 
                      type="radio" 
                      name={`question-${currentQuestion.id}`}
                      value={opt}
                      checked={answers[currentQuestion.id] === opt}
                      onChange={() => {
                        if (!isSubmitting && !isTimeUp) handleAnswerChange(currentQuestion.id, opt);
                      }}
                      className="hidden"
                      disabled={isSubmitting || isTimeUp}
                    />
                    <span className={`text-base md:text-lg font-medium ${answers[currentQuestion.id] === opt ? 'text-indigo-900' : 'text-slate-600'}`}>
                      {opt}
                    </span>
                  </label>
                ))}

                {currentQuestion.type === 'true_false' && (
                  <div className="space-y-4 md:space-y-6">
                    {ensureArray(currentQuestion.subQuestions).map((sq, sqIdx) => (
                      <div key={`${sq.id || 'sq'}-${sqIdx}`} className="p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                        <div className="flex-1 text-base md:text-lg font-medium text-slate-700 flex items-start">
                          <span className="text-indigo-600 font-black mr-2 md:mr-3 shrink-0">{String.fromCharCode(97 + sqIdx)})</span>
                          <div dangerouslySetInnerHTML={{ __html: String(sq.content || '') }} />
                        </div>
                        <div className="flex items-center gap-2 md:gap-3 shrink-0 w-full md:w-auto">
                          <button
                            onClick={() => {
                              if (!isSubmitting && !isTimeUp) handleAnswerChange(currentQuestion.id, true, sq.id);
                            }}
                            disabled={isSubmitting || isTimeUp}
                            className={`flex-1 md:flex-none px-4 py-2 md:px-6 md:py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                              isSubmitting || isTimeUp ? 'cursor-not-allowed opacity-70' : ''
                            } ${
                              answers[currentQuestion.id]?.[sq.id] === true
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                                : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'
                            }`}
                          >
                            Đúng
                          </button>
                          <button
                            onClick={() => {
                              if (!isSubmitting && !isTimeUp) handleAnswerChange(currentQuestion.id, false, sq.id);
                            }}
                            disabled={isSubmitting || isTimeUp}
                            className={`flex-1 md:flex-none px-4 py-2 md:px-6 md:py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                              isSubmitting || isTimeUp ? 'cursor-not-allowed opacity-70' : ''
                            } ${
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
                    onChange={(e) => {
                      if (!isSubmitting && !isTimeUp) handleAnswerChange(currentQuestion.id, e.target.value);
                    }}
                    disabled={isSubmitting || isTimeUp}
                    placeholder="Nhập câu trả lời của bạn tại đây..."
                    className={`w-full p-4 md:p-6 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-base md:text-lg font-medium ${
                      isSubmitting || isTimeUp ? 'cursor-not-allowed opacity-70' : ''
                    }`}
                  />
                )}

                {currentQuestion.type === 'essay' && (
                  <textarea 
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => {
                      if (!isSubmitting && !isTimeUp) handleAnswerChange(currentQuestion.id, e.target.value);
                    }}
                    disabled={isSubmitting || isTimeUp}
                    placeholder="Trình bày chi tiết bài làm của bạn..."
                    rows={10}
                    className={`w-full p-4 md:p-6 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all text-base md:text-lg leading-relaxed ${
                      isSubmitting || isTimeUp ? 'cursor-not-allowed opacity-70' : ''
                    }`}
                  />
                )}
              </div>

              <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-50 flex justify-between items-center gap-2">
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center justify-center gap-1 md:gap-2 px-4 py-3 md:px-6 md:py-4 text-slate-500 bg-slate-100 rounded-xl md:rounded-2xl hover:bg-slate-200 disabled:opacity-50 transition-all font-bold text-sm md:text-base flex-1 md:flex-none"
                >
                  <ChevronLeft size={18} className="md:w-5 md:h-5" /> <span className="hidden sm:inline">Câu trước</span><span className="sm:hidden">Trước</span>
                </button>

                {!isLastQuestion ? (
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(test.questions.length - 1, prev + 1))}
                    className="flex items-center justify-center gap-1 md:gap-2 px-6 py-3 md:px-8 md:py-4 text-white bg-indigo-600 rounded-xl md:rounded-2xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 group/btn text-sm md:text-base flex-1 md:flex-none"
                  >
                    <span className="hidden sm:inline">Câu tiếp theo</span><span className="sm:hidden">Tiếp</span> <ChevronRight size={18} className="md:w-5 md:h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={handlePreSubmit}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-1 md:gap-2 px-6 py-3 md:px-10 md:py-4 text-white bg-emerald-600 rounded-xl md:rounded-2xl hover:bg-emerald-700 font-black transition-all shadow-lg shadow-emerald-100 text-sm md:text-base flex-1 md:flex-none"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin md:w-5 md:h-5" /> <span className="hidden sm:inline">Đang nộp bài...</span><span className="sm:hidden">Đang nộp...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} className="md:w-5 md:h-5" /> <span className="hidden sm:inline">Hoàn thành & Nộp bài</span><span className="sm:hidden">Nộp bài</span>
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
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 md:gap-4">
            <button
              onClick={() => setShowConfirmSubmit(false)}
              className="w-full sm:w-auto px-6 py-3 text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all font-bold text-center"
            >
              Tiếp tục làm bài
            </button>
            <button
              onClick={handleSubmit}
              className="w-full sm:w-auto px-8 py-3 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-100 text-center"
            >
              Nộp bài ngay
            </button>
          </div>
        </div>
      </Modal>

      {/* Fullscreen Overlay */}
      {!isFullscreen && !loading && test && !isSubmitting && !isTimeUp && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-6">
          <div className="bg-white p-6 md:p-10 rounded-3xl md:rounded-[3rem] shadow-2xl max-w-lg text-center border border-slate-100 w-full">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-100 text-indigo-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8">
              <Timer size={32} className="md:w-10 md:h-10" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 md:mb-4">Chế độ thi an toàn</h2>
            <p className="text-slate-600 mb-8 md:mb-10 text-base md:text-lg leading-relaxed">
              Để đảm bảo tính công bằng, bạn cần làm bài ở chế độ <span className="font-bold text-indigo-600">Toàn màn hình</span>. Mọi hành vi rời khỏi trang sẽ được ghi lại.
            </p>
            <button
              onClick={enterFullscreen}
              className="w-full py-4 md:py-5 bg-indigo-600 text-white rounded-xl md:rounded-2xl font-black text-lg md:text-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
            >
              Bắt đầu làm bài ngay
            </button>
          </div>
        </div>
      )}

      {/* Time Up Overlay */}
      {isTimeUp && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-6">
          <div className="bg-white p-6 md:p-10 rounded-3xl md:rounded-[3rem] shadow-2xl max-w-lg text-center border border-slate-100 w-full">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-rose-100 text-rose-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8">
              <Timer size={32} className="md:w-10 md:h-10" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 md:mb-4">Hết giờ làm bài!</h2>
            <p className="text-slate-600 mb-8 md:mb-10 text-base md:text-lg leading-relaxed">
              Hệ thống đang tự động thu bài của bạn. Vui lòng không đóng trình duyệt.
            </p>
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-3 text-indigo-600 font-bold">
                <Loader2 size={24} className="animate-spin" />
                Đang nộp bài...
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                className="w-full py-4 md:py-5 bg-indigo-600 text-white rounded-xl md:rounded-2xl font-black text-lg md:text-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
              >
                Thử nộp lại
              </button>
            )}
          </div>
        </div>
      )}

      {/* Violation Warning Modal */}
      <Modal
        isOpen={showViolationWarning}
        onClose={() => setShowViolationWarning(false)}
        title="CẢNH BÁO VI PHẠM"
      >
        <div className="p-4 md:p-8 text-center">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-rose-100 text-rose-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6">
            <AlertTriangle size={32} className="md:w-10 md:h-10" />
          </div>
          <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-2">Phát hiện hành vi bất thường!</h3>
          <p className="text-rose-600 font-bold mb-4">Lần vi phạm thứ: {violations}</p>
          <div className="bg-slate-50 p-3 md:p-4 rounded-xl md:rounded-2xl mb-6 md:mb-8 text-slate-600 text-xs md:text-sm italic">
            "{lastViolationMsg}"
          </div>
          <p className="text-sm md:text-base text-slate-500 mb-6 md:mb-8 leading-relaxed">
            Hệ thống đã ghi nhận hành động này và sẽ báo cáo cho giáo viên. Vui lòng tập trung làm bài và không rời khỏi trình duyệt.
          </p>
          <button
            onClick={() => {
              setShowViolationWarning(false);
              if (!isFullscreen) enterFullscreen();
            }}
            className="w-full py-3 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl font-bold hover:bg-slate-800 transition-all text-sm md:text-base"
          >
            Tôi đã hiểu và cam kết không tái phạm
          </button>
        </div>
      </Modal>
    </div>
  );
};
