import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, BookOpen, FileText, Send, AlertCircle, Upload, File as FileIcon, X, Video, HelpCircle, Code, Image as ImageIcon, Check, Sparkles, RefreshCw } from 'lucide-react';
import { dataProvider } from '../../core/provider';
import { Lesson, Progress, Assignment, Submission, InteractiveBlock } from '../../core/types';
import { ensureArray } from '../../core/utils/data';
import { AITutor } from '../../components/AITutor';

export const LessonDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = dataProvider.getCurrentUser();
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [submissionContents, setSubmissionContents] = useState<Record<string, string>>({});
  const [submissionFiles, setSubmissionFiles] = useState<Record<string, { file: File, base64: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [isMarking, setIsMarking] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<Record<string, { correct: boolean, message: string }>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [isSubmittingEssay, setIsSubmittingEssay] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (id && user) {
      fetchData();
    }
  }, [id, user]);

  const fetchData = async () => {
    try {
      const lesData = await dataProvider.getOne<Lesson>('lessons', id!);
      setLesson(lesData);
      
      const progData = await dataProvider.getList<Progress>('progresses');
      const userProgress = progData.find(p => p.studentId === user?.id && p.lessonId === id);
      setProgress(userProgress || null);

      // Initialize quiz answers and feedback from progress
      if (userProgress?.quizScores && lesData.interactiveContent) {
        const answers: Record<string, string> = {};
        const feedbacks: Record<string, { correct: boolean, message: string }> = {};
        
        lesData.interactiveContent.forEach(block => {
          if (block.type === 'interactive_question' && block.data.interactiveQuestion) {
            const score = userProgress.quizScores?.[block.id];
            if (score !== undefined) {
              const q = block.data.interactiveQuestion;
              const isCorrect = score === 10;
              const correctAnswer = Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer;
              answers[block.id] = isCorrect ? (correctAnswer || 'Đã trả lời') : 'Đã trả lời';
              feedbacks[block.id] = {
                correct: isCorrect,
                message: isCorrect ? 'Chính xác! Chúc mừng bạn.' : `Chưa đúng. Đáp án đúng là: ${correctAnswer}. ${q.explanation || ''}`
              };
            }
          }
        });
        setQuizAnswers(answers);
        setQuizFeedback(feedbacks);
      }

      if (userProgress?.essayAnswers) {
        setEssayAnswers(userProgress.essayAnswers);
      }

      // Fetch assignments for this lesson
      const allAssignments = await dataProvider.getList<Assignment>('assignments');
      const lessonAssignments = allAssignments.filter(a => a.lessonId === id);
      setAssignments(lessonAssignments);

      // Fetch submissions for these assignments by this student
      const allSubmissions = await dataProvider.getList<Submission>('submissions');
      const studentSubmissions = allSubmissions.filter(s => s.studentId === user?.id && s.assignmentId);
      
      const subsMap: Record<string, Submission> = {};
      studentSubmissions.forEach(sub => {
        if (sub.assignmentId) {
          subsMap[sub.assignmentId] = sub;
        }
      });
      setSubmissions(subsMap);

    } catch (error) {
      console.error("Error fetching lesson:", error);
      navigate('/app/lessons');
    }
  };

  const handleContentChange = (assignmentId: string, content: string) => {
    setSubmissionContents(prev => ({ ...prev, [assignmentId]: content }));
  };

  const handleFileChange = (assignmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 2MB to avoid localStorage quota issues)
    if (file.size > 2 * 1024 * 1024) {
      alert('Vui lòng chọn file có dung lượng nhỏ hơn 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSubmissionFiles(prev => ({
        ...prev,
        [assignmentId]: { file, base64: reader.result as string }
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeFile = (assignmentId: string) => {
    setSubmissionFiles(prev => {
      const newState = { ...prev };
      delete newState[assignmentId];
      return newState;
    });
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
    if (!user) return;
    const content = submissionContents[assignmentId] || '';
    const fileData = submissionFiles[assignmentId];
    
    if (!content.trim() && !fileData) {
      alert('Vui lòng nhập nội dung bài làm hoặc tải file đính kèm.');
      return;
    }

    setIsSubmitting(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const newSubmission = await dataProvider.submitAssignment({
        assignmentId,
        studentId: user.id,
        content: content.trim(),
        fileName: fileData?.file.name,
        fileUrl: fileData?.base64
      });
      
      // Award XP for assignment submission
      await dataProvider.awardXP(user.id, 30);
      
      setSubmissions(prev => ({ ...prev, [assignmentId]: newSubmission }));
      alert('Nộp bài thành công! Bạn nhận được 30 XP.');
    } catch (error) {
      console.error("Error submitting assignment:", error);
      alert('Có lỗi xảy ra khi nộp bài.');
    } finally {
      setIsSubmitting(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  const handleMarkAsLearned = async () => {
    if (!user || !lesson || isMarking) return;
    
    setIsMarking(true);
    try {
      if (progress) {
        if (progress.completed) return;
        
        const updatedProgress = {
          ...progress,
          completed: true,
          completedAt: new Date().toISOString()
        };
        const updated = await dataProvider.update<Progress>('progresses', progress.id, updatedProgress);
        setProgress(updated);
      } else {
        const newProgress: Omit<Progress, 'id'> = {
          studentId: user.id,
          lessonId: lesson.id,
          completed: true,
          completedAt: new Date().toISOString(),
          quizScores: {}
        };
        
        const created = await dataProvider.create<Progress>('progresses', newProgress);
        setProgress(created);
      }
      
      // Award XP for lesson completion
      await dataProvider.awardXP(user.id, 50);
      
      alert('Chúc mừng! Bạn đã hoàn thành bài học và nhận được 50 XP.');
    } catch (error) {
      console.error("Error marking as learned:", error);
      alert('Có lỗi xảy ra khi đánh dấu đã học.');
    } finally {
      setIsMarking(false);
    }
  };

  const handleQuizSubmit = async (blockId: string, selectedOption: string, correctAnswer: string) => {
    if (!user || !lesson) return;
    
    setQuizAnswers(prev => ({ ...prev, [blockId]: selectedOption }));
    const isCorrect = selectedOption === correctAnswer;
    setQuizFeedback(prev => ({ 
      ...prev, 
      [blockId]: { 
        correct: isCorrect, 
        message: isCorrect ? 'Chính xác! Chúc mừng bạn.' : `Chưa đúng rồi. Đáp án đúng là: ${correctAnswer}` 
      } 
    }));

    // Update progress score
    try {
      if (isCorrect) {
        await dataProvider.awardXP(user.id, 10);
      }
      
      if (progress) {
        const newScores = { ...(progress.quizScores || {}), [blockId]: isCorrect ? 10 : 0 };
        const updatedProgress = { ...progress, quizScores: newScores };
        const result = await dataProvider.update<Progress>('progresses', progress.id, updatedProgress);
        setProgress(result);
      } else {
        const newProgress: Omit<Progress, 'id'> = {
          studentId: user.id,
          lessonId: lesson.id,
          completed: false,
          quizScores: { [blockId]: isCorrect ? 10 : 0 }
        };
        const created = await dataProvider.create<Progress>('progresses', newProgress);
        setProgress(created);
      }
    } catch (error) {
      console.error("Error updating progress with quiz score:", error);
    }
  };

  const handleEssaySubmit = async (questionId: string) => {
    if (!user || !lesson) return;
    
    const answer = essayAnswers[questionId];
    if (!answer || !answer.trim()) {
      alert('Vui lòng nhập câu trả lời.');
      return;
    }

    setIsSubmittingEssay(prev => ({ ...prev, [questionId]: true }));
    try {
      if (progress) {
        const newAnswers = { ...(progress.essayAnswers || {}), [questionId]: answer };
        const updatedProgress = { ...progress, essayAnswers: newAnswers };
        const result = await dataProvider.update<Progress>('progresses', progress.id, updatedProgress);
        setProgress(result);
      } else {
        const newProgress: Omit<Progress, 'id'> = {
          studentId: user.id,
          lessonId: lesson.id,
          completed: false,
          essayAnswers: { [questionId]: answer }
        };
        const created = await dataProvider.create<Progress>('progresses', newProgress);
        setProgress(created);
      }
      await dataProvider.awardXP(user.id, 10);
      alert('Đã lưu câu trả lời tự luận! Bạn nhận được 10 XP.');
    } catch (error) {
      console.error("Error saving essay answer:", error);
      alert('Có lỗi xảy ra khi lưu câu trả lời.');
    } finally {
      setIsSubmittingEssay(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const renderInteractiveBlock = (block: InteractiveBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div key={block.id} className="my-6 text-gray-700 leading-relaxed whitespace-pre-wrap">
            {block.data.content}
          </div>
        );
      case 'video':
        const videoId = block.data.url?.includes('youtube.com/watch?v=') 
          ? block.data.url.split('v=')[1].split('&')[0]
          : block.data.url?.includes('youtu.be/')
          ? block.data.url.split('youtu.be/')[1].split('?')[0]
          : null;

        return (
          <div key={block.id} className="my-8">
            <div className="aspect-video rounded-2xl overflow-hidden shadow-lg bg-black">
              {videoId ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title={block.data.caption || "Video lesson"}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white gap-2">
                  <Video size={32} />
                  <span>Video URL không hợp lệ</span>
                </div>
              )}
            </div>
            {block.data.caption && (
              <p className="text-center text-sm text-gray-500 mt-3 italic">{block.data.caption}</p>
            )}
          </div>
        );
      case 'image':
        return (
          <div key={block.id} className="my-8">
            <img 
              src={block.data.url} 
              alt={block.data.caption || "Lesson image"} 
              className="rounded-2xl shadow-md max-w-full mx-auto"
              referrerPolicy="no-referrer"
            />
            {block.data.caption && (
              <p className="text-center text-sm text-gray-500 mt-3 italic">{block.data.caption}</p>
            )}
          </div>
        );
      case 'code':
        return (
          <div key={block.id} className="my-6">
            <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 rounded-t-xl text-xs font-mono">
              <span>{block.data.language?.toUpperCase() || 'CODE'}</span>
              <Code size={14} />
            </div>
            <pre className="bg-gray-900 text-emerald-400 p-4 rounded-b-xl overflow-x-auto font-mono text-sm">
              <code>{block.data.content}</code>
            </pre>
          </div>
        );
      case 'quiz':
        const feedback = quizFeedback[block.id];
        const selected = quizAnswers[block.id];

        return (
          <div key={block.id} className="my-10 p-6 bg-indigo-50/30 border-2 border-indigo-100 rounded-2xl">
            <div className="flex items-center gap-2 text-indigo-700 mb-4">
              <HelpCircle size={20} />
              <span className="font-bold">Câu hỏi tương tác</span>
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-4">{block.data.question}</h4>
            <div className="space-y-3">
              {ensureArray(block.data.options).map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => !feedback && handleQuizSubmit(block.id, option, block.data.correctAnswer || '')}
                  disabled={!!feedback}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                    selected === option
                      ? feedback?.correct
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                      : feedback && option === block.data.correctAnswer
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white hover:border-indigo-300 text-gray-700'
                  }`}
                >
                  <span>{option}</span>
                  {selected === option && (
                    feedback?.correct ? <Check size={18} /> : <X size={18} />
                  )}
                  {feedback && option === block.data.correctAnswer && selected !== option && (
                    <Check size={18} />
                  )}
                </button>
              ))}
            </div>
            {feedback && (
              <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${feedback.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {feedback.correct ? <CheckCircle size={20} className="mt-0.5" /> : <AlertCircle size={20} className="mt-0.5" />}
                <p className="font-medium">{feedback.message}</p>
              </div>
            )}
          </div>
        );
      case 'interactive_question':
        const iq = block.data.interactiveQuestion;
        if (!iq) return null;
        const iqSelected = quizAnswers[block.id];
        const iqFeedback = quizFeedback[block.id];

        const handleAnswer = async (answer: string, customFeedback?: { correct: boolean, message: string }) => {
          if (iqFeedback) return; // Already answered
          setQuizAnswers(prev => ({ ...prev, [block.id]: answer }));
          
          const isCorrect = customFeedback ? customFeedback.correct : (answer === iq.correctAnswer);
          const feedbackMessage = customFeedback 
            ? customFeedback.message 
            : (isCorrect ? 'Chính xác! Chúc mừng bạn.' : `Chưa đúng. Đáp án đúng là: ${iq.correctAnswer}. ${iq.explanation || ''}`);

          setQuizFeedback(prev => ({ 
            ...prev, 
            [block.id]: { 
              correct: isCorrect, 
              message: feedbackMessage
            } 
          }));

          // Update progress score
          try {
            if (progress) {
              const newScores = { ...(progress.quizScores || {}), [block.id]: isCorrect ? 10 : 0 };
              const updatedProgress = { ...progress, quizScores: newScores };
              const result = await dataProvider.update<Progress>('progresses', progress.id, updatedProgress);
              setProgress(result);
            } else if (user && lesson) {
              const newProgress: Omit<Progress, 'id'> = {
                studentId: user.id,
                lessonId: lesson.id,
                completed: false,
                quizScores: { [block.id]: isCorrect ? 10 : 0 }
              };
              const created = await dataProvider.create<Progress>('progresses', newProgress);
              setProgress(created);
            }
          } catch (error) {
            console.error("Error updating progress with quiz score:", error);
          }
        };

        return (
          <div key={block.id} className="my-10 p-6 bg-indigo-50/30 border-2 border-indigo-100 rounded-2xl">
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <HelpCircle size={20} />
              <span className="text-sm font-bold uppercase tracking-wider">Câu hỏi tương tác</span>
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-6">{iq.question}</h4>
            
            {iq.type === 'mcq' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ensureArray(iq.options).map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(option)}
                    disabled={!!iqFeedback}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                      iqSelected === option
                        ? iqFeedback?.correct 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' 
                          : 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : iqFeedback && option === iq.correctAnswer
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white hover:border-indigo-300 text-gray-700'
                    }`}
                  >
                    <span className="font-medium">{option}</span>
                    {iqSelected === option && (
                      iqFeedback?.correct ? <Check size={18} /> : <X size={18} />
                    )}
                    {iqFeedback && option === iq.correctAnswer && iqSelected !== option && (
                      <Check size={18} />
                    )}
                  </button>
                ))}
              </div>
            )}

            {iq.type === 'true_false' && (
              <div className="flex gap-4">
                {['Đúng', 'Sai'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    disabled={!!iqFeedback}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 font-bold ${
                      iqSelected === option
                        ? iqFeedback?.correct 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                          : 'border-red-500 bg-red-50 text-red-700'
                        : iqFeedback && option === iq.correctAnswer
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white hover:border-indigo-300 text-gray-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {iq.type === 'fill_in_the_blank' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={iqSelected || ''}
                    onChange={e => setQuizAnswers(prev => ({ ...prev, [block.id]: e.target.value }))}
                    disabled={!!iqFeedback}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Nhập câu trả lời của bạn..."
                  />
                  {!iqFeedback && (
                    <button
                      onClick={() => handleAnswer(iqSelected)}
                      className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      Kiểm tra
                    </button>
                  )}
                </div>
              </div>
            )}

            {iq.type === 'drag_drop' && (
              <DragDropMatching 
                options={ensureArray(iq.options)} 
                explanation={iq.explanation}
                onComplete={(isCorrect, message) => handleAnswer(isCorrect ? 'correct' : 'incorrect', { correct: isCorrect, message })}
                disabled={!!iqFeedback}
              />
            )}

            {iq.type === 'click_reveal' && (
              <ClickRevealDiscovery 
                options={ensureArray(iq.options)} 
                correctAnswer={iq.correctAnswer || ''}
                onComplete={() => handleAnswer('completed')}
                disabled={!!iqFeedback}
              />
            )}

            {iqFeedback && (
              <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 animate-in zoom-in-95 duration-300 ${iqFeedback.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {iqFeedback.correct ? <CheckCircle size={20} className="mt-0.5" /> : <AlertCircle size={20} className="mt-0.5" />}
                <div>
                  <p className="font-bold">{iqFeedback.correct ? 'Tuyệt vời!' : 'Rất tiếc!'}</p>
                  <p className="text-sm opacity-90">{iqFeedback.message}</p>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    
    // Google Slides
    if (url.includes('docs.google.com/presentation/d/')) {
      const baseUrl = url.split(/[?#]/)[0]; // Remove params
      if (baseUrl.endsWith('/embed')) return baseUrl;
      return baseUrl.replace(/\/edit$/, '').replace(/\/view$/, '') + '/embed';
    }

    // Google Drive File (PDF, PPTX, etc.)
    if (url.includes('drive.google.com/file/d/')) {
      const baseUrl = url.split(/[?#]/)[0];
      if (baseUrl.endsWith('/preview')) return baseUrl;
      return baseUrl.replace(/\/view$/, '').replace(/\/edit$/, '') + '/preview';
    }
    
    // Office Online Viewer (better for direct .pptx links)
    if (url.toLowerCase().endsWith('.pptx') || url.toLowerCase().endsWith('.ppt') || url.includes('onedrive.live.com')) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }

    // Fallback to Google Docs Viewer
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  };

  const getVideoEmbedUrl = (url: string) => {
    if (!url) return null;
    
    // YouTube
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1].split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    
    // Google Drive Video
    if (url.includes('drive.google.com/file/d/')) {
      const baseUrl = url.split(/[?#]/)[0];
      if (baseUrl.endsWith('/preview')) return baseUrl;
      return baseUrl.replace(/\/view$/, '').replace(/\/edit$/, '') + '/preview';
    }

    return url;
  };

  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button 
        onClick={() => navigate('/app/lessons')}
        className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors mb-6"
      >
        <ArrowLeft size={20} />
        <span>Quay lại danh sách bài học</span>
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 bg-indigo-50/50 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <BookOpen size={20} />
                <span className="font-medium">Bài giảng</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
            </div>
            
            {progress?.completed ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-medium">
                <CheckCircle size={20} />
                <span>Đã hoàn thành</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl font-medium">
                <Clock size={20} />
                <span>Chưa hoàn thành</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {progress?.teacherFeedback && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
              <Sparkles className="text-amber-600 mt-1 shrink-0" size={20} />
              <div>
                <h4 className="font-bold text-amber-900 text-sm mb-1">Nhận xét từ giáo viên</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{progress.teacherFeedback.comment}</p>
                <p className="text-[10px] text-amber-600 mt-2">
                  Ngày gửi: {new Date(progress.teacherFeedback.date).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          )}

          <div className="prose prose-indigo max-w-none">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Nội dung / Yêu cầu cần đạt</h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-6 rounded-xl border border-gray-100">
              {lesson.content}
            </div>
          </div>

          {lesson.videoUrl && (
            <div className="mt-8 p-6 bg-red-50/30 border-2 border-red-100 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-red-700">
                  <Video size={20} />
                  <span className="font-bold">Bài giảng Video</span>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={lesson.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    <RefreshCw size={16} />
                    Mở trong tab mới
                  </a>
                </div>
              </div>
              
              <div className="aspect-video rounded-xl overflow-hidden border border-gray-200 bg-black shadow-inner">
                <iframe
                  src={getVideoEmbedUrl(lesson.videoUrl) || ''}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  title="Video Player"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                ></iframe>
              </div>
            </div>
          )}

          {lesson.pptUrl && (
            <div className="mt-8 p-6 bg-indigo-50/30 border-2 border-indigo-100 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-indigo-700">
                  <FileIcon size={20} />
                  <span className="font-bold">Tài liệu PowerPoint</span>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={lesson.pptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-medium"
                  >
                    <RefreshCw size={16} />
                    Mở trong tab mới
                  </a>
                  <a 
                    href={lesson.pptUrl} 
                    download={`${lesson.title}.pptx`}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    <Upload size={16} className="rotate-180" />
                    Tải về máy
                  </a>
                </div>
              </div>
              
              {lesson.pptUrl.startsWith('http') ? (
                <div className="aspect-video rounded-xl overflow-hidden border border-gray-200 bg-white shadow-inner">
                  <iframe
                    src={getEmbedUrl(lesson.pptUrl) || ''}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    title="PowerPoint Viewer"
                    allowFullScreen
                  ></iframe>
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-gray-300">
                  <FileIcon size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">File PowerPoint đã được tải lên. Nhấn nút "Tải về máy" để xem nội dung.</p>
                </div>
              )}
            </div>
          )}

          {/* Interactive Content Blocks */}
          {ensureArray(lesson.interactiveContent).length > 0 && (
            <div className="mt-8 space-y-2">
              {ensureArray(lesson.interactiveContent).map(block => renderInteractiveBlock(block))}
            </div>
          )}

          {/* Essay Questions */}
          {ensureArray(lesson.essayQuestions).length > 0 && (
            <div className="mt-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="text-indigo-600" size={24} />
                Câu hỏi tự luận
              </h3>
              {ensureArray(lesson.essayQuestions).map((question, index) => (
                <div key={question.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <h4 className="text-md font-bold text-gray-900 mb-3">Câu {index + 1}: {question.content}</h4>
                  <div className="space-y-3">
                    <textarea
                      value={essayAnswers[question.id] || ''}
                      onChange={(e) => setEssayAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                      placeholder="Nhập câu trả lời của bạn..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px]"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleEssaySubmit(question.id)}
                        disabled={isSubmittingEssay[question.id]}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSubmittingEssay[question.id] ? (
                          <>
                            <RefreshCw className="animate-spin" size={18} />
                            Đang lưu...
                          </>
                        ) : (
                          <>
                            <Send size={18} />
                            Lưu câu trả lời
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {assignments.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <FileText className="text-indigo-600" size={24} />
                Bài tập về nhà
              </h3>
              
              <div className="space-y-6">
                {assignments.map(assignment => {
                  const submission = submissions[assignment.id];
                  const isPastDue = new Date(assignment.dueDate) < new Date();
                  
                  return (
                    <div key={assignment.id} className="bg-white border-2 border-indigo-50 rounded-2xl p-6 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">{assignment.title}</h4>
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <Clock size={14} />
                            Hạn nộp: {new Date(assignment.dueDate).toLocaleDateString('vi-VN')}
                            {isPastDue && !submission && <span className="text-red-500 font-medium ml-2">(Đã quá hạn)</span>}
                          </p>
                        </div>
                        {submission && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                            <CheckCircle size={14} />
                            Đã nộp
                          </span>
                        )}
                      </div>
                      
                      <div className="bg-indigo-50/50 p-4 rounded-xl text-gray-700 whitespace-pre-wrap text-sm mb-6 border border-indigo-100">
                        {assignment.description}
                      </div>

                      {submission ? (
                        <div className="space-y-4">
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h5 className="text-sm font-bold text-gray-700 mb-2">Bài làm của bạn:</h5>
                            <div className="text-gray-600 whitespace-pre-wrap text-sm">
                              {submission.content || <span className="italic text-gray-400">Không có nội dung văn bản</span>}
                            </div>
                            {submission.fileName && (
                              <div className="mt-3 flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">File đính kèm:</span>
                                <a 
                                  href={submission.fileUrl} 
                                  download={submission.fileName} 
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                                >
                                  <FileIcon size={14} />
                                  <span className="truncate max-w-[200px]">{submission.fileName}</span>
                                </a>
                              </div>
                            )}
                            <p className="text-xs text-gray-400 mt-3">
                              Nộp lúc: {new Date(submission.submittedAt).toLocaleString('vi-VN')}
                            </p>
                          </div>
                          
                          {(submission.score !== undefined || submission.feedback) && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                              <h5 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                                <AlertCircle size={16} />
                                Nhận xét từ giáo viên:
                              </h5>
                              {submission.score !== undefined && (
                                <p className="text-amber-900 font-bold mb-1">Điểm: {submission.score}/10</p>
                              )}
                              {submission.feedback && (
                                <p className="text-amber-800 text-sm whitespace-pre-wrap">{submission.feedback}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            rows={5}
                            placeholder="Nhập câu trả lời của bạn vào đây..."
                            value={submissionContents[assignment.id] || ''}
                            onChange={(e) => handleContentChange(assignment.id, e.target.value)}
                            disabled={isPastDue}
                            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                          
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium ${isPastDue ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
                                <Upload size={16} />
                                Tải file lên
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".docx,.pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => handleFileChange(assignment.id, e)}
                                  disabled={isPastDue}
                                />
                              </label>
                              
                              {submissionFiles[assignment.id] && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm border border-gray-200">
                                  <FileIcon size={14} className="text-indigo-600" />
                                  <span className="truncate max-w-[150px]">{submissionFiles[assignment.id].file.name}</span>
                                  <button 
                                    onClick={() => removeFile(assignment.id)} 
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    disabled={isPastDue}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => handleSubmitAssignment(assignment.id)}
                              disabled={isSubmitting[assignment.id] || isPastDue || (!submissionContents[assignment.id]?.trim() && !submissionFiles[assignment.id])}
                              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                              {isSubmitting[assignment.id] ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              ) : (
                                <Send size={18} />
                              )}
                              <span>Nộp bài</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action */}
          <div className="mt-10 flex justify-center border-t border-gray-100 pt-8">
            <button
              onClick={handleMarkAsLearned}
              disabled={progress?.completed || isMarking}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-lg transition-all ${
                progress?.completed 
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              <CheckCircle size={24} />
              <span>{progress?.completed ? 'Bạn đã hoàn thành bài học này' : 'Đánh dấu đã học'}</span>
            </button>
          </div>
        </div>
      </div>
      
      {lesson && (
        <AITutor 
          lessonTitle={lesson.title} 
          lessonContent={lesson.content} 
          interactiveContent={lesson.interactiveContent}
          userName={user?.fullName} 
        />
      )}
    </div>
  );
};

const ClickRevealDiscovery = ({ options, correctAnswer, onComplete, disabled }: { options: string[], correctAnswer: string | string[], onComplete: (isCorrect: boolean) => void, disabled: boolean }) => {
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  
  const handleReveal = (idx: number) => {
    if (!revealedIndices.includes(idx)) {
      setRevealedIndices(prev => [...prev, idx]);
    }
  };

  const isAllRevealed = revealedIndices.length === options.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((title, idx) => (
          <div key={idx} className="border-2 border-indigo-100 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
            <button
              onClick={() => handleReveal(idx)}
              className={`w-full p-4 text-left font-bold transition-colors flex justify-between items-center ${
                revealedIndices.includes(idx) ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {title}
              <span className="text-xs font-normal">{revealedIndices.includes(idx) ? 'Đã xem' : 'Nhấn để xem'}</span>
            </button>
            {revealedIndices.includes(idx) && (
              <div className="p-4 text-sm text-gray-600 animate-in fade-in slide-in-from-top-2 duration-300">
                {Array.isArray(correctAnswer) ? correctAnswer[idx] : correctAnswer}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {!disabled && isAllRevealed && (
        <button
          onClick={() => onComplete(true)}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors mt-4 shadow-lg shadow-indigo-200"
        >
          Tôi đã hoàn thành việc tìm hiểu
        </button>
      )}
    </div>
  );
};

const DragDropMatching = ({ options, explanation, onComplete, disabled }: { options: string[], explanation?: string, onComplete: (isCorrect: boolean, message: string) => void, disabled: boolean }) => {
  const [pairs] = useState(() => options.map(o => o.split('|')));
  const [leftItems] = useState(() => pairs.map(p => p[0]));
  const [rightItems] = useState(() => [...pairs.map(p => p[1])].sort(() => Math.random() - 0.5));
  
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({}); // leftIdx -> rightIdx
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<Record<number, boolean>>({});

  const colors = [
    'border-blue-200 bg-blue-50 text-blue-700',
    'border-purple-200 bg-purple-50 text-purple-700',
    'border-amber-200 bg-amber-50 text-amber-700',
    'border-pink-200 bg-pink-50 text-pink-700',
    'border-cyan-200 bg-cyan-50 text-cyan-700',
  ];

  const handleMatch = (leftIdx: number, rightIdx: number) => {
    if (disabled || isChecking) return;
    
    // If this right item was already matched, remove the old match
    const oldLeftIdx = Object.keys(matches).find(k => matches[parseInt(k)] === rightIdx);
    
    setMatches(prev => {
      const next = { ...prev };
      if (oldLeftIdx !== undefined) delete next[parseInt(oldLeftIdx)];
      next[leftIdx] = rightIdx;
      return next;
    });
    setSelectedLeft(null);
  };

  const checkAnswers = () => {
    setIsChecking(true);
    let correctCount = 0;
    const newResults: Record<number, boolean> = {};

    pairs.forEach((pair, leftIdx) => {
      const matchedRightIdx = matches[leftIdx];
      const isCorrect = matchedRightIdx !== undefined && rightItems[matchedRightIdx] === pair[1];
      newResults[leftIdx] = isCorrect;
      if (isCorrect) correctCount++;
    });

    setResults(newResults);
    const isAllCorrect = correctCount === pairs.length;
    
    const message = isAllCorrect 
      ? 'Tuyệt vời! Bạn đã ghép đúng tất cả các cặp.' 
      : `Bạn đã ghép đúng ${correctCount}/${pairs.length} cặp. ${explanation || ''}`;
      
    onComplete(isAllCorrect, message);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        {/* Column A */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Cột A</p>
          {leftItems.map((item, idx) => {
            const matchedRightIdx = matches[idx];
            const isMatched = matchedRightIdx !== undefined;
            const colorClass = isMatched ? colors[idx % colors.length] : '';
            const resultClass = isChecking ? (results[idx] ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700') : '';

            return (
              <button
                key={idx}
                onClick={() => setSelectedLeft(idx)}
                disabled={disabled || isChecking}
                className={`w-full p-4 text-sm text-left rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                  selectedLeft === idx ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-200' : 
                  isChecking ? resultClass :
                  isMatched ? colorClass :
                  'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isMatched || selectedLeft === idx ? 'bg-current bg-opacity-10' : 'bg-gray-100 text-gray-400'}`}>
                  {idx + 1}
                </span>
                <span className="font-medium">{item}</span>
                {isChecking && (
                  <div className="ml-auto">
                    {results[idx] ? <Check size={16} /> : <X size={16} />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Column B */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Cột B</p>
          {rightItems.map((item, idx) => {
            const matchedLeftIdxStr = Object.keys(matches).find(k => matches[parseInt(k)] === idx);
            const matchedLeftIdx = matchedLeftIdxStr !== undefined ? parseInt(matchedLeftIdxStr) : undefined;
            const isMatched = matchedLeftIdx !== undefined;
            const colorClass = isMatched ? colors[matchedLeftIdx % colors.length] : '';
            const resultClass = isChecking && matchedLeftIdx !== undefined ? (results[matchedLeftIdx] ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700') : '';

            return (
              <button
                key={idx}
                onClick={() => {
                  if (selectedLeft !== null) {
                    handleMatch(selectedLeft, idx);
                  }
                }}
                disabled={disabled || isChecking || (selectedLeft === null && !isMatched)}
                className={`w-full p-4 text-sm text-left rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                  isChecking ? resultClass :
                  isMatched ? colorClass :
                  selectedLeft !== null ? 'border-dashed border-indigo-300 bg-white hover:bg-indigo-50 animate-pulse' :
                  'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isMatched && (
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-current bg-opacity-10">
                    {matchedLeftIdx + 1}
                  </span>
                )}
                <span className="font-medium">{item}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {!disabled && !isChecking && Object.keys(matches).length === pairs.length && (
        <button
          onClick={checkAnswers}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0"
        >
          Kiểm tra kết quả
        </button>
      )}
    </div>
  );
};
