import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, BookOpen, CheckCircle, XCircle, Sparkles, Loader2, FileText, Upload, FileUp, Users, Check, Video, HelpCircle, Code, Image as ImageIcon, GripVertical, RefreshCw } from 'lucide-react';
import { dataProvider } from '../../core/provider';
import { Lesson, Subject, Topic, Assignment, Submission, User, InteractiveBlock, Class, InteractiveQuestion, InteractiveQuestionType, Progress, EssayQuestion } from '../../core/types';
import { Modal } from '../../components/Modal';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { ensureArray } from '../../core/utils/data';

const LessonManagement = () => {
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
    videoUrl: '',
    interactiveContent: [] as InteractiveBlock[],
    essayQuestions: [] as EssayQuestion[]
  });

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const addInteractiveQuestion = () => {
    const newBlock: InteractiveBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'interactive_question',
      data: {
        interactiveQuestion: {
          id: Math.random().toString(36).substr(2, 9),
          type: 'mcq',
          question: '',
          options: ['', ''],
          correctAnswer: '',
        }
      }
    };
    setFormData(prev => ({
      ...prev,
      interactiveContent: [...ensureArray(prev.interactiveContent), newBlock]
    }));
  };

  const updateInteractiveQuestion = (blockId: string, questionData: Partial<InteractiveQuestion>) => {
    setFormData(prev => ({
      ...prev,
      interactiveContent: ensureArray(prev.interactiveContent).map(b => 
        b.id === blockId ? { ...b, data: { ...b.data, interactiveQuestion: { ...b.data.interactiveQuestion!, ...questionData } } } : b
      )
    }));
  };

  const generateQuestionWithAI = async (blockId: string, type: InteractiveQuestionType) => {
    if (!formData.title || !formData.content) {
      alert('Vui lòng nhập tiêu đề và nội dung bài giảng trước khi tạo câu hỏi.');
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let typeDesc = '';
      switch(type) {
        case 'mcq': typeDesc = 'trắc nghiệm (MCQ) với 4 lựa chọn'; break;
        case 'true_false': typeDesc = 'Đúng/Sai'; break;
        case 'fill_in_the_blank': typeDesc = 'điền vào chỗ trống'; break;
        case 'drag_drop': typeDesc = 'kéo thả (ghép đôi)'; break;
        case 'click_reveal': typeDesc = 'click-and-reveal (thông tin ẩn)'; break;
      }

      const prompt = `Bạn là một giáo viên chuyên nghiệp. Hãy tạo một câu hỏi ${typeDesc} dựa trên nội dung bài học sau:
      - Tiêu đề: ${formData.title}
      - Nội dung: ${formData.content}
      
      Yêu cầu:
      - Trình bày rõ ràng, dễ hiểu.
      - Trả về JSON với cấu trúc: { "question": "...", "options": ["...", "..."], "correctAnswer": "...", "explanation": "..." }.
      - Nếu là MCQ, options là mảng 4 đáp án.
      - Nếu là Đúng/Sai, options là ["Đúng", "Sai"].
      - Nếu là điền vào chỗ trống, options là null.
      - Nếu là kéo thả, options là mảng các cặp "A|B" và correctAnswer là null.
      - Nếu là click-and-reveal, options là mảng các tiêu đề và correctAnswer là mảng các nội dung tương ứng.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        updateInteractiveQuestion(blockId, {
          type,
          question: data.question,
          options: data.options,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation
        });
      }
    } catch (error) {
      console.error("Error generating question:", error);
      alert('Có lỗi xảy ra khi tạo câu hỏi bằng AI. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Assignment State
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedLessonForAssignment, setSelectedLessonForAssignment] = useState<Lesson | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<'manual' | 'ai' | 'file'>('manual');
  const [assignmentFormData, setAssignmentFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // Default 1 week
    part1: '',
    part2: '',
    part3: '',
    part4: ''
  });
  const [isGeneratingAssignment, setIsGeneratingAssignment] = useState(false);
  const [isExtractingPart, setIsExtractingPart] = useState({
    part1: false,
    part2: false,
    part3: false,
    part4: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Grading State
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [selectedLessonForGrading, setSelectedLessonForGrading] = useState<Lesson | null>(null);
  const [lessonAssignments, setLessonAssignments] = useState<Assignment[]>([]);
  const [lessonSubmissions, setLessonSubmissions] = useState<Submission[]>([]);
  const [lessonProgresses, setLessonProgresses] = useState<Progress[]>([]);
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
    attachments: [] as string[]
  });
  const [classStudents, setClassStudents] = useState<User[]>([]);
  const [selectAllStudents, setSelectAllStudents] = useState(false);
    const [independentAssignments, setIndependentAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [lesData, subData, topData, classData, studentData, assignData] = await Promise.all([
      dataProvider.getList<Lesson>('lessons'),
      dataProvider.getList<Subject>('subjects'),
      dataProvider.getList<Topic>('topics'),
      dataProvider.getList<Class>('classes'),
      dataProvider.getList<User>('users', { role: 'student' }),
      dataProvider.getList<Assignment>('assignments')
    ]);
    setLessons(lesData);
    setSubjects(subData);
    setTopics(topData);
    setClasses(classData);
    setStudents(studentData);
    setIndependentAssignments(assignData.filter(a => !a.lessonId));
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
        videoUrl: lesson.videoUrl || '',
        interactiveContent: ensureArray(lesson.interactiveContent),
        essayQuestions: ensureArray(lesson.essayQuestions)
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
        videoUrl: '',
        interactiveContent: [],
        essayQuestions: []
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
      videoUrl: formData.videoUrl,
      interactiveContent: formData.interactiveContent,
      essayQuestions: formData.essayQuestions
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
      await dataProvider.delete('lessons', confirmDelete);
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

  const addEssayQuestion = () => {
    const newQuestion: EssayQuestion = {
      id: Math.random().toString(36).substr(2, 9),
      content: ''
    };
    setFormData(prev => ({
      ...prev,
      essayQuestions: [...ensureArray(prev.essayQuestions), newQuestion]
    }));
  };

  const updateEssayQuestion = (id: string, content: string) => {
    setFormData(prev => ({
      ...prev,
      essayQuestions: ensureArray(prev.essayQuestions).map(q => 
        q.id === id ? { ...q, content } : q
      )
    }));
  };

  const removeEssayQuestion = (id: string) => {
    setFormData(prev => ({
      ...prev,
      essayQuestions: ensureArray(prev.essayQuestions).filter(q => q.id !== id)
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
    setAssignmentMode('manual');
    setAssignmentFormData({
      title: `Bài tập: ${lesson.title}`,
      description: '',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      part1: '',
      part2: '',
      part3: '',
      part4: ''
    });
    setSelectedFile(null);
    setIsAssignmentModalOpen(true);
  };

  const handleImportPDFToPart = async (partKey: 'part1' | 'part2' | 'part3' | 'part4', file: File) => {
    if (!file) return;
    
    setIsExtractingPart(prev => ({ ...prev, [partKey]: true }));
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      
      const base64Data = await base64Promise;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let partName = '';
      if (partKey === 'part1') partName = 'Trắc nghiệm nhiều lựa chọn';
      if (partKey === 'part2') partName = 'Trắc nghiệm Đúng/Sai';
      if (partKey === 'part3') partName = 'Trả lời ngắn';
      if (partKey === 'part4') partName = 'Tự luận';

      const prompt = `Bạn là một chuyên gia giáo dục. Hãy trích xuất danh sách các câu hỏi thuộc loại "${partName}" từ file PDF đính kèm.
      
      YÊU CẦU:
      1. Chỉ trích xuất các câu hỏi phù hợp với loại: ${partName}.
      2. Đối với Trắc nghiệm: Trích xuất cả câu hỏi và các phương án A, B, C, D.
      3. Đối với Đúng/Sai: Trích xuất câu hỏi dẫn và các ý a, b, c, d.
      4. Giữ nguyên nội dung gốc, không thêm bớt thông tin.
      5. Định dạng kết quả: Mỗi câu hỏi cách nhau bởi một dòng trống. Các phương án hoặc ý nhỏ xuống dòng.
      6. Nếu không tìm thấy bất kỳ câu hỏi nào thuộc loại này, hãy trả về duy nhất câu: "Không tìm thấy câu hỏi phù hợp".
      
      Hãy thực hiện trích xuất một cách chính xác và đầy đủ nhất.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'application/pdf'
            }
          },
          { text: prompt }
        ],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      if (response.text) {
        setAssignmentFormData(prev => ({ ...prev, [partKey]: response.text }));
      }
    } catch (error) {
      console.error("Error extracting PDF part:", error);
      alert('Có lỗi xảy ra khi trích xuất dữ liệu từ PDF. Vui lòng thử lại.');
    } finally {
      setIsExtractingPart(prev => ({ ...prev, [partKey]: false }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleGenerateAssignmentFromAI = async () => {
    if (!selectedLessonForAssignment) return;
    
    setIsGeneratingAssignment(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let contents: any = `Bạn là một giáo viên chuyên nghiệp. Hãy tạo một bài tập về nhà (hoặc bài thực hành) cho học sinh dựa trên bài học sau:
      - Tiêu đề bài học: ${selectedLessonForAssignment.title}
      - Nội dung bài học: ${selectedLessonForAssignment.content}
      
      Yêu cầu:
      - Tạo 3-5 câu hỏi tự luận hoặc bài tập thực hành.
      - Trình bày rõ ràng, dễ hiểu.
      - Trả về nội dung bài tập dưới dạng văn bản thuần túy.`;

      if (assignmentMode === 'file' && selectedFile) {
        // If it's a PDF, we can try to send it to Gemini
        if (selectedFile.type === 'application/pdf') {
           const reader = new FileReader();
           const base64Promise = new Promise<string>((resolve) => {
             reader.onload = () => {
               const base64 = (reader.result as string).split(',')[1];
               resolve(base64);
             };
             reader.readAsDataURL(selectedFile);
           });
           const base64Data = await base64Promise;
           
           contents = {
             parts: [
               {
                 inlineData: {
                   mimeType: 'application/pdf',
                   data: base64Data
                 }
               },
               {
                 text: `Dựa vào tài liệu đính kèm và bài học "${selectedLessonForAssignment.title}", hãy tạo một bài tập về nhà gồm 3-5 câu hỏi tự luận hoặc bài tập thực hành.`
               }
             ]
           };
        } else {
           // For docx/pptx, we simulate extraction since we can't easily parse them in browser without heavy libs
           contents = `Dựa vào tài liệu "${selectedFile.name}" (giả lập nội dung) và bài học "${selectedLessonForAssignment.title}", hãy tạo một bài tập về nhà gồm 3-5 câu hỏi tự luận hoặc bài tập thực hành.`;
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
      });

      if (response.text) {
        setAssignmentFormData(prev => ({ ...prev, description: response.text }));
      }
    } catch (error) {
      console.error("Error generating assignment:", error);
      alert('Có lỗi xảy ra khi tạo bài tập bằng AI. Vui lòng thử lại.');
    } finally {
      setIsGeneratingAssignment(false);
    }
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
      classId: selectedLessonForAssignment.classId,
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

    // Fetch progresses for this lesson
    const allProgresses = await dataProvider.getList<Progress>('progresses');
    const progressesForLesson = allProgresses.filter(p => p.lessonId === lesson.id);
    setLessonProgresses(progressesForLesson);

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

  const handleSaveProgressFeedback = async (progressId: string, feedback: string) => {
    try {
      const allProgresses = await dataProvider.getList<Progress>('progresses');
      const progress = allProgresses.find(p => p.id === progressId);
      if (!progress) return;

      const updatedProgress = {
        ...progress,
        teacherFeedback: {
          comment: feedback,
          date: new Date().toISOString()
        }
      };

      await dataProvider.update('progresses', progressId, updatedProgress);
      setLessonProgresses(prev => prev.map(p => p.id === progressId ? updatedProgress : p));
      alert('Đã lưu nhận xét.');
    } catch (error) {
      console.error("Error saving feedback:", error);
      alert('Có lỗi xảy ra khi lưu nhận xét.');
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
      attachments: []
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
      attachments: parsedAttachments
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
    if (!independentAssignmentFormData.title || !independentAssignmentFormData.description) {
      alert('Vui lòng nhập tên bài tập và nội dung');
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
      attachments: independentAssignmentFormData.attachments
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
    if (searchTitle && !lesson.title.toLowerCase().includes(searchTitle.toLowerCase())) return false;
    
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Quản lý Bài giảng</h1>
          <p className="text-sm text-gray-500 mt-1">Soạn thảo và quản lý nội dung bài học</p>
        </div>
        <div className="flex flex-col xs:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={18} />
            <span>Thêm bài giảng</span>
          </button>
        </div>
      </div>

      
      
        {/* Filters */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Khối</label>
          <select
            value={filterGrade}
            onChange={e => { setFilterGrade(e.target.value); setFilterClassId(''); }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả</option>
            <option value="10">Khối 10</option>
            <option value="11">Khối 11</option>
            <option value="12">Khối 12</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Lớp</label>
          <select
            value={filterClassId}
            onChange={e => setFilterClassId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            disabled={!filterGrade}
          >
            <option value="">Tất cả</option>
            {filteredClassesForList.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Môn học</label>
          <select
            value={filterSubjectId}
            onChange={e => { setFilterSubjectId(e.target.value); setFilterTopicId(''); }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Chủ đề</label>
          <select
            value={filterTopicId}
            onChange={e => setFilterTopicId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            disabled={!filterSubjectId}
          >
            <option value="">Tất cả</option>
            {filterTopicsForList.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Trạng thái</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả</option>
            <option value="published">Đã xuất bản</option>
            <option value="draft">Bản nháp</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tìm bài học</label>
          <input
            type="text"
            value={searchTitle}
            onChange={e => setSearchTitle(e.target.value)}
            placeholder="Tên bài học..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="py-4 px-6 text-sm font-semibold text-gray-600">Tiêu đề</th>
              <th className="py-4 px-6 text-sm font-semibold text-gray-600">Khối/Lớp</th>
              <th className="py-4 px-6 text-sm font-semibold text-gray-600">Chủ đề</th>
              <th className="py-4 px-6 text-sm font-semibold text-gray-600">Trạng thái</th>
              <th className="py-4 px-6 text-sm font-semibold text-gray-600 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredLessons.map(lesson => {
              const topic = topics.find(t => t.id === lesson.topicId);
              const cls = classes.find(c => String(c.id) === String(lesson.classId));
              return (
                <tr key={lesson.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <BookOpen size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{lesson.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          {lesson.videoUrl && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                              <Video size={10} />
                              Video
                            </span>
                          )}
                          {lesson.pptUrl && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              <FileText size={10} />
                              PPT
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-600">
                    Khối {lesson.grade} {cls ? `- ${cls.name}` : ''}
                  </td>
                  <td className="py-4 px-6 text-gray-600">{topic?.name || '---'}</td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => toggleStatus(lesson)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        lesson.status === 'published' 
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {lesson.status === 'published' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      {lesson.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                    </button>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenGradingModal(lesson)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                        title="Chấm bài"
                      >
                        <Users size={18} />
                        <span className="text-xs font-medium hidden sm:inline">Chấm bài</span>
                      </button>
                      <button
                        onClick={() => handleOpenModal(lesson)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(lesson.id)}
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
            {filteredLessons.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  Chưa có bài giảng nào phù hợp với bộ lọc.
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung / Yêu cầu cần đạt</label>
            <textarea
              required
              rows={4}
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Nhập nội dung bài giảng hoặc yêu cầu học sinh cần đạt..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Video size={16} className="text-red-600" />
              Link Video Bài Giảng (YouTube / Google Drive)
            </label>
            <input
              type="text"
              value={formData.videoUrl}
              onChange={e => setFormData({...formData, videoUrl: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="text-[10px] text-gray-500 mt-1 italic leading-tight">
              * Hỗ trợ link YouTube hoặc Google Drive (đã bật chia sẻ công khai).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <FileText size={16} className="text-indigo-600" />
              Link PowerPoint (Google Slides / OneDrive / Direct Link)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.pptUrl}
                onChange={e => setFormData({...formData, pptUrl: e.target.value})}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="https://docs.google.com/presentation/d/..."
              />
              <label className="cursor-pointer px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2">
                <Upload size={18} />
                <span className="text-sm">Tải file</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".ppt,.pptx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFormData({...formData, pptUrl: file.name});
                      alert(`Đã chọn file: ${file.name}. Trong thực tế, file này sẽ được tải lên server.`);
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 italic leading-tight">
              * Để xem trực tiếp không bị lỗi "Từ chối kết nối": <br/>
              - <b>Google Slides:</b> Vào Tệp → Chia sẻ → <b>Xuất bản lên web</b> → Nhấn Xuất bản và dán link đó vào đây. <br/>
              - <b>Google Drive:</b> Đảm bảo file ở chế độ "Bất kỳ ai có liên kết đều có thể xem". <br/>
              - <b>OneDrive:</b> Sử dụng tính năng "Embed" (Nhúng) để lấy link.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Câu hỏi tương tác</label>
              <button
                type="button"
                onClick={addInteractiveQuestion}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Thêm câu hỏi
              </button>
            </div>
            <div className="space-y-4">
              {ensureArray(formData.interactiveContent).filter(b => b.type === 'interactive_question').map(block => (
                <div key={block.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex justify-between mb-2">
                    <select
                      value={block.data.interactiveQuestion?.type}
                      onChange={e => updateInteractiveQuestion(block.id, { type: e.target.value as InteractiveQuestionType })}
                      className="text-sm border-gray-200 rounded-lg"
                    >
                      <option value="mcq">Trắc nghiệm</option>
                      <option value="true_false">Đúng/Sai</option>
                      <option value="fill_in_the_blank">Điền vào chỗ trống</option>
                      <option value="drag_drop">Kéo thả</option>
                      <option value="click_reveal">Click-and-reveal</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => generateQuestionWithAI(block.id, block.data.interactiveQuestion?.type || 'mcq')}
                      disabled={isGenerating}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      <Sparkles size={16} /> AI
                    </button>
                  </div>
                  <input
                    type="text"
                    value={block.data.interactiveQuestion?.question}
                    onChange={e => updateInteractiveQuestion(block.id, { question: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                    placeholder="Nhập câu hỏi..."
                  />
                  
                  {block.data.interactiveQuestion?.type === 'mcq' && (
                    <div className="space-y-2">
                      {ensureArray(block.data.interactiveQuestion.options).map((opt, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const newOpts = [...ensureArray(block.data.interactiveQuestion!.options)];
                              newOpts[idx] = e.target.value;
                              updateInteractiveQuestion(block.id, { options: newOpts });
                            }}
                            className="flex-1 px-3 py-1 border border-gray-200 rounded-lg text-xs"
                            placeholder={`Đáp án ${idx + 1}`}
                          />
                          <input
                            type="radio"
                            name={`correct-${block.id}`}
                            checked={block.data.interactiveQuestion?.correctAnswer === opt}
                            onChange={() => updateInteractiveQuestion(block.id, { correctAnswer: opt })}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {block.data.interactiveQuestion?.type === 'true_false' && (
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`tf-${block.id}`}
                          checked={block.data.interactiveQuestion?.correctAnswer === 'Đúng'}
                          onChange={() => updateInteractiveQuestion(block.id, { correctAnswer: 'Đúng' })}
                        /> Đúng
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`tf-${block.id}`}
                          checked={block.data.interactiveQuestion?.correctAnswer === 'Sai'}
                          onChange={() => updateInteractiveQuestion(block.id, { correctAnswer: 'Sai' })}
                        /> Sai
                      </label>
                    </div>
                  )}

                  {block.data.interactiveQuestion?.type === 'fill_in_the_blank' && (
                    <input
                      type="text"
                      value={block.data.interactiveQuestion?.correctAnswer as string}
                      onChange={e => updateInteractiveQuestion(block.id, { correctAnswer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="Đáp án đúng..."
                    />
                  )}

                  {block.data.interactiveQuestion?.type === 'drag_drop' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 italic">Nhập các cặp ghép đôi, định dạng: "A|B" (Ví dụ: "Thủ đô|Hà Nội")</p>
                      {ensureArray(block.data.interactiveQuestion.options).map((opt, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const newOpts = [...ensureArray(block.data.interactiveQuestion!.options)];
                              newOpts[idx] = e.target.value;
                              updateInteractiveQuestion(block.id, { options: newOpts });
                            }}
                            className="flex-1 px-3 py-1 border border-gray-200 rounded-lg text-xs"
                            placeholder={`Cặp ${idx + 1}`}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = [...ensureArray(block.data.interactiveQuestion!.options), ''];
                          updateInteractiveQuestion(block.id, { options: newOpts });
                        }}
                        className="text-xs text-indigo-600"
                      >
                        + Thêm cặp
                      </button>
                    </div>
                  )}

                  {block.data.interactiveQuestion?.type === 'click_reveal' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 italic">Nhập tiêu đề và nội dung ẩn tương ứng.</p>
                      {ensureArray(block.data.interactiveQuestion.options).map((opt, idx) => (
                        <div key={idx} className="space-y-1 p-2 bg-white rounded-lg border border-gray-100">
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const newOpts = [...ensureArray(block.data.interactiveQuestion!.options)];
                              newOpts[idx] = e.target.value;
                              updateInteractiveQuestion(block.id, { options: newOpts });
                            }}
                            className="w-full px-3 py-1 border border-gray-200 rounded-lg text-xs font-bold"
                            placeholder={`Tiêu đề ${idx + 1}`}
                          />
                          <textarea
                            value={ensureArray(block.data.interactiveQuestion!.correctAnswer)[idx] || ''}
                            onChange={e => {
                              const newAnswers = [...ensureArray(block.data.interactiveQuestion!.correctAnswer) as string[]];
                              newAnswers[idx] = e.target.value;
                              updateInteractiveQuestion(block.id, { correctAnswer: newAnswers });
                            }}
                            className="w-full px-3 py-1 border border-gray-200 rounded-lg text-xs"
                            placeholder={`Nội dung ẩn ${idx + 1}`}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = [...ensureArray(block.data.interactiveQuestion!.options), ''];
                          const newAnswers = [...ensureArray(block.data.interactiveQuestion!.correctAnswer) as string[], ''];
                          updateInteractiveQuestion(block.id, { options: newOpts, correctAnswer: newAnswers });
                        }}
                        className="text-xs text-indigo-600"
                      >
                        + Thêm mục
                      </button>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => removeInteractiveBlock(block.id)}
                    className="mt-2 text-xs text-red-500 hover:text-red-700"
                  >
                    Xóa câu hỏi
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Câu hỏi tự luận</label>
              <button
                type="button"
                onClick={addEssayQuestion}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Thêm câu hỏi tự luận
              </button>
            </div>
            <div className="space-y-4">
              {ensureArray(formData.essayQuestions).map((question, index) => (
                <div key={question.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Câu {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeEssayQuestion(question.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Xóa
                    </button>
                  </div>
                  <textarea
                    value={question.content}
                    onChange={e => updateEssayQuestion(question.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Nhập nội dung câu hỏi tự luận..."
                    rows={3}
                  />
                </div>
              ))}
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
          <p className="text-gray-700 mb-6">Bạn có chắc chắn muốn xóa bài giảng này không?</p>
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

      



      {/* Modal Chấm bài & Nhận xét */}
      <Modal
        isOpen={isGradingModalOpen}
        onClose={() => { setIsGradingModalOpen(false); setEditingSubmissionId(null); }}
        title="Theo dõi & Nhận xét học sinh"
      >
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <BookOpen size={18} />
            {selectedLessonForGrading ? `Bài giảng: ${selectedLessonForGrading.title}` : 'Bài tập'}
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              Tiến độ & Nhận xét học tập
            </h3>
            
            <div className="space-y-3">
              {students.map(student => {
                const progress = lessonProgresses.find(p => p.studentId === student.id);
                return (
                  <StudentProgressRow 
                    key={student.id} 
                    student={student} 
                    progress={progress} 
                    lesson={selectedLessonForGrading}
                    onSaveFeedback={handleSaveProgressFeedback} 
                  />
                );
              })}
            </div>
          </div>

          {lessonAssignments.length > 0 && (
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                Bài tập & Điểm số
              </h3>
              
              <div className="space-y-6">
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
                                            setGradingData({ score: '', feedback: '' });
                                          }}
                                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-medium rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                                        >
                                          Chấm điểm
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-700 whitespace-pre-wrap mb-3 border border-gray-100">
                                  {submission.content || <span className="italic text-gray-400">Không có nội dung văn bản</span>}
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

          <div className="space-y-6 border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900">Nội dung câu hỏi bài tập</h3>
            
            {/* Part I */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Phần I: Bài tập Trắc nghiệm</label>
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium cursor-pointer">
                  {isExtractingPart.part1 ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                  <span>Nhập từ PDF</span>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleImportPDFToPart('part1', e.target.files[0])}
                  />
                </label>
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
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium cursor-pointer">
                  {isExtractingPart.part2 ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                  <span>Nhập từ PDF</span>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleImportPDFToPart('part2', e.target.files[0])}
                  />
                </label>
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
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium cursor-pointer">
                  {isExtractingPart.part3 ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                  <span>Nhập từ PDF</span>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleImportPDFToPart('part3', e.target.files[0])}
                  />
                </label>
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
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium cursor-pointer">
                  {isExtractingPart.part4 ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                  <span>Nhập từ PDF</span>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleImportPDFToPart('part4', e.target.files[0])}
                  />
                </label>
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

    </div>
  );
};

const StudentProgressRow = ({ student, progress, lesson, onSaveFeedback }: { student: User, progress: Progress | undefined, lesson: Lesson | null, onSaveFeedback: (id: string, feedback: string) => Promise<void>, key?: any }) => {
  const [feedback, setFeedback] = useState(progress?.teacherFeedback?.comment || '');
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-2xl hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="font-bold text-gray-900">{student.fullName}</span>
          <span className="text-xs text-gray-500 ml-2">({student.username})</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
              progress?.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {progress?.completed ? 'Đã hoàn thành' : 'Đang học'}
            </span>
            {progress?.lastAccessed && (
              <span className="text-[10px] text-gray-400">
                Cập nhật: {new Date(progress.lastAccessed).toLocaleDateString('vi-VN')}
              </span>
            )}
          </div>
        </div>
        
        {progress?.quizScores && Object.keys(progress.quizScores).length > 0 && (
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Điểm tương tác</p>
            <div className="flex gap-1 justify-end">
              {Object.entries(progress.quizScores).map(([qId, score]) => (
                <span key={qId} className="w-6 h-6 flex items-center justify-center bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100">
                  {score}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {lesson?.essayQuestions && lesson.essayQuestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase">Câu hỏi tự luận</p>
          {lesson.essayQuestions.map((q, idx) => {
            const answer = progress?.essayAnswers?.[q.id];
            return (
              <div key={q.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-sm font-medium text-gray-800 mb-2">Câu {idx + 1}: {q.content}</p>
                {answer ? (
                  <div className="text-sm text-gray-600 bg-white p-2 rounded-lg border border-gray-200 whitespace-pre-wrap">
                    {answer}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Chưa trả lời</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-50">
        {!isEditingFeedback ? (
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              {progress?.teacherFeedback ? (
                <div className="text-sm text-gray-600 italic bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                  <span className="font-semibold text-amber-800 not-italic">Nhận xét: </span>
                  {progress.teacherFeedback.comment}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Chưa có nhận xét nào.</p>
              )}
            </div>
            <button 
              onClick={() => setIsEditingFeedback(true)}
              className="text-xs text-indigo-600 font-medium hover:underline shrink-0"
            >
              {progress?.teacherFeedback ? 'Sửa nhận xét' : 'Thêm nhận xét'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder="Nhập nhận xét về quá trình học của học sinh..."
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => {
                  setIsEditingFeedback(false);
                  setFeedback(progress?.teacherFeedback?.comment || '');
                }}
                className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={async () => {
                  if (progress) {
                    await onSaveFeedback(progress.id, feedback);
                    setIsEditingFeedback(false);
                  } else {
                    alert('Học sinh chưa bắt đầu học bài này nên chưa thể nhận xét.');
                  }
                }}
                className="px-3 py-1 text-xs bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Lưu nhận xét
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonManagement;
