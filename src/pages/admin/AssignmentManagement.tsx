import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, BookOpen, CheckCircle, XCircle, Sparkles, Loader2, FileText, Upload, FileUp, Users, Check, Video, HelpCircle, Code, Image as ImageIcon, GripVertical, RefreshCw, Search } from 'lucide-react';
import { dataProvider } from '../../core/provider';
import { Lesson, Subject, Topic, Assignment, Submission, User, InteractiveBlock, Class, Question, QuestionType, BankQuestion } from '../../core/types';
import { Modal } from '../../components/Modal';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { ensureArray } from '../../core/utils/data';
import { parseTruncatedJSON } from '../../utils/jsonUtils';

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
  const [selectedLessonForAssignment, setSelectedLessonForAssignment] = useState<Lesson | null>(null);
  const [assignmentFormData, setAssignmentFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // Default 1 week
    classId: '',
    studentIds: [] as string[],
    part1: '',
    part2: '',
    part3: '',
    part4: ''
  });

  // Grading State
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [selectedLessonForGrading, setSelectedLessonForGrading] = useState<Lesson | null>(null);
  const [lessonAssignments, setLessonAssignments] = useState<Assignment[]>([]);
  const [lessonSubmissions, setLessonSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [gradingData, setGradingData] = useState<{ score: string, feedback: string }>({ score: '', feedback: '' });
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);

  // Independent Assignment State
  const [isIndependentAssignmentModalOpen, setIsIndependentAssignmentModalOpen] = useState(false);
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
    questions: [] as Question[],
    part1: '',
    part2: '',
    part3: '',
    part4: ''
  });
  const [classStudents, setClassStudents] = useState<User[]>([]);
  const [selectAllStudents, setSelectAllStudents] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Question Bank Modal State
  const [isQuestionBankModalOpen, setIsQuestionBankModalOpen] = useState(false);
  const [targetFormForQuestionBank, setTargetFormForQuestionBank] = useState<'lesson' | 'independent'>('lesson');
  const [targetPartForQuestionBank, setTargetPartForQuestionBank] = useState<'part1' | 'part2' | 'part3' | 'part4'>('part1');
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [selectedBankQuestions, setSelectedBankQuestions] = useState<string[]>([]);
  const [qbFilterSubject, setQbFilterSubject] = useState('');
  const [qbFilterTopic, setQbFilterTopic] = useState('');
  const [qbFilterDifficulty, setQbFilterDifficulty] = useState('');
  const [qbSearch, setQbSearch] = useState('');



  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [lesData, subData, topData, classData, studentData, assignData, bankQuestionsData] = await Promise.all([
      dataProvider.getList<Lesson>('lessons'),
      dataProvider.getList<Subject>('subjects'),
      dataProvider.getList<Topic>('topics'),
      dataProvider.getList<Class>('classes'),
      dataProvider.getList<User>('users', { role: 'student' }),
      dataProvider.getList<Assignment>('assignments'),
      dataProvider.getList<BankQuestion>('bank_questions')
    ]);
    setLessons(lesData);
    setSubjects(subData);
    setTopics(topData);
    setClasses(classData);
    setStudents(studentData);
    setAssignments(assignData);
    setBankQuestions(bankQuestionsData);
  };

  const handleOpenQuestionBankModal = (formType: 'lesson' | 'independent', part: 'part1' | 'part2' | 'part3' | 'part4') => {
    setTargetFormForQuestionBank(formType);
    setTargetPartForQuestionBank(part);
    setSelectedBankQuestions([]);
    setIsQuestionBankModalOpen(true);
  };

  const handleConfirmQuestionBank = () => {
    const selectedQs = bankQuestions.filter(q => selectedBankQuestions.includes(q.id));
    if (selectedQs.length === 0) {
      setIsQuestionBankModalOpen(false);
      return;
    }

    let formattedText = '';
    selectedQs.forEach((q, idx) => {
      formattedText += `Câu ${idx + 1}: ${q.content}\n`;
      if (q.type === 'multiple_choice' && q.options) {
        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        q.options.forEach((opt, i) => {
          formattedText += `${labels[i]}. ${opt}\n`;
        });
      } else if (q.type === 'true_false' && q.subQuestions) {
        const labels = ['a', 'b', 'c', 'd', 'e', 'f'];
        q.subQuestions.forEach((subQ, i) => {
          formattedText += `${labels[i]}) ${subQ.content}\n`;
        });
      }
      formattedText += '\n';
    });

    if (targetFormForQuestionBank === 'lesson') {
      setAssignmentFormData(prev => ({
        ...prev,
        [targetPartForQuestionBank]: prev[targetPartForQuestionBank] ? prev[targetPartForQuestionBank] + '\n\n' + formattedText : formattedText
      }));
    } else {
      setIndependentAssignmentFormData(prev => ({
        ...prev,
        [targetPartForQuestionBank]: prev[targetPartForQuestionBank] ? prev[targetPartForQuestionBank] + '\n\n' + formattedText : formattedText
      }));
    }

    setIsQuestionBankModalOpen(false);
  };

  const filteredBankQuestions = bankQuestions.filter(q => {
    const matchSubject = !qbFilterSubject || q.subjectId === qbFilterSubject;
    const matchTopic = !qbFilterTopic || q.topicId === qbFilterTopic;
    const matchDifficulty = !qbFilterDifficulty || q.difficulty === qbFilterDifficulty;
    const matchSearch = !qbSearch || q.content?.toLowerCase()?.includes(qbSearch.toLowerCase());
    
    // Auto-filter type based on target part
    let matchType = true;
    if (targetPartForQuestionBank === 'part1') matchType = q.type === 'multiple_choice';
    if (targetPartForQuestionBank === 'part2') matchType = q.type === 'true_false';
    if (targetPartForQuestionBank === 'part3') matchType = q.type === 'short_answer';
    if (targetPartForQuestionBank === 'part4') matchType = q.type === 'essay';

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
      part1: '',
      part2: '',
      part3: '',
      part4: ''
    });
    
    if (lesson.classId) {
      const studentsInClass = students.filter(s => String(s.classId) === String(lesson.classId));
      setClassStudents(studentsInClass);
    } else {
      setClassStudents([]);
    }
    setSelectAllStudents(false);
    
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
      part1: assignmentFormData.part1,
      part2: assignmentFormData.part2,
      part3: assignmentFormData.part3,
      part4: assignmentFormData.part4
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
      questions: [],
      part1: '',
      part2: '',
      part3: '',
      part4: ''
    });
    setClassStudents([]);
    setSelectAllStudents(false);
    setIsIndependentAssignmentModalOpen(true);
  };

  const handleEditIndependentAssignment = (assignment: Assignment) => {
    setEditingIndependentAssignmentId(assignment.id);
    
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
      questions: assignment.questions || [],
      part1: assignment.part1 || '',
      part2: assignment.part2 || '',
      part3: assignment.part3 || '',
      part4: assignment.part4 || ''
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
    if (!independentAssignmentFormData.title || (!independentAssignmentFormData.description && !independentAssignmentFormData.part1 && !independentAssignmentFormData.part2 && !independentAssignmentFormData.part3 && !independentAssignmentFormData.part4)) {
      alert('Vui lòng nhập tên bài tập và nội dung bài tập');
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
      questions: independentAssignmentFormData.questions,
      part1: independentAssignmentFormData.part1,
      part2: independentAssignmentFormData.part2,
      part3: independentAssignmentFormData.part3,
      part4: independentAssignmentFormData.part4
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
              {assignments.map(assignment => {
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
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    Chưa có bài tập độc lập nào.
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
            <textarea
              required
              rows={4}
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              placeholder="Nhập nội dung bài học hoặc yêu cầu cần đạt..."
            />
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
                    <textarea
                      value={block.data.content}
                      onChange={e => updateBlockData(block.id, { content: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Nhập nội dung văn bản..."
                      rows={3}
                    />
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
                                        <button 
                                          onClick={() => {
                                            setEditingSubmissionId(submission.id);
                                            setGradingData({ score: submission.score?.toString() || '', feedback: submission.feedback || '' });
                                          }}
                                          className="text-xs text-indigo-600 hover:underline mt-1"
                                        >
                                          Sửa điểm
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => {
                                          setEditingSubmissionId(submission.id);
                                          setGradingData({ score: '', feedback: submission.feedback || '' });
                                        }}
                                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-medium rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                                      >
                                        Chấm điểm
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-4 mb-4">
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
                                    <div className="text-sm text-slate-700 [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>h1]:text-xl [&>h1]:font-bold [&>h2]:text-lg [&>h2]:font-bold" dangerouslySetInnerHTML={{ __html: submission.part4Content }} />
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
                                      min="0" max="10" step="0.5"
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
        <form onSubmit={handleSubmitAssignment} className="space-y-6">
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

          <div className="space-y-6 border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900">Nội dung câu hỏi bài tập</h3>
            
            {/* Part I */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần I: Bài tập Trắc nghiệm</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('lesson', 'part1')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                  >
                    <BookOpen size={14} />
                    <span>Chọn từ Ngân hàng</span>
                  </button>
                </div>
              </div>
              <textarea
                value={assignmentFormData.part1}
                onChange={e => setAssignmentFormData({...assignmentFormData, part1: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                rows={4}
                placeholder="Nhập danh sách câu hỏi trắc nghiệm..."
              />
            </div>

            {/* Part II */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần II: Bài tập Trắc nghiệm Đúng/Sai</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('lesson', 'part2')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                  >
                    <BookOpen size={14} />
                    <span>Chọn từ Ngân hàng</span>
                  </button>
                </div>
              </div>
              <textarea
                value={assignmentFormData.part2}
                onChange={e => setAssignmentFormData({...assignmentFormData, part2: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                rows={4}
                placeholder="Nhập danh sách câu hỏi đúng/sai..."
              />
            </div>

            {/* Part III */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần III: Bài tập Trả lời ngắn</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('lesson', 'part3')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                  >
                    <BookOpen size={14} />
                    <span>Chọn từ Ngân hàng</span>
                  </button>
                </div>
              </div>
              <textarea
                value={assignmentFormData.part3}
                onChange={e => setAssignmentFormData({...assignmentFormData, part3: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                rows={4}
                placeholder="Nhập danh sách câu hỏi trả lời ngắn..."
              />
            </div>

            {/* Part IV */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần IV: Bài tập Tự luận</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('lesson', 'part4')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                  >
                    <BookOpen size={14} />
                    <span>Chọn từ Ngân hàng</span>
                  </button>
                </div>
              </div>
              <textarea
                value={assignmentFormData.part4}
                onChange={e => setAssignmentFormData({...assignmentFormData, part4: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                rows={4}
                placeholder="Nhập danh sách câu hỏi tự luận..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
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
        <form onSubmit={handleSubmitIndependentAssignment} className="space-y-6">
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

          <div className="space-y-6 border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900">Cấu trúc nội dung bài tập</h3>
            
            {/* Part I */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần I: Bài tập Trắc nghiệm</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('independent', 'part1')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                  >
                    <BookOpen size={14} />
                    <span>Chọn từ Ngân hàng</span>
                  </button>
                </div>
              </div>
              <textarea
                value={independentAssignmentFormData.part1}
                onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, part1: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                rows={4}
                placeholder="Nhập danh sách câu hỏi trắc nghiệm..."
              />
            </div>

            {/* Part II */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần II: Bài tập Trắc nghiệm Đúng/Sai</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('independent', 'part2')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                  >
                    <BookOpen size={14} />
                    <span>Chọn từ Ngân hàng</span>
                  </button>
                </div>
              </div>
              <textarea
                value={independentAssignmentFormData.part2}
                onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, part2: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                rows={4}
                placeholder="Nhập danh sách câu hỏi đúng/sai..."
              />
            </div>

            {/* Part III */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần III: Bài tập Trả lời ngắn</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('independent', 'part3')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                  >
                    <BookOpen size={14} />
                    <span>Chọn từ Ngân hàng</span>
                  </button>
                </div>
              </div>
              <textarea
                value={independentAssignmentFormData.part3}
                onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, part3: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                rows={4}
                placeholder="Nhập danh sách câu hỏi trả lời ngắn..."
              />
            </div>

            {/* Part IV */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần IV: Bài tập Tự luận</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuestionBankModal('independent', 'part4')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                  >
                    <BookOpen size={14} />
                    <span>Chọn từ Ngân hàng</span>
                  </button>
                </div>
              </div>
              <textarea
                value={independentAssignmentFormData.part4}
                onChange={e => setIndependentAssignmentFormData({...independentAssignmentFormData, part4: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                rows={4}
                placeholder="Nhập danh sách câu hỏi tự luận..."
              />
            </div>
          </div>

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
          <div className="flex justify-end gap-3 pt-4 border-t">
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
                    <p className="text-sm text-gray-900 font-medium line-clamp-2">{q.content}</p>
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
            <span className="text-sm text-gray-600">
              Đã chọn <span className="font-bold text-emerald-600">{selectedBankQuestions.length}</span> câu hỏi
            </span>
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


