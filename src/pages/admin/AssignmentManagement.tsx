import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, BookOpen, CheckCircle, XCircle, Sparkles, Loader2, FileText, Upload, Users, Check, Video, HelpCircle, Code, Image as ImageIcon, GripVertical, RefreshCw, Search, Download } from 'lucide-react';
import { dataProvider } from '../../core/provider';
import { Lesson, Subject, Topic, Assignment, Submission, User, InteractiveBlock, Class, Question, QuestionType, BankQuestion } from '../../core/types';
import { Modal } from '../../components/Modal';
import { GoogleGenAI } from '@google/genai';
import { ensureArray } from '../../core/utils/data';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

export const AssignmentManagement = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  
  // Filters
  const [filterGrade, setFilterGrade] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterTopicId, setFilterTopicId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignmentStatus, setFilterAssignmentStatus] = useState<'all' | 'pending' | 'submitted' | 'graded' | 'overdue'>('all');
  const [searchTitle, setSearchTitle] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    grade: '10',
    classId: '',
    subjectId: '',
    topicId: '',
    status: 'draft' as 'draft' | 'published',
    order: 1,
    pptUrl: '',
    interactiveContent: [] as InteractiveBlock[]
  });

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Assignment State
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentModalTab, setAssignmentModalTab] = useState<'info' | 'questions'>('info');
  const [selectedLessonForAssignment, setSelectedLessonForAssignment] = useState<Lesson | null>(null);
  const [assignmentFormData, setAssignmentFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // Default 1 week
    classId: '',
    studentIds: [] as string[],
    questions: [] as Question[],
    attachments: [] as string[]
  });

  // Grading State
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [selectedLessonForGrading, setSelectedLessonForGrading] = useState<Lesson | null>(null);
  const [lessonAssignments, setLessonAssignments] = useState<Assignment[]>([]);
  const [lessonSubmissions, setLessonSubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [gradingData, setGradingData] = useState<{ score: string, feedback: string }>({ score: '', feedback: '' });
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);

  // Independent Assignment State
  const [isIndependentAssignmentModalOpen, setIsIndependentAssignmentModalOpen] = useState(false);
  const [independentAssignmentModalTab, setIndependentAssignmentModalTab] = useState<'info' | 'questions'>('info');
  const [editingIndependentAssignmentId, setEditingIndependentAssignmentId] = useState<string | null>(null);
  const [independentAssignmentFormData, setIndependentAssignmentFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    grade: '10',
    classId: '',
    subjectId: '',
    topicId: '',
    studentIds: [] as string[],
    attachments: [] as string[],
    questions: [] as Question[]
  });
  const [classStudents, setClassStudents] = useState<User[]>([]);
  const [selectAllStudents, setSelectAllStudents] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Question Bank Modal State
  const [isQuestionBankModalOpen, setIsQuestionBankModalOpen] = useState(false);
  const [targetFormForQuestionBank, setTargetFormForQuestionBank] = useState<'lesson' | 'independent'>('lesson');
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [selectedBankQuestions, setSelectedBankQuestions] = useState<string[]>([]);
  const [qbFilterSubject, setQbFilterSubject] = useState('');
  const [qbFilterTopic, setQbFilterTopic] = useState('');
  const [qbFilterDifficulty, setQbFilterDifficulty] = useState('');
  const [qbFilterType, setQbFilterType] = useState('');
  const [qbSearch, setQbSearch] = useState('');

  // File Import state
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState<Partial<Question>>({
    type: 'multiple_choice',
    difficulty: 'recognition',
    content: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    points: 1
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [lesData, subData, topData, classData, studentData, assignData, bankQuestionsData, submissionData] = await Promise.all([
      dataProvider.getList<Lesson>('lessons'),
      dataProvider.getList<Subject>('subjects'),
      dataProvider.getList<Topic>('topics'),
      dataProvider.getList<Class>('classes'),
      dataProvider.getList<User>('users', { role: 'student' }),
      dataProvider.getList<Assignment>('assignments'),
      dataProvider.getList<BankQuestion>('bank_questions'),
      dataProvider.getList<Submission>('submissions')
    ]);
    setLessons(lesData);
    setSubjects(subData);
    setTopics(topData);
    setClasses(classData);
    setStudents(studentData);
    setAssignments(assignData);
    setBankQuestions(bankQuestionsData);
    setAllSubmissions(submissionData);
  };

  const handleOpenQuestionBankModal = (formType: 'lesson' | 'independent') => {
    setTargetFormForQuestionBank(formType);
    setQbFilterType('');
    setSelectedBankQuestions([]);
    setIsQuestionBankModalOpen(true);
  };

  const handleConfirmQuestionBank = () => {
    const selectedQs = bankQuestions.filter(q => selectedBankQuestions.includes(q.id));
    if (selectedQs.length === 0) {
      setIsQuestionBankModalOpen(false);
      return;
    }

    const newQuestions = selectedQs.map(q => {
      const { subjectId, topicId, createdAt, ...rest } = q;
      return rest as Question;
    });

    if (targetFormForQuestionBank === 'lesson') {
      setAssignmentFormData(prev => ({
        ...prev,
        questions: [...(prev.questions || []), ...newQuestions]
      }));
    } else {
      setIndependentAssignmentFormData(prev => ({
        ...prev,
        questions: [...(prev.questions || []), ...newQuestions]
      }));
    }

    setIsQuestionBankModalOpen(false);
  };

  const handleOpenQuestionModal = (formType: 'lesson' | 'independent', index?: number, type?: QuestionType) => {
    setTargetFormForQuestionBank(formType);
    const currentForm = formType === 'lesson' ? assignmentFormData : independentAssignmentFormData;
    
    if (index !== undefined && currentForm.questions) {
      setEditingQuestionIndex(index);
      const q = { ...currentForm.questions[index] };
      if (typeof q.options === 'string') {
        try {
          q.options = JSON.parse(q.options);
        } catch (e) {
          q.options = ['', '', '', ''];
        }
      }
      if (typeof q.subQuestions === 'string') {
        try {
          q.subQuestions = JSON.parse(q.subQuestions);
        } catch (e) {
          q.subQuestions = [];
        }
      }
      if (q.type === 'true_false' && (!q.subQuestions || q.subQuestions.length === 0)) {
        q.subQuestions = [
          { id: 'a', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'b', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'c', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'd', content: '', difficulty: 'recognition', correctAnswer: true }
        ];
      }
      setQuestionForm(q);
    } else {
      setEditingQuestionIndex(null);
      const defaultType = type || 'multiple_choice';
      setQuestionForm({
        type: defaultType,
        difficulty: 'recognition',
        content: '',
        options: defaultType === 'multiple_choice' ? ['', '', '', ''] : [],
        correctAnswer: defaultType === 'true_false' ? 'true' : '',
        subQuestions: defaultType === 'true_false' ? [
          { id: 'a', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'b', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'c', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'd', content: '', difficulty: 'recognition', correctAnswer: true }
        ] : [],
        points: 1
      });
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const currentForm = targetFormForQuestionBank === 'lesson' ? assignmentFormData : independentAssignmentFormData;
    const newQuestions = [...(currentForm.questions || [])];
    const q = { 
      ...questionForm, 
      id: questionForm.id || Math.random().toString(36).substr(2, 9),
      points: questionForm.type === 'true_false' ? 1 : questionForm.points
    } as Question;
    
    if (editingQuestionIndex !== null) {
      newQuestions[editingQuestionIndex] = q;
    } else {
      newQuestions.push(q);
    }
    
    if (targetFormForQuestionBank === 'lesson') {
      setAssignmentFormData({ ...assignmentFormData, questions: newQuestions });
    } else {
      setIndependentAssignmentFormData({ ...independentAssignmentFormData, questions: newQuestions });
    }
    setIsQuestionModalOpen(false);
  };

  const removeQuestion = (formType: 'lesson' | 'independent', index: number) => {
    if (formType === 'lesson') {
      const newQuestions = [...(assignmentFormData.questions || [])];
      newQuestions.splice(index, 1);
      setAssignmentFormData({ ...assignmentFormData, questions: newQuestions });
    } else {
      const newQuestions = [...(independentAssignmentFormData.questions || [])];
      newQuestions.splice(index, 1);
      setIndependentAssignmentFormData({ ...independentAssignmentFormData, questions: newQuestions });
    }
  };

  const updateQuestionPoints = (formType: 'lesson' | 'independent', index: number, points: number) => {
    if (formType === 'lesson') {
      const newQuestions = [...(assignmentFormData.questions || [])];
      newQuestions[index] = { ...newQuestions[index], points };
      setAssignmentFormData({ ...assignmentFormData, questions: newQuestions });
    } else {
      const newQuestions = [...(independentAssignmentFormData.questions || [])];
      newQuestions[index] = { ...newQuestions[index], points };
      setIndependentAssignmentFormData({ ...independentAssignmentFormData, questions: newQuestions });
    }
  };

  const filteredBankQuestions = bankQuestions.filter(q => {
    const matchSubject = !qbFilterSubject || q.subjectId === qbFilterSubject;
    const matchTopic = !qbFilterTopic || q.topicId === qbFilterTopic;
    const matchDifficulty = !qbFilterDifficulty || q.difficulty === qbFilterDifficulty;
    const matchSearch = !qbSearch || q.content?.toLowerCase()?.includes(qbSearch.toLowerCase());
    const matchType = !qbFilterType || q.type === qbFilterType;

    return matchSubject && matchTopic && matchDifficulty && matchSearch && matchType;
  });

  const handleToggleBankQuestion = (id: string) => {
    setSelectedBankQuestions(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const handleOpenModal = (lesson?: Lesson) => {
    if (lesson) {
      setEditingLesson(lesson);
      const topic = topics.find(t => t.id === lesson.topicId);
      setFormData({
        title: lesson.title,
        content: lesson.content,
        grade: lesson.grade || '10',
        classId: lesson.classId || '',
        subjectId: topic?.subjectId || '',
        topicId: lesson.topicId,
        status: lesson.status || 'draft',
        order: lesson.order,
        pptUrl: lesson.pptUrl || '',
        interactiveContent: ensureArray(lesson.interactiveContent)
      });
    } else {
      setEditingLesson(null);
      setFormData({
        title: '',
        content: '',
        grade: '10',
        classId: '',
        subjectId: '',
        topicId: '',
        status: 'draft',
        order: lessons.length + 1,
        pptUrl: '',
        interactiveContent: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topicId) {
      alert('Vui lòng chọn chủ đề');
      return;
    }

    const lessonData = {
      title: formData.title,
      content: formData.content,
      grade: formData.grade,
      classId: formData.classId,
      topicId: formData.topicId,
      status: formData.status,
      order: formData.order,
      pptUrl: formData.pptUrl,
      interactiveContent: formData.interactiveContent
    };

    if (editingLesson) {
      await dataProvider.update('lessons', editingLesson.id, lessonData);
    } else {
      await dataProvider.create('lessons', lessonData);
    }

    setIsModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await dataProvider.delete('assignments', confirmDelete);
      setConfirmDelete(null);
      fetchData();
    }
  };

  const toggleStatus = async (lesson: Lesson) => {
    const newStatus = lesson.status === 'published' ? 'draft' : 'published';
    await dataProvider.update('lessons', lesson.id, { ...lesson, status: newStatus });
    fetchData();
  };

  const addInteractiveBlock = (type: InteractiveBlock['type']) => {
    const newBlock: InteractiveBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      data: type === 'quiz' ? { question: '', options: ['', ''], correctAnswer: '' } : { content: '' }
    };
    setFormData(prev => ({
      ...prev,
      interactiveContent: [...ensureArray(prev.interactiveContent), newBlock]
    }));
  };

  const removeInteractiveBlock = (id: string) => {
    setFormData(prev => ({
      ...prev,
      interactiveContent: ensureArray(prev.interactiveContent).filter(b => b.id !== id)
    }));
  };

  const updateBlockData = (id: string, data: any) => {
    setFormData(prev => ({
      ...prev,
      interactiveContent: ensureArray(prev.interactiveContent).map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b)
    }));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...ensureArray(formData.interactiveContent)];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setFormData(prev => ({ ...prev, interactiveContent: newBlocks }));
  };

  const handleGenerateContent = async () => {
    if (!formData.subjectId || !formData.topicId || !formData.title) {
      alert('Vui lòng chọn môn học, chủ đề và nhập tiêu đề bài giảng trước khi tạo nội dung.');
      return;
    }

    const subject = subjects.find(s => s.id === formData.subjectId);
    const topic = topics.find(t => t.id === formData.topicId);

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Bạn là một giáo viên chuyên nghiệp. Hãy viết "Yêu cầu cần đạt" (Learning Objectives) và nội dung tóm tắt cho bài học sau:
      - Môn học: ${subject?.name}
      - Khối/Lớp: ${formData.grade}
      - Chủ đề: ${topic?.name}
      - Tiêu đề bài học: ${formData.title}
      
      Yêu cầu:
      - Trình bày rõ ràng, súc tích bằng tiếng Việt.
      - Gạch đầu dòng các yêu cầu cần đạt về kiến thức, kỹ năng, thái độ.
      - Viết dưới dạng văn bản thuần túy (không dùng markdown phức tạp).`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        setFormData(prev => ({ ...prev, content: response.text }));
      }
    } catch (error) {
      console.error("Error generating content:", error);
      alert('Có lỗi xảy ra khi tạo nội dung. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenAssignmentModal = (lesson: Lesson) => {
    setSelectedLessonForAssignment(lesson);
    setAssignmentFormData({
      title: `Bài tập: ${lesson.title}`,
      description: '',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      classId: lesson.classId || '',
      studentIds: [],
      questions: [],
      attachments: []
    });
    
    if (lesson.classId) {
      const studentsInClass = students.filter(s => String(s.classId) === String(lesson.classId));
      setClassStudents(studentsInClass);
    } else {
      setClassStudents([]);
    }
    setSelectAllStudents(false);
    setAssignmentModalTab('info');
    
    setIsAssignmentModalOpen(true);
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonForAssignment) return;

    const assignmentData = {
      lessonId: selectedLessonForAssignment.id,
      title: assignmentFormData.title,
      description: assignmentFormData.description,
      dueDate: new Date(assignmentFormData.dueDate).toISOString(),
      grade: selectedLessonForAssignment.grade,
      classId: assignmentFormData.classId || selectedLessonForAssignment.classId,
      studentIds: assignmentFormData.studentIds,
      subjectId: topics.find(t => t.id === selectedLessonForAssignment.topicId)?.subjectId,
      topicId: selectedLessonForAssignment.topicId,
      questions: assignmentFormData.questions,
      attachments: assignmentFormData.attachments
    };

    await dataProvider.create('assignments', assignmentData);
    alert('Đã giao bài tập thành công!');
    setIsAssignmentModalOpen(false);
  };

  const handleOpenGradingModal = async (lesson: Lesson) => {
    setSelectedLessonForGrading(lesson);
    
    // Fetch assignments for this lesson
    const allAssignments = await dataProvider.getList<Assignment>('assignments');
    const assignmentsForLesson = allAssignments.filter(a => a.lessonId === lesson.id);
    setLessonAssignments(assignmentsForLesson);

    // Fetch submissions for these assignments
    const allSubmissions = await dataProvider.getList<Submission>('submissions');
    const assignmentIds = assignmentsForLesson.map(a => a.id);
    const submissionsForLesson = allSubmissions.filter(s => s.assignmentId && assignmentIds.includes(s.assignmentId));
    setLessonSubmissions(submissionsForLesson);

    // Fetch students
    const allUsers = await dataProvider.getList<User>('users', { role: 'student' });
    setStudents(allUsers);

    setIsGradingModalOpen(true);
  };

  const handleAutoGrade = async (submission: Submission, assignment: Assignment) => {
    if (!assignment.questions || assignment.questions.length === 0) return;
    
    let parsedAnswers: Record<string, any> = {};
    try {
      parsedAnswers = submission.answers ? JSON.parse(submission.answers) : {};
    } catch (e) {
      console.error("Error parsing answers:", e);
      return;
    }

    let totalScore = 0;
    let maxScore = 0;

    assignment.questions.forEach(q => {
      const questionMaxPoints = q.type === 'true_false' ? 1.0 : (q.points || 0);
      maxScore += questionMaxPoints;
      
      if (q.type === 'multiple_choice') {
        if (parsedAnswers[q.id] === q.correctAnswer) {
          totalScore += questionMaxPoints;
        }
      } else if (q.type === 'true_false' && q.subQuestions) {
        let correctCount = 0;
        const studentAns = parsedAnswers[q.id] || {};
        q.subQuestions.forEach(sq => {
          if (studentAns[sq.id] === sq.correctAnswer) {
            correctCount++;
          }
        });
        if (correctCount > 0) {
          totalScore += (correctCount / q.subQuestions.length) * questionMaxPoints;
        }
      } else if (q.type === 'short_answer') {
        if (parsedAnswers[q.id] && q.correctAnswer && 
            parsedAnswers[q.id].toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase()) {
          totalScore += questionMaxPoints;
        }
      }
    });

    const finalScore = Number(((totalScore / maxScore) * 10).toFixed(2));
    
    setEditingSubmissionId(submission.id);
    setGradingData({ 
      score: finalScore.toString(), 
      feedback: `[Chấm tự động] Điểm trắc nghiệm: ${finalScore}/10.\n${submission.feedback || ''}` 
    });
  };

  const handleSaveGrade = async (submissionId: string) => {
    try {
      const scoreNum = parseFloat(gradingData.score);
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
        alert('Điểm số phải từ 0 đến 10');
        return;
      }
      
      const updatedSubmission = await dataProvider.gradeSubmission(submissionId, scoreNum, gradingData.feedback);
      setLessonSubmissions(prev => prev.map(s => s.id === submissionId ? updatedSubmission : s));
      setEditingSubmissionId(null);
      setGradingData({ score: '', feedback: '' });
    } catch (error) {
      console.error("Error saving grade:", error);
      alert('Có lỗi xảy ra khi lưu điểm.');
    }
  };

  const handleOpenGradingModalForIndependent = async (assignment: Assignment) => {
    setSelectedLessonForGrading(null);
    setLessonAssignments([assignment]);

    // Fetch submissions for this assignment
    const allSubmissions = await dataProvider.getList<Submission>('submissions');
    const submissionsForAssignment = allSubmissions.filter(s => s.assignmentId === assignment.id);
    setLessonSubmissions(submissionsForAssignment);

    // Fetch students
    const allUsers = await dataProvider.getList<User>('users', { role: 'student' });
    setStudents(allUsers);

    setIsGradingModalOpen(true);
  };

  const handleOpenIndependentAssignmentModal = () => {
    setEditingIndependentAssignmentId(null);
    setIndependentAssignmentFormData({
      title: '',
      description: '',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      grade: '10',
      classId: '',
      subjectId: '',
      topicId: '',
      studentIds: [],
      attachments: [],
      questions: []
    });
    setClassStudents([]);
    setSelectAllStudents(false);
    setIndependentAssignmentModalTab('info');
    setIsIndependentAssignmentModalOpen(true);
  };

  const handleEditIndependentAssignment = (assignment: Assignment) => {
    setEditingIndependentAssignmentId(assignment.id);
    setIndependentAssignmentModalTab('info');
    
    let parsedStudentIds = assignment.studentIds || [];
    if (typeof parsedStudentIds === 'string') {
      try {
        parsedStudentIds = JSON.parse(parsedStudentIds);
      } catch (e) {
        parsedStudentIds = [];
      }
    }
    
    let parsedAttachments = assignment.attachments || [];
    if (typeof parsedAttachments === 'string') {
      try {
        parsedAttachments = JSON.parse(parsedAttachments);
      } catch (e) {
        parsedAttachments = [];
      }
    }

    setIndependentAssignmentFormData({
      title: assignment.title,
      description: assignment.description || '',
      dueDate: new Date(assignment.dueDate).toISOString().split('T')[0],
      grade: assignment.grade?.toString() || '',
      classId: assignment.classId || '',
      subjectId: assignment.subjectId || '',
      topicId: assignment.topicId || '',
      studentIds: parsedStudentIds,
      attachments: parsedAttachments,
      questions: assignment.questions || []
    });
    
    if (assignment.classId) {
      const studentsInClass = students.filter(s => String(s.classId) === String(assignment.classId));
      setClassStudents(studentsInClass);
      setSelectAllStudents(parsedStudentIds.length === studentsInClass.length && studentsInClass.length > 0);
    } else {
      setClassStudents([]);
      setSelectAllStudents(false);
    }
    
    setIsIndependentAssignmentModalOpen(true);
  };

  const handleClassChangeForAssignment = (classId: string) => {
    setIndependentAssignmentFormData(prev => ({ ...prev, classId, studentIds: [] }));
    setSelectAllStudents(false);
    if (classId) {
      const studentsInClass = students.filter(s => String(s.classId) === String(classId));
      setClassStudents(studentsInClass);
    } else {
      setClassStudents([]);
    }
  };

  const handleToggleStudent = (studentId: string) => {
    setIndependentAssignmentFormData(prev => {
      const newStudentIds = prev.studentIds.includes(studentId)
        ? prev.studentIds.filter(id => id !== studentId)
        : [...prev.studentIds, studentId];
      
      setSelectAllStudents(newStudentIds.length === classStudents.length && classStudents.length > 0);
      return { ...prev, studentIds: newStudentIds };
    });
  };

  const handleToggleLessonStudent = (studentId: string) => {
    setAssignmentFormData(prev => {
      const newStudentIds = prev.studentIds.includes(studentId)
        ? prev.studentIds.filter(id => id !== studentId)
        : [...prev.studentIds, studentId];
      
      setSelectAllStudents(newStudentIds.length === classStudents.length && classStudents.length > 0);
      return { ...prev, studentIds: newStudentIds };
    });
  };

  const handleToggleAllLessonStudents = () => {
    if (selectAllStudents) {
      setAssignmentFormData(prev => ({ ...prev, studentIds: [] }));
      setSelectAllStudents(false);
    } else {
      setAssignmentFormData(prev => ({ ...prev, studentIds: classStudents.map(s => s.id) }));
      setSelectAllStudents(true);
    }
  };

  const handleToggleAllStudents = () => {
    if (selectAllStudents) {
      setIndependentAssignmentFormData(prev => ({ ...prev, studentIds: [] }));
      setSelectAllStudents(false);
    } else {
      setIndependentAssignmentFormData(prev => ({ ...prev, studentIds: classStudents.map(s => s.id) }));
      setSelectAllStudents(true);
    }
  };

  const handleIndependentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert('Kích thước tệp quá lớn. Vui lòng chọn tệp dưới 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setIndependentAssignmentFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, base64]
        }));
      };
      reader.readAsDataURL(file);
    }
  };



  const handleSubmitIndependentAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!independentAssignmentFormData.title || (!independentAssignmentFormData.description && independentAssignmentFormData.questions.length === 0)) {
      alert('Vui lòng nhập tên bài tập và nội dung bài tập (mô tả hoặc câu hỏi)');
      return;
    }

    const assignmentData = {
      title: independentAssignmentFormData.title,
      description: independentAssignmentFormData.description,
      dueDate: new Date(independentAssignmentFormData.dueDate).toISOString(),
      grade: independentAssignmentFormData.grade,
      classId: independentAssignmentFormData.classId,
      subjectId: independentAssignmentFormData.subjectId,
      topicId: independentAssignmentFormData.topicId,
      studentIds: independentAssignmentFormData.studentIds,
      attachments: independentAssignmentFormData.attachments,
      questions: independentAssignmentFormData.questions
    };

    if (editingIndependentAssignmentId) {
      await dataProvider.update('assignments', editingIndependentAssignmentId, assignmentData);
      alert('Đã cập nhật bài tập thành công!');
    } else {
      await dataProvider.create('assignments', assignmentData);
      alert('Đã giao bài tập thành công!');
    }
    
    setIsIndependentAssignmentModalOpen(false);
    setEditingIndependentAssignmentId(null);
    fetchData();
  };

  const filteredTopics = topics.filter(t => t.subjectId === formData.subjectId);
  const filterTopicsForList = topics.filter(t => !filterSubjectId || t.subjectId === filterSubjectId);
  const filteredClassesForForm = classes.filter(c => c.grade.toString() === formData.grade);
  const filteredClassesForList = classes.filter(c => !filterGrade || c.grade.toString() === filterGrade);

  const filteredLessons = lessons.filter(lesson => {
    if (filterGrade && String(lesson.grade) !== String(filterGrade)) return false;
    if (filterClassId && String(lesson.classId) !== String(filterClassId)) return false;
    if (filterTopicId && lesson.topicId !== filterTopicId) return false;
    if (filterStatus && lesson.status !== filterStatus) return false;
    if (searchTitle && !lesson.title?.toLowerCase()?.includes(searchTitle.toLowerCase())) return false;
    
    if (filterSubjectId) {
      const topic = topics.find(t => t.id === lesson.topicId);
      if (!topic || topic.subjectId !== filterSubjectId) return false;
    }
    return true;
  });

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate).getTime() < new Date().getTime();
  };

  const filteredAssignments = assignments.filter(assignment => {
    // Search filter
    if (searchTitle && !assignment.title?.toLowerCase()?.includes(searchTitle.toLowerCase())) return false;
    
    // Basic filters
    if (filterGrade && String(assignment.grade) !== String(filterGrade)) return false;
    if (filterClassId && String(assignment.classId) !== String(filterClassId)) return false;
    if (filterSubjectId && assignment.subjectId !== filterSubjectId) return false;
    if (filterTopicId && assignment.topicId !== filterTopicId) return false;

    // Status filters
    const overdue = isOverdue(assignment.dueDate);
    const assignmentSubmissions = allSubmissions.filter(s => s.assignmentId === assignment.id);
    const hasSubmissions = assignmentSubmissions.length > 0;
    const allGraded = hasSubmissions && assignmentSubmissions.every(s => s.score !== undefined && s.score !== null);

    if (filterAssignmentStatus === 'all') return true;
    if (filterAssignmentStatus === 'pending') return !hasSubmissions && !overdue;
    if (filterAssignmentStatus === 'submitted') return hasSubmissions && !allGraded;
    if (filterAssignmentStatus === 'graded') return allGraded;
    if (filterAssignmentStatus === 'overdue') return overdue;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Quản lý Bài tập</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý và chấm điểm bài tập</p>
        </div>
        <div className="flex flex-col xs:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => handleOpenIndependentAssignmentModal()}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
          >
            <FileText size={18} />
            <span>Giao bài tập</span>
          </button>
          
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Tìm kiếm bài tập..."
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả khối</option>
            <option value="10">Khối 10</option>
            <option value="11">Khối 11</option>
            <option value="12">Khối 12</option>
          </select>
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả lớp</option>
            {classes.filter(c => !filterGrade || c.grade.toString() === filterGrade).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterSubjectId}
            onChange={(e) => setFilterSubjectId(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả môn học</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
          <button
            onClick={() => setFilterAssignmentStatus('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterAssignmentStatus === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilterAssignmentStatus('pending')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterAssignmentStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Chưa nộp
          </button>
          <button
            onClick={() => setFilterAssignmentStatus('submitted')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterAssignmentStatus === 'submitted' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Đã nộp
          </button>
          <button
            onClick={() => setFilterAssignmentStatus('graded')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterAssignmentStatus === 'graded' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Đã chấm
          </button>
          <button
            onClick={() => setFilterAssignmentStatus('overdue')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterAssignmentStatus === 'overdue' ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Quá hạn
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-4 px-6 text-sm font-semibold text-gray-600">Tiêu đề</th>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600">Khối/Lớp</th>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600">Hạn nộp</th>
                <th className="py-4 px-6 text-sm font-semibold text-gray-600 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map(assignment => {
                const cls = classes.find(c => String(c.id) === String(assignment.classId));
                return (
                  <tr key={assignment.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <FileText size={20} />
                        </div>
                        <span className="font-medium text-gray-900">{assignment.title}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {assignment.grade ? `Khối ${assignment.grade}` : ''} {cls ? `- ${cls.name}` : ''}
                      {(() => {
                        let studentIds = assignment.studentIds;
                        if (typeof studentIds === 'string') {
                          try {
                            studentIds = JSON.parse(studentIds);
                          } catch (e) {
                            studentIds = [];
                          }
                        }
                        return studentIds && studentIds.length > 0 ? ` (${studentIds.length} học sinh)` : '';
                      })()}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {new Date(assignment.dueDate).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditIndependentAssignment(assignment)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleOpenGradingModalForIndependent(assignment)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                          title="Chấm bài"
                        >
                          <Users size={18} />
                          <span className="text-xs font-medium hidden sm:inline">Chấm bài</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(assignment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAssignments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    Chưa có bài tập nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {/* Modal Thêm/Sửa */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLesson ? 'Chỉnh sửa bài giảng' : 'Thêm bài giảng mới'}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề bài giảng</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="VD: Bài 1: Thông tin và xử lý thông tin"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Khối</label>
              <select
                value={formData.grade}
                onChange={e => setFormData({...formData, grade: e.target.value, classId: ''})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="10">Khối 10</option>
                <option value="11">Khối 11</option>
                <option value="12">Khối 12</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lớp (Tùy chọn)</label>
              <select
                value={formData.classId}
                onChange={e => setFormData({...formData, classId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">-- Tất cả lớp --</option>
                {filteredClassesForForm.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as 'draft' | 'published'})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="draft">Bản nháp</option>
                <option value="published">Xuất bản</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
              <select
                value={formData.subjectId}
                onChange={e => setFormData({...formData, subjectId: e.target.value, topicId: ''})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              >
                <option value="">-- Chọn môn học --</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
              <select
                value={formData.topicId}
                onChange={e => setFormData({...formData, topicId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                required
                disabled={!formData.subjectId}
              >
                <option value="">-- Chọn chủ đề --</option>
                {filteredTopics.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Nội dung (Yêu cầu cần đạt)</label>
              <button
                type="button"
                onClick={handleGenerateContent}
                disabled={isGenerating || !formData.subjectId || !formData.topicId || !formData.title}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>Tạo bằng AI</span>
              </button>
            </div>
            <div className="bg-white rounded-xl overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
              <ReactQuill 
                theme="snow"
                value={formData.content || ''}
                onChange={content => setFormData({...formData, content})}
                className="h-40 mb-12"
                placeholder="Nhập nội dung bài học hoặc yêu cầu cần đạt..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tài liệu PowerPoint (.ppt, .pptx)</label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.pptUrl}
                  onChange={e => setFormData({...formData, pptUrl: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                  placeholder="URL file PowerPoint hoặc tải lên..."
                />
              </div>
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer text-sm font-medium">
                <Upload size={18} />
                <span>Tải lên</span>
                <input
                  type="file"
                  accept=".ppt,.pptx"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Check size (max 2MB)
                      if (file.size > 2 * 1024 * 1024) {
                        alert('Vui lòng chọn file PowerPoint có dung lượng nhỏ hơn 2MB để đảm bảo hiệu suất.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setFormData({...formData, pptUrl: reader.result as string});
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
            {formData.pptUrl && formData.pptUrl.startsWith('data:') && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <Check size={12} /> Đã tải lên file: {formData.pptUrl.length > 1000 ? 'PowerPoint Data' : formData.pptUrl}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-gray-700">Nội dung tương tác</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addInteractiveBlock('text')}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100 flex items-center gap-1 text-xs font-medium"
                  title="Thêm văn bản"
                >
                  <FileText size={14} /> Văn bản
                </button>
                <button
                  type="button"
                  onClick={() => addInteractiveBlock('video')}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100 flex items-center gap-1 text-xs font-medium"
                  title="Thêm Video"
                >
                  <Video size={14} /> Video
                </button>
                <button
                  type="button"
                  onClick={() => addInteractiveBlock('quiz')}
                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-100 flex items-center gap-1 text-xs font-medium"
                  title="Thêm câu hỏi trắc nghiệm"
                >
                  <HelpCircle size={14} /> Trắc nghiệm
                </button>
                <button
                  type="button"
                  onClick={() => addInteractiveBlock('code')}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 flex items-center gap-1 text-xs font-medium"
                  title="Thêm mã nguồn"
                >
                  <Code size={14} /> Code
                </button>
                <button
                  type="button"
                  onClick={() => addInteractiveBlock('image')}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100 flex items-center gap-1 text-xs font-medium"
                  title="Thêm hình ảnh"
                >
                  <ImageIcon size={14} /> Ảnh
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {ensureArray(formData.interactiveContent).map((block, index) => (
                <div key={block.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 relative group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-gray-400 cursor-move" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        {block.type === 'text' && 'Văn bản'}
                        {block.type === 'video' && 'Video'}
                        {block.type === 'quiz' && 'Trắc nghiệm'}
                        {block.type === 'code' && 'Mã nguồn'}
                        {block.type === 'image' && 'Hình ảnh'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveBlock(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                      >
                        <Plus size={14} className="rotate-45" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeInteractiveBlock(block.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {block.type === 'text' && (
                    <div className="bg-white rounded-lg overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500">
                      <ReactQuill 
                        theme="snow"
                        value={block.data.content}
                        onChange={content => updateBlockData(block.id, { content })}
                        className="h-32 mb-12"
                        placeholder="Nhập nội dung văn bản..."
                      />
                    </div>
                  )}

                  {block.type === 'video' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={block.data.url}
                        onChange={e => updateBlockData(block.id, { url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="URL Video (YouTube, v.v.)"
                      />
                      <input
                        type="text"
                        value={block.data.caption}
                        onChange={e => updateBlockData(block.id, { caption: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Chú thích video"
                      />
                    </div>
                  )}

                  {block.type === 'image' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={block.data.url}
                        onChange={e => updateBlockData(block.id, { url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="URL Hình ảnh"
                      />
                      <input
                        type="text"
                        value={block.data.caption}
                        onChange={e => updateBlockData(block.id, { caption: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Chú thích hình ảnh"
                      />
                    </div>
                  )}

                  {block.type === 'code' && (
                    <div className="space-y-2">
                      <select
                        value={block.data.language}
                        onChange={e => updateBlockData(block.id, { language: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="cpp">C++</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                      </select>
                      <textarea
                        value={block.data.content}
                        onChange={e => updateBlockData(block.id, { content: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Nhập mã nguồn..."
                        rows={4}
                      />
                    </div>
                  )}

                  {block.type === 'quiz' && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={block.data.question}
                        onChange={e => updateBlockData(block.id, { question: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Câu hỏi trắc nghiệm..."
                      />
                      <div className="space-y-2">
                        {ensureArray(block.data.options).map((option: string, optIdx: number) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`quiz-${block.id}`}
                              checked={block.data.correctAnswer === option}
                              onChange={() => updateBlockData(block.id, { correctAnswer: option })}
                            />
                            <input
                              type="text"
                              value={option}
                              onChange={e => {
                                const newOptions = [...(block.data.options || [])];
                                newOptions[optIdx] = e.target.value;
                                updateBlockData(block.id, { options: newOptions });
                              }}
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder={`Lựa chọn ${optIdx + 1}`}
                            />
                            {block.data.options!.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOptions = block.data.options!.filter((_: any, i: number) => i !== optIdx);
                                  updateBlockData(block.id, { options: newOptions });
                                }}
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newOptions = [...(block.data.options || []), ''];
                            updateBlockData(block.id, { options: newOptions });
                          }}
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          + Thêm lựa chọn
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {ensureArray(formData.interactiveContent).length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                  Chưa có nội dung tương tác nào. Hãy thêm các khối nội dung bên trên.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Lưu bài giảng
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Xác nhận xóa */}
      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Xác nhận xóa"
      >
        <div className="p-4">
          <p className="text-gray-700 mb-6">Bạn có chắc chắn muốn xóa bài tập này không?</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
            >
              Xóa
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Chấm bài */}
      <Modal
        isOpen={isGradingModalOpen}
        onClose={() => { setIsGradingModalOpen(false); setEditingSubmissionId(null); }}
        title="Chấm bài học sinh"
      >
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <BookOpen size={18} />
            {selectedLessonForGrading ? `Bài giảng: ${selectedLessonForGrading.title}` : 'Bài tập độc lập'}
          </div>

          {lessonAssignments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Chưa có bài tập nào được giao cho bài giảng này.
            </div>
          ) : (
            <div className="space-y-8">
              {lessonAssignments.map(assignment => {
                const submissions = lessonSubmissions.filter(s => s.assignmentId === assignment.id);
                
                return (
                  <div key={assignment.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h4 className="font-bold text-gray-900">{assignment.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">Hạn nộp: {new Date(assignment.dueDate).toLocaleDateString('vi-VN')} • {submissions.length} bài nộp</p>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                      {submissions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          Chưa có học sinh nào nộp bài.
                        </div>
                      ) : (
                        submissions.map(submission => {
                          const student = students.find(s => s.id === submission.studentId);
                          const isEditing = editingSubmissionId === submission.id;
                          
                          return (
                            <div key={submission.id} className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <span className="font-bold text-gray-900">{student?.fullName || 'Học sinh ẩn danh'}</span>
                                  <span className="text-xs text-gray-500 ml-2">({student?.username})</span>
                                  <p className="text-xs text-gray-400 mt-1">Nộp lúc: {new Date(submission.submittedAt).toLocaleString('vi-VN')}</p>
                                </div>
                                {!isEditing && (
                                  <div className="text-right">
                                    {submission.score !== undefined ? (
                                      <div className="flex flex-col items-end">
                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-lg text-sm">
                                          {submission.score}/10
                                        </span>
                                        <div className="flex gap-2 mt-1">
                                          {assignment.questions && assignment.questions.length > 0 && submission.answers && (
                                            <button 
                                              onClick={() => handleAutoGrade(submission, assignment)}
                                              className="text-xs text-emerald-600 hover:underline"
                                            >
                                              Chấm lại tự động
                                            </button>
                                          )}
                                          <button 
                                            onClick={() => {
                                              setEditingSubmissionId(submission.id);
                                              setGradingData({ score: submission.score?.toString() || '', feedback: submission.feedback || '' });
                                            }}
                                            className="text-xs text-indigo-600 hover:underline"
                                          >
                                            Sửa điểm
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex gap-2">
                                        {assignment.questions && assignment.questions.length > 0 && submission.answers && (
                                          <button 
                                            onClick={() => handleAutoGrade(submission, assignment)}
                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-medium rounded-lg text-sm hover:bg-emerald-100 transition-colors"
                                          >
                                            Chấm tự động
                                          </button>
                                        )}
                                        <button 
                                          onClick={() => {
                                            setEditingSubmissionId(submission.id);
                                            setGradingData({ score: '', feedback: submission.feedback || '' });
                                          }}
                                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-medium rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                                        >
                                          Chấm điểm
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-4 mb-4">
                                {submission.answers && assignment.questions && assignment.questions.length > 0 && (
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-2">Phần Trắc nghiệm (Tự động chấm)</p>
                                    <div className="space-y-3">
                                      {assignment.questions.map((q, idx) => {
                                        let parsedAnswers: Record<string, any> = {};
                                        try {
                                          parsedAnswers = JSON.parse(submission.answers || '{}');
                                        } catch (e) {}
                                        
                                        const studentAns = parsedAnswers[q.id];
                                        
                                        return (
                                          <div key={idx} className="text-sm">
                                            <div className="font-medium text-gray-800 flex gap-1">
                                              <span>Câu {idx + 1}:</span>
                                              <div dangerouslySetInnerHTML={{ __html: String(q.content || '') }} />
                                            </div>
                                            {q.type === 'multiple_choice' && (
                                              <div className="mt-1 flex items-center gap-2">
                                                <span className="text-gray-600">Học sinh chọn:</span>
                                                <span className={`font-medium ${studentAns === q.correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}>
                                                  {studentAns || 'Chưa trả lời'}
                                                </span>
                                                <span className="text-gray-400 text-xs">(Đáp án: {q.correctAnswer})</span>
                                              </div>
                                            )}
                                            {q.type === 'true_false' && q.subQuestions && (
                                              <div className="mt-1 pl-4 space-y-1">
                                                {q.subQuestions.map((sq: any, i: number) => {
                                                  const sqAns = studentAns ? studentAns[sq.id] : undefined;
                                                  return (
                                                    <div key={i} className="flex items-center gap-2">
                                                      <span className="text-gray-600">{sq.id})</span>
                                                      <span className={`font-medium ${sqAns === sq.correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {sqAns !== undefined ? (sqAns ? 'Đúng' : 'Sai') : 'Chưa trả lời'}
                                                      </span>
                                                      <span className="text-gray-400 text-xs">(Đáp án: {sq.correctAnswer ? 'Đúng' : 'Sai'})</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                            {q.type === 'short_answer' && (
                                              <div className="mt-1 flex items-center gap-2">
                                                <span className="text-gray-600">Học sinh chọn:</span>
                                                <span className={`font-medium ${studentAns?.toString().trim().toLowerCase() === q.correctAnswer?.toString().trim().toLowerCase() ? 'text-emerald-600' : 'text-red-600'}`}>
                                                  {studentAns || 'Chưa trả lời'}
                                                </span>
                                                <span className="text-gray-400 text-xs">(Đáp án: {q.correctAnswer})</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {submission.part1Content && (
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Phần I: Trắc nghiệm</p>
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{submission.part1Content}</div>
                                  </div>
                                )}
                                {submission.part2Content && (
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Phần II: Đúng/Sai</p>
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{submission.part2Content}</div>
                                  </div>
                                )}
                                {submission.part3Content && (
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Phần III: Trả lời ngắn</p>
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{submission.part3Content}</div>
                                  </div>
                                )}
                                {submission.part4Content && (
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Phần IV: Tự luận</p>
                                    <div className="text-sm text-slate-700 [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>h1]:text-xl [&>h1]:font-bold [&>h2]:text-lg [&>h2]:font-bold" dangerouslySetInnerHTML={{ __html: String(submission.part4Content || '') }} />
                                  </div>
                                )}
                                {!submission.part1Content && !submission.part2Content && !submission.part3Content && !submission.part4Content && (
                                  <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
                                    {submission.content || <span className="italic text-gray-400">Không có nội dung văn bản</span>}
                                  </div>
                                )}
                              </div>

                              {submission.fileName && (
                                <div className="mb-3 flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">File đính kèm:</span>
                                  <a 
                                    href={submission.fileUrl} 
                                    download={submission.fileName} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                                  >
                                    <FileText size={14} />
                                    {submission.fileName}
                                  </a>
                                </div>
                              )}

                              {isEditing ? (
                                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <label className="text-sm font-bold text-gray-700">Điểm số (0-10):</label>
                                    <input 
                                      type="number" 
                                      min="0" max="10" step="0.01"
                                      value={gradingData.score}
                                      onChange={e => setGradingData({...gradingData, score: e.target.value})}
                                      className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nhận xét:</label>
                                    <textarea 
                                      rows={2}
                                      value={gradingData.feedback}
                                      onChange={e => setGradingData({...gradingData, feedback: e.target.value})}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                      placeholder="Nhập nhận xét cho học sinh..."
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2 pt-2">
                                    <button 
                                      onClick={() => setEditingSubmissionId(null)}
                                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                      Hủy
                                    </button>
                                    <button 
                                      onClick={() => handleSaveGrade(submission.id)}
                                      className="px-4 py-1.5 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                                    >
                                      <Check size={16} /> Lưu điểm
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                submission.feedback && (
                                  <div className="text-sm text-gray-600 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                                    <span className="font-semibold text-amber-800">Nhận xét: </span>
                                    {submission.feedback}
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        title="Giao bài tập từ bài giảng"
        size="lg"
      >
        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${assignmentModalTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setAssignmentModalTab('info')}
          >
            Thông tin chung
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${assignmentModalTab === 'questions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setAssignmentModalTab('questions')}
          >
            Nội dung câu hỏi
          </button>
        </div>

        <form onSubmit={handleSubmitAssignment} className="space-y-6">
          {assignmentModalTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề bài tập</label>
                  <input
                    type="text"
                    required
                    value={assignmentFormData.title}
                    onChange={e => setAssignmentFormData({...assignmentFormData, title: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hạn nộp</label>
                  <input
                    type="date"
                    required
                    value={assignmentFormData.dueDate}
                    onChange={e => setAssignmentFormData({...assignmentFormData, dueDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú / Hướng dẫn</label>
                <textarea
                  value={assignmentFormData.description}
                  onChange={e => setAssignmentFormData({...assignmentFormData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={2}
                  placeholder="Nhập hướng dẫn cho học sinh..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tệp đính kèm</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []) as File[];
                        files.forEach(file => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const base64 = reader.result as string;
                            setAssignmentFormData(prev => ({
                              ...prev,
                              attachments: [...(prev.attachments || []), base64]
                            }));
                          };
                          reader.readAsDataURL(file);
                        });
                      }}
                    />
                    <Upload size={20} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Tải tệp lên</span>
                  </label>
                  <span className="text-sm text-gray-500">
                    {(assignmentFormData.attachments || []).length} tệp đã chọn
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lớp (Tùy chọn)</label>
                <select
                  value={assignmentFormData.classId}
                  onChange={e => {
                    const classId = e.target.value;
                    setAssignmentFormData(prev => ({ ...prev, classId, studentIds: [] }));
                    setSelectAllStudents(false);
                    if (classId) {
                      const studentsInClass = students.filter(s => String(s.classId) === String(classId));
                      setClassStudents(studentsInClass);
                    } else {
                      setClassStudents([]);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- Chọn lớp để giao bài --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {classStudents.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">Chọn học sinh cần giao</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAllStudents}
                        onChange={handleToggleAllLessonStudents}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium">Chọn tất cả</span>
                    </label>
                  </div>
                  <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                    {classStudents.map(student => (
                      <label key={student.id} className="flex items-center gap-2 text-sm p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={assignmentFormData.studentIds.includes(student.id)}
                          onChange={() => handleToggleLessonStudent(student.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{student.fullName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {assignmentModalTab === 'questions' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-semibold text-gray-900">Thêm câu hỏi mới</h4>
                  <button 
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('lesson')}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Search size={16} />
                    Chọn từ ngân hàng
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionModal('lesson', undefined, 'multiple_choice')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <CheckCircle size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Trắc nghiệm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionModal('lesson', undefined, 'true_false')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-2 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <HelpCircle size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Đúng/Sai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionModal('lesson', undefined, 'short_answer')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Edit2 size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Trả lời ngắn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionModal('lesson', undefined, 'essay')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-rose-500 hover:bg-rose-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-2 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      <FileText size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Tự luận</span>
                  </button>
                </div>

                <div className="flex justify-between items-center border-b pb-2 pt-4">
                  <h4 className="font-semibold text-gray-900">Danh sách câu hỏi ({assignmentFormData.questions?.length || 0})</h4>
                </div>

                {assignmentFormData.questions && assignmentFormData.questions.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {assignmentFormData.questions.map((q, index) => (
                      <div key={`${q.id || 'q'}-${index}`} className="p-3 border border-gray-200 rounded-xl bg-gray-50 relative group">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            type="button"
                            onClick={() => handleOpenQuestionModal('lesson', index)}
                            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => removeQuestion('lesson', index)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex gap-2 text-sm mb-1">
                          <span className="font-medium">Câu {index + 1}:</span>
                          <span className="text-gray-600">
                            {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 
                             q.type === 'true_false' ? 'Đúng/Sai' : 
                             q.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            {q.type === 'true_false' ? (
                              <span className="text-indigo-600 font-medium">1 điểm</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={q.points || 0}
                                  onChange={(e) => updateQuestionPoints('lesson', index, Number(e.target.value))}
                                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-600">điểm</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div 
                          className="text-gray-900 text-sm mb-2"
                          dangerouslySetInnerHTML={{ __html: String(q.content || '') }}
                        />
                        {q.type === 'multiple_choice' && (
                          <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                            {(Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? (() => { try { return JSON.parse(q.options); } catch { return []; } })() : [])).map((opt: string, i: number) => (
                              <li key={i} className={opt === q.correctAnswer ? 'text-emerald-600 font-medium' : ''}>
                                {opt}
                              </li>
                            ))}
                          </ul>
                        )}
                        {q.type === 'true_false' && (
                          <div className="mt-2 space-y-1">
                            {(Array.isArray(q.subQuestions) ? q.subQuestions : (typeof q.subQuestions === 'string' ? (() => { try { return JSON.parse(q.subQuestions); } catch { return []; } })() : [])).map((sq: any, i: number) => (
                              <div key={i} className="text-sm flex items-start gap-2">
                                <span className="font-medium text-gray-700">{sq.id})</span>
                                <div 
                                  className="text-gray-600 flex-1"
                                  dangerouslySetInnerHTML={{ __html: String(sq.content || '') }}
                                />
                                <span className={`font-medium ${sq.correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {sq.correctAnswer ? 'Đúng' : 'Sai'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {q.type === 'short_answer' && (
                          <div className="text-sm text-emerald-600 font-medium mt-1">
                            Đáp án: {q.correctAnswer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    Chưa có câu hỏi nào. Hãy thêm câu hỏi mới.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button
              type="button"
              onClick={() => setIsAssignmentModalOpen(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
            >
              Giao bài
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isIndependentAssignmentModalOpen}
        onClose={() => setIsIndependentAssignmentModalOpen(false)}
        title="Giao bài tập"
        size="lg"
      >
        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${independentAssignmentModalTab === 'info' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setIndependentAssignmentModalTab('info')}
          >
            Thông tin chung
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${independentAssignmentModalTab === 'questions' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setIndependentAssignmentModalTab('questions')}
          >
            Nội dung câu hỏi
          </button>
        </div>

        <form onSubmit={handleSubmitIndependentAssignment} className="space-y-6">
          {independentAssignmentModalTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên bài học / Bài tập</label>
                  <input
                    type="text"
                    required
                    value={independentAssignmentFormData.title}
                    onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, title: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Nhập tên bài tập..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hạn nộp</label>
                  <input
                    type="date"
                    required
                    value={independentAssignmentFormData.dueDate}
                    onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, dueDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú / Hướng dẫn chung</label>
                <textarea
                  value={independentAssignmentFormData.description}
                  onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={2}
                  placeholder="Nhập hướng dẫn chung cho bài tập (nếu có)..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Khối</label>
                  <select
                    value={independentAssignmentFormData.grade}
                    onChange={e => {
                      setIndependentAssignmentFormData({...independentAssignmentFormData, grade: e.target.value, classId: '', studentIds: []});
                      setClassStudents([]);
                      setSelectAllStudents(false);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="10">Khối 10</option>
                    <option value="11">Khối 11</option>
                    <option value="12">Khối 12</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lớp</label>
                  <select
                    required
                    value={independentAssignmentFormData.classId}
                    onChange={e => handleClassChangeForAssignment(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Chọn lớp</option>
                    {classes.filter(c => c.grade.toString() === independentAssignmentFormData.grade).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
                  <select
                    value={independentAssignmentFormData.subjectId}
                    onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, subjectId: e.target.value, topicId: ''})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Chọn môn học</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {independentAssignmentFormData.subjectId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
                  <select
                    value={independentAssignmentFormData.topicId}
                    onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, topicId: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Chọn chủ đề</option>
                    {topics.filter(t => t.subjectId === independentAssignmentFormData.subjectId).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {classStudents.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">Chọn học sinh cần giao</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAllStudents}
                        onChange={handleToggleAllStudents}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-medium">Chọn tất cả</span>
                    </label>
                  </div>
                  <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                    {classStudents.map(student => (
                      <label key={student.id} className="flex items-center gap-2 text-sm p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={independentAssignmentFormData.studentIds.includes(student.id)}
                          onChange={() => handleToggleStudent(student.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{student.fullName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đính kèm tài liệu hỗ trợ (Hình ảnh, Word, PDF...)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    id="independent-file-upload"
                    className="hidden"
                    onChange={handleIndependentFileChange}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  />
                  <label
                    htmlFor="independent-file-upload"
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <Upload size={20} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Tải tệp lên</span>
                  </label>
                  <span className="text-sm text-gray-500">
                    {independentAssignmentFormData.attachments.length} tệp đã chọn
                  </span>
                </div>
              </div>
            </div>
          )}

          {independentAssignmentModalTab === 'questions' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-semibold text-gray-900">Thêm câu hỏi mới</h4>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => handleOpenQuestionBankModal('independent')}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <Search size={16} />
                      Chọn từ ngân hàng
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionModal('independent', undefined, 'multiple_choice')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <CheckCircle size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Trắc nghiệm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionModal('independent', undefined, 'true_false')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-2 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <HelpCircle size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Đúng/Sai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionModal('independent', undefined, 'short_answer')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Edit2 size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Trả lời ngắn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionModal('independent', undefined, 'essay')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:border-rose-500 hover:bg-rose-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-2 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      <FileText size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Tự luận</span>
                  </button>
                </div>

                <div className="flex justify-between items-center border-b pb-2 pt-4">
                  <h4 className="font-semibold text-gray-900">Danh sách câu hỏi ({independentAssignmentFormData.questions?.length || 0})</h4>
                </div>

                {independentAssignmentFormData.questions && independentAssignmentFormData.questions.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {independentAssignmentFormData.questions.map((q, index) => (
                      <div key={`${q.id || 'q'}-${index}`} className="p-3 border border-gray-200 rounded-xl bg-gray-50 relative group">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            type="button"
                            onClick={() => handleOpenQuestionModal('independent', index)}
                            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => removeQuestion('independent', index)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex gap-2 text-sm mb-1">
                          <span className="font-medium">Câu {index + 1}:</span>
                          <span className="text-gray-600">
                            {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 
                             q.type === 'true_false' ? 'Đúng/Sai' : 
                             q.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            {q.type === 'true_false' ? (
                              <span className="text-indigo-600 font-medium">1 điểm</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={q.points || 0}
                                  onChange={(e) => updateQuestionPoints('independent', index, Number(e.target.value))}
                                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-600">điểm</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div 
                          className="text-gray-900 text-sm mb-2"
                          dangerouslySetInnerHTML={{ __html: String(q.content || '') }}
                        />
                        {q.type === 'multiple_choice' && (
                          <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                            {(Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? (() => { try { return JSON.parse(q.options); } catch { return []; } })() : [])).map((opt: string, i: number) => (
                              <li key={i} className={opt === q.correctAnswer ? 'text-emerald-600 font-medium' : ''}>
                                {opt}
                              </li>
                            ))}
                          </ul>
                        )}
                        {q.type === 'true_false' && (
                          <div className="mt-2 space-y-1">
                            {(Array.isArray(q.subQuestions) ? q.subQuestions : (typeof q.subQuestions === 'string' ? (() => { try { return JSON.parse(q.subQuestions); } catch { return []; } })() : [])).map((sq: any, i: number) => (
                              <div key={i} className="text-sm flex items-start gap-2">
                                <span className="font-medium text-gray-700">{sq.id})</span>
                                <div 
                                  className="text-gray-600 flex-1"
                                  dangerouslySetInnerHTML={{ __html: String(sq.content || '') }}
                                />
                                <span className={`font-medium ${sq.correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {sq.correctAnswer ? 'Đúng' : 'Sai'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    Chưa có câu hỏi nào. Hãy thêm câu hỏi mới.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button
              type="button"
              onClick={() => setIsIndependentAssignmentModalOpen(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
            >
              Giao bài
            </button>
          </div>
        </form>
      </Modal>

      {/* Manual Question Modal */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        title={editingQuestionIndex !== null ? "Sửa câu hỏi" : "Thêm câu hỏi mới"}
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loại câu hỏi</label>
              <select 
                value={questionForm.type}
                onChange={e => {
                  const type = e.target.value as QuestionType;
                  setQuestionForm({
                    ...questionForm, 
                    type,
                    options: type === 'multiple_choice' ? ['', '', '', ''] : [],
                    correctAnswer: type === 'true_false' ? 'true' : '',
                    subQuestions: type === 'true_false' ? [
                      { id: 'a', content: '', difficulty: 'recognition', correctAnswer: true },
                      { id: 'b', content: '', difficulty: 'recognition', correctAnswer: true },
                      { id: 'c', content: '', difficulty: 'recognition', correctAnswer: true },
                      { id: 'd', content: '', difficulty: 'recognition', correctAnswer: true }
                    ] : []
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="multiple_choice">Trắc nghiệm nhiều lựa chọn</option>
                <option value="true_false">Trắc nghiệm Đúng/Sai</option>
                <option value="short_answer">Trả lời ngắn</option>
                <option value="essay">Tự luận</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ</label>
              <select 
                value={questionForm.difficulty}
                onChange={e => setQuestionForm({...questionForm, difficulty: e.target.value as any})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="recognition">Nhận biết</option>
                <option value="understanding">Thông hiểu</option>
                <option value="application">Vận dụng</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung câu hỏi</label>
            <div className="bg-white rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
              <ReactQuill 
                theme="snow"
                value={questionForm.content || ''}
                onChange={content => setQuestionForm({...questionForm, content})}
                className="h-32 mb-12"
                placeholder="Nhập nội dung câu hỏi..."
              />
            </div>
          </div>

          {questionForm.type === 'multiple_choice' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Các lựa chọn và đáp án đúng</label>
              {(questionForm.options || []).map((opt, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input 
                    type="radio"
                    name="correctAnswer"
                    checked={questionForm.correctAnswer === opt && opt !== ''}
                    onChange={() => setQuestionForm({...questionForm, correctAnswer: opt})}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <input 
                    type="text"
                    required
                    value={opt}
                    onChange={e => {
                      const newOpts = [...(questionForm.options || [])];
                      newOpts[idx] = e.target.value;
                      setQuestionForm({...questionForm, options: newOpts});
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={`Lựa chọn ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          )}

          {questionForm.type === 'true_false' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Các ý Đúng/Sai</label>
              {(Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? (() => { try { return JSON.parse(questionForm.subQuestions); } catch { return []; } })() : [])).map((sq: any, idx: number) => (
                <div key={idx} className="p-3 border border-gray-200 rounded-xl bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Ý {sq.id})</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1 text-sm cursor-pointer">
                        <input 
                          type="radio" 
                          name={`sq-${idx}`} 
                          checked={sq.correctAnswer === true}
                          onChange={() => {
                            const currentSubs = Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? JSON.parse(questionForm.subQuestions) : []);
                            const newSubQs = [...currentSubs];
                            newSubQs[idx] = { ...sq, correctAnswer: true };
                            setQuestionForm({ ...questionForm, subQuestions: newSubQs });
                          }}
                        /> Đúng
                      </label>
                      <label className="flex items-center gap-1 text-sm cursor-pointer">
                        <input 
                          type="radio" 
                          name={`sq-${idx}`} 
                          checked={sq.correctAnswer === false}
                          onChange={() => {
                            const currentSubs = Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? JSON.parse(questionForm.subQuestions) : []);
                            const newSubQs = [...currentSubs];
                            newSubQs[idx] = { ...sq, correctAnswer: false };
                            setQuestionForm({ ...questionForm, subQuestions: newSubQs });
                          }}
                        /> Sai
                      </label>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                    <ReactQuill 
                      theme="snow"
                      value={sq.content || ''}
                      onChange={content => {
                        const currentSubs = Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? JSON.parse(questionForm.subQuestions) : []);
                        const newSubQs = [...currentSubs];
                        newSubQs[idx] = { ...sq, content };
                        setQuestionForm({ ...questionForm, subQuestions: newSubQs });
                      }}
                      className="h-20 mb-10"
                      placeholder={`Nhập nội dung ý ${sq.id})...`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {questionForm.type === 'short_answer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đáp án đúng</label>
              <input 
                type="text"
                required
                value={questionForm.correctAnswer}
                onChange={e => setQuestionForm({...questionForm, correctAnswer: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nhập đáp án đúng..."
              />
            </div>
          )}

          {questionForm.type !== 'true_false' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Điểm số</label>
              <input 
                type="number"
                required
                min={0}
                step={0.1}
                value={questionForm.points}
                onChange={e => setQuestionForm({...questionForm, points: Number(e.target.value)})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button 
              type="button" 
              onClick={() => setIsQuestionModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Lưu câu hỏi
            </button>
          </div>
        </form>
      </Modal>

      {/* Question Bank Selector Modal */}
      <Modal
        isOpen={isQuestionBankModalOpen}
        onClose={() => setIsQuestionBankModalOpen(false)}
        title="Chọn câu hỏi từ Ngân hàng"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Tìm kiếm câu hỏi..."
                value={qbSearch}
                onChange={(e) => setQbSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <select
              value={qbFilterSubject}
              onChange={(e) => setQbFilterSubject(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="">Tất cả môn học</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
            <select
              value={qbFilterTopic}
              onChange={(e) => setQbFilterTopic(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="">Tất cả chủ đề</option>
              {topics.filter(t => !qbFilterSubject || t.subjectId === qbFilterSubject).map(topic => (
                <option key={topic.id} value={topic.id}>{topic.name}</option>
              ))}
            </select>
            <select
              value={qbFilterDifficulty}
              onChange={(e) => setQbFilterDifficulty(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="">Tất cả mức độ</option>
              <option value="recognition">Nhận biết</option>
              <option value="understanding">Thông hiểu</option>
              <option value="application">Vận dụng</option>
            </select>
            <select
              value={qbFilterType}
              onChange={(e) => setQbFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="">Tất cả loại</option>
              <option value="multiple_choice">Trắc nghiệm</option>
              <option value="true_false">Đúng/Sai</option>
              <option value="short_answer">Trả lời ngắn</option>
              <option value="essay">Tự luận</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setQbSearch('');
                setQbFilterSubject('');
                setQbFilterTopic('');
                setQbFilterDifficulty('');
                setQbFilterType('');
              }}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Xóa bộ lọc"
            >
              <RefreshCw size={20} />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-xl divide-y">
            {filteredBankQuestions.length > 0 ? (
              filteredBankQuestions.map((q, index) => (
                <div 
                  key={`${q.id}-${index}`} 
                  className={`p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedBankQuestions.includes(q.id) ? 'bg-emerald-50/50' : ''}`}
                  onClick={() => handleToggleBankQuestion(q.id)}
                >
                  <div className="mt-1">
                    <input 
                      type="checkbox" 
                      checked={selectedBankQuestions.includes(q.id)}
                      onChange={() => {}} // handled by parent div click
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 
                         q.type === 'true_false' ? 'Đúng/Sai' : 
                         q.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        q.difficulty === 'recognition' ? 'bg-green-100 text-green-700' :
                        q.difficulty === 'understanding' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {q.difficulty === 'recognition' ? 'Nhận biết' : q.difficulty === 'understanding' ? 'Thông hiểu' : 'Vận dụng'}
                      </span>
                    </div>
                    <div 
                      className="text-sm text-gray-900 font-medium line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: String(q.content || '') }}
                    />
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {q.options.map((opt, idx) => (
                          <div key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                            <span className="font-medium">{['A', 'B', 'C', 'D', 'E', 'F'][idx]}.</span> {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                Không tìm thấy câu hỏi phù hợp.
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={filteredBankQuestions.length > 0 && filteredBankQuestions.every(q => selectedBankQuestions.includes(q.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const allIds = filteredBankQuestions.map(q => q.id);
                      setSelectedBankQuestions(prev => Array.from(new Set([...prev, ...allIds])));
                    } else {
                      const allIds = filteredBankQuestions.map(q => q.id);
                      setSelectedBankQuestions(prev => prev.filter(id => !allIds.includes(id)));
                    }
                  }}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Chọn tất cả câu hỏi đang hiển thị</span>
              </label>
              <span className="text-sm text-gray-600 border-l pl-4">
                Đã chọn <span className="font-bold text-emerald-600">{selectedBankQuestions.length}</span> câu hỏi
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsQuestionBankModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmQuestionBank}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AssignmentManagement;


