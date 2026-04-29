import React, { useEffect, useState } from 'react';
import { dataProvider } from '../../core/provider';
import { Test, Class, Topic, Question, QuestionType, BankQuestion, Subject } from '../../core/types';
import { Modal } from '../../components/Modal';
import { Plus, Search, Edit2, Trash2, Clock, Users, Sparkles, Loader2, Calendar, FileUp, Download, FileSpreadsheet } from 'lucide-react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

import { useNavigate } from 'react-router-dom';
import { parseTruncatedJSON } from '../../utils/jsonUtils';
import { QuillEditor } from '../../components/QuillEditor';
import { ensureArray } from '../../core/utils/data';
import { read, utils, writeFile } from 'xlsx';

export const TestManagement: React.FC = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState<Partial<Test>>({
    title: '',
    topicId: '',
    durationMinutes: 45,
    startTime: '',
    endTime: '',
    questions: [],
    assignedTo: { type: 'class', ids: [] }
  });

  // AI Generation state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiConfig, setAiConfig] = useState<Record<QuestionType, { recognition: number, understanding: number, application: number }>>({
    multiple_choice: { recognition: 0, understanding: 0, application: 0 },
    true_false: { recognition: 0, understanding: 0, application: 0 },
    short_answer: { recognition: 0, understanding: 0, application: 0 },
    essay: { recognition: 0, understanding: 0, application: 0 }
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // File Import state
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Manual Question state
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState<Partial<Question>>({
    type: 'multiple_choice',
    difficulty: 'recognition',
    content: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    points: 0.25
  });

  // Question Bank state
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedBankQuestions, setSelectedBankQuestions] = useState<string[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [bankFilterSubject, setBankFilterSubject] = useState('');
  const [bankFilterTopic, setBankFilterTopic] = useState('');
  const [bankFilterDifficulty, setBankFilterDifficulty] = useState('');
  const [bankFilterType, setBankFilterType] = useState('');

  const fetchData = async () => {
    const [testsData, classesData, topicsData, bankData, subjectsData] = await Promise.all([
      dataProvider.getList<Test>('tests'),
      dataProvider.getList<Class>('classes'),
      dataProvider.getList<Topic>('topics'),
      dataProvider.getList<BankQuestion>('bank_questions'),
      dataProvider.getList<Subject>('subjects')
    ]);
    setTests(testsData);
    setClasses(classesData);
    setTopics(topicsData);
    setBankQuestions(bankData);
    setSubjects(subjectsData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (test?: Test) => {
    if (test) {
      setEditingTest(test);
      setFormData({
        title: test.title,
        topicId: test.topicId || '',
        durationMinutes: test.durationMinutes,
        startTime: test.startTime ? test.startTime.slice(0, 16) : '', // Format for datetime-local
        endTime: test.endTime ? test.endTime.slice(0, 16) : '',
        questions: test.questions,
        assignedTo: test.assignedTo
      });
    } else {
      setEditingTest(null);
      setFormData({
        title: '',
        topicId: topics[0]?.id || '',
        durationMinutes: 45,
        startTime: '',
        endTime: '',
        questions: [],
        assignedTo: { type: 'class', ids: [] }
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      startTime: new Date(formData.startTime!).toISOString(),
      endTime: new Date(formData.endTime!).toISOString(),
      createdAt: editingTest ? editingTest.createdAt : new Date().toISOString()
    };

    if (editingTest) {
      await dataProvider.update('tests', editingTest.id, payload);
    } else {
      await dataProvider.create('tests', payload);
    }
    
    setIsModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await dataProvider.delete('tests', confirmDelete);
      setConfirmDelete(null);
      fetchData();
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt) {
      alert('Vui lòng nhập chủ đề hoặc nội dung cần tạo câu hỏi.');
      return;
    }

    const totalQuestions = Object.values(aiConfig).reduce((sum, config: any) => 
      sum + config.recognition + config.understanding + config.application, 0
    );

    if (totalQuestions === 0) {
      alert('Vui lòng chọn số lượng câu hỏi cho ít nhất một phần.');
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const promptDetails = Object.entries(aiConfig).map(([type, config]: [string, any]) => {
        const total = config.recognition + config.understanding + config.application;
        if (total === 0) return '';
        
        let typeName = '';
        if (type === 'multiple_choice') typeName = 'Trắc nghiệm nhiều lựa chọn';
        if (type === 'true_false') typeName = 'Đúng/Sai';
        if (type === 'short_answer') typeName = 'Trả lời ngắn';
        if (type === 'essay') typeName = 'Tự luận';

        return `- Phần ${typeName}: Tổng ${total} câu (Nhận biết: ${config.recognition}, Thông hiểu: ${config.understanding}, Vận dụng: ${config.application})`;
      }).filter(Boolean).join('\n');

      const prompt = `Bạn là một chuyên gia khảo thí và xây dựng đề kiểm tra theo định dạng của Bộ Giáo dục và Đào tạo Việt Nam (Công văn 7991).
      Hãy tạo đề kiểm tra môn Tin học THPT về chủ đề: "${aiPrompt}".
      
      BẠN PHẢI TẠO ĐÚNG SỐ LƯỢNG VÀ LOẠI CÂU HỎI NHƯ YÊU CẦU DƯỚI ĐÂY. KHÔNG ĐƯỢC THIẾU HOẶC THỪA:
      ${promptDetails}
      
      Trả về mảng JSON các câu hỏi. Mỗi câu hỏi phải có trường 'difficulty' (recognition, understanding, application) tương ứng với mức độ.
      Bao gồm cả phần giải thích (explanation) ngắn gọn cho đáp án.

      ĐỐI VỚI CÂU HỎI ĐÚNG/SAI (true_false):
      - Quy tắc: 
        1. Lệnh dẫn/Ngữ cảnh (content): Là phần văn bản nêu tình huống, đoạn mã code hoặc bảng dữ liệu chung.
        2. Các ý lựa chọn (subQuestions): Luôn gồm 4 ý ký hiệu là a), b), c), d).
        3. Đáp án (correctAnswer): Mỗi ý a, b, c, d chỉ nhận giá trị là true (Đúng) hoặc false (Sai).
      - Mỗi câu hỏi lớn phải có trường 'subQuestions' là một mảng gồm đầy đủ 4 ý (a, b, c, d).
      - Mỗi ý (subQuestion) phải có 'id' (a, b, c, d), 'content' (nội dung ý), 'difficulty' (mức độ của ý đó: recognition, understanding, application), 'correctAnswer' (boolean), và 'explanation' (giải thích tại sao đúng/sai).`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "Loại câu hỏi: 'multiple_choice', 'true_false', 'short_answer', 'essay'" },
                difficulty: { type: Type.STRING, description: "Mức độ: 'recognition', 'understanding', 'application'" },
                content: { type: Type.STRING, description: "Nội dung câu hỏi" },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các lựa chọn (chỉ dành cho multiple_choice)" },
                correctAnswer: { type: Type.STRING, description: "Câu trả lời đúng (dành cho multiple_choice, short_answer)" },
                subQuestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      content: { type: Type.STRING },
                      difficulty: { type: Type.STRING },
                      correctAnswer: { type: Type.BOOLEAN },
                      explanation: { type: Type.STRING, description: "Giải thích tại sao ý này đúng/sai" }
                    }
                  },
                  description: "Các ý hỏi phụ (chỉ dành cho true_false, gồm 4 ý a,b,c,d)"
                },
                points: { type: Type.NUMBER, description: "Điểm số (ví dụ: 0.25, 0.5, 1, 2)" },
                explanation: { type: Type.STRING, description: "Giải thích đáp án chung cho câu hỏi" }
              },
              required: ["type", "content", "points"]
            }
          }
        }
      });

      const generatedQuestions: Question[] = parseTruncatedJSON(response.text).map((q: any) => ({
        ...q,
        id: Math.random().toString(36).substr(2, 9),
        points: q.type === 'multiple_choice' ? 0.25 : (q.type === 'true_false' ? 1 : (q.points || 1))
      }));

      setFormData(prev => ({
        ...prev,
        questions: [...(prev.questions || []), ...generatedQuestions]
      }));
      
      setIsAIModalOpen(false);
      setAiPrompt('');
    } catch (error: any) {
      console.error('Lỗi khi tạo câu hỏi:', error);
      let errorString = String(error?.message || '');
      try {
        errorString += ' ' + (typeof error === 'object' ? JSON.stringify(error) : String(error));
      } catch (e) {
        errorString += ' ' + String(error);
      }
      
      if (
        errorString.includes('429') || 
        errorString.includes('RESOURCE_EXHAUSTED') || 
        error?.status === 429 || 
        error?.status === 'RESOURCE_EXHAUSTED' ||
        error?.error?.code === 429 ||
        error?.error?.status === 'RESOURCE_EXHAUSTED'
      ) {
        alert('Hệ thống AI đang quá tải hoặc hết hạn mức sử dụng (Quota Exceeded). Vui lòng thử lại sau ít phút hoặc kiểm tra lại API Key.');
      } else if (
        errorString.includes('500') || 
        errorString.includes('INTERNAL') || 
        error?.status === 500 || 
        error?.status === 'INTERNAL' ||
        error?.error?.code === 500 ||
        error?.error?.status === 'INTERNAL'
      ) {
        alert('Hệ thống AI đang gặp sự cố nội bộ (Internal Error). Vui lòng thử lại sau ít phút.');
      } else {
        alert('Có lỗi xảy ra khi tạo câu hỏi bằng AI. Vui lòng thử lại.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleDownloadExcelSample = () => {
    const ws = utils.aoa_to_sheet([
      ['Loại câu hỏi (multiple_choice, true_false, short_answer, essay)', 'Mức độ (recognition, understanding, application)', 'Nội dung câu hỏi', 'Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D', 'Đáp án đúng', 'Giải thích'],
      ['multiple_choice', 'recognition', 'Thủ đô của Việt Nam là gì?', 'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Hà Nội', 'Hà Nội là thủ đô của nước CHXHCN Việt Nam.'],
      ['true_false', 'understanding', 'Các phát biểu sau về máy tính là đúng hay sai?', 'Máy tính có thể tự suy nghĩ', 'RAM là bộ nhớ tạm thời', 'Ổ cứng lưu trữ dữ liệu vĩnh viễn', 'CPU là bộ não của máy tính', 'Sai, Đúng, Đúng, Đúng', 'Máy tính chỉ thực hiện theo lập trình.'],
      ['short_answer', 'application', '1 + 1 bằng mấy?', '', '', '', '', '2', 'Toán học cơ bản.'],
      ['essay', 'application', 'Hãy viết một đoạn văn ngắn về tầm quan trọng của việc học.', '', '', '', '', 'Học sinh tự viết, giáo viên chấm theo ý.', 'Khuyến khích tư duy tự do.']
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Mau_Cau_Hoi");
    writeFile(wb, "Mau_Nhap_Cau_Hoi.xlsx");
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Vui lòng chọn file Excel');
      return;
    }

    setIsExtracting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = utils.sheet_to_json(ws, { header: 1 });

          const rows = data.slice(1) as any[][];
          
          const newQuestions: Question[] = rows.map((row, index) => {
            const typeRaw = (row[0] || '').toString().trim().toLowerCase();
            const difficultyRaw = (row[1] || '').toString().trim().toLowerCase();
            const content = (row[2] || '').toString().trim();
            const optA = (row[3] || '').toString().trim();
            const optB = (row[4] || '').toString().trim();
            const optC = (row[5] || '').toString().trim();
            const optD = (row[6] || '').toString().trim();
            const correctAnswerRaw = (row[7] || '').toString().trim();
            const explanation = (row[8] || '').toString().trim();

            if (!content) throw new Error(`Dòng ${index + 2}: Thiếu nội dung câu hỏi.`);

            let type = 'multiple_choice';
            if (typeRaw.includes('true_false') || typeRaw.includes('đúng/sai')) type = 'true_false';
            else if (typeRaw.includes('short_answer') || typeRaw.includes('trả lời ngắn')) type = 'short_answer';
            else if (typeRaw.includes('essay') || typeRaw.includes('tự luận')) type = 'essay';

            let difficulty = 'recognition';
            if (difficultyRaw.includes('understanding') || difficultyRaw.includes('thông hiểu')) difficulty = 'understanding';
            else if (difficultyRaw.includes('application') || difficultyRaw.includes('vận dụng')) difficulty = 'application';

            let options: string[] = [];
            let correctAnswer: any = undefined;
            let subQuestions: any[] = [];

            if (type === 'multiple_choice') {
              options = [optA, optB, optC, optD].filter(Boolean);
              if (options.length < 2) throw new Error(`Dòng ${index + 2}: Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn.`);
              
              if (correctAnswerRaw.length === 1 && ['a', 'b', 'c', 'd'].includes(correctAnswerRaw.toLowerCase())) {
                const charCode = correctAnswerRaw.toLowerCase().charCodeAt(0) - 97;
                correctAnswer = options[charCode];
              } else {
                const foundIndex = options.findIndex(opt => opt.toLowerCase() === correctAnswerRaw.toLowerCase());
                if (foundIndex !== -1) {
                  correctAnswer = options[foundIndex];
                } else {
                  correctAnswer = correctAnswerRaw;
                }
              }
            } else if (type === 'true_false') {
              const ansParts = correctAnswerRaw.split(/[,\s;|]+/).map((s: string) => s.trim().toLowerCase());
              const getBool = (val: string) => val === 'đúng' || val === 't' || val === 'true' || val === '1' || val === 'đ' || val === 'yes' || val === 'y';
              
              subQuestions = [
                { id: `sq_${Date.now()}_${index}_1`, content: optA, correctAnswer: getBool(ansParts[0] || ''), difficulty },
                { id: `sq_${Date.now()}_${index}_2`, content: optB, correctAnswer: getBool(ansParts[1] || ''), difficulty },
                { id: `sq_${Date.now()}_${index}_3`, content: optC, correctAnswer: getBool(ansParts[2] || ''), difficulty },
                { id: `sq_${Date.now()}_${index}_4`, content: optD, correctAnswer: getBool(ansParts[3] || ''), difficulty }
              ].filter(sq => sq.content);
              correctAnswer = undefined;
            } else {
              correctAnswer = correctAnswerRaw;
            }

            return {
              id: Math.random().toString(36).substr(2, 9),
              type: type as QuestionType,
              difficulty: difficulty as any,
              content,
              options,
              correctAnswer,
              subQuestions,
              explanation,
              points: type === 'true_false' ? 1 : 0.25
            };
          });

          setFormData(prev => ({
            ...prev,
            questions: [...(prev.questions || []), ...newQuestions]
          }));
          
          setIsExcelImportModalOpen(false);
          setSelectedFile(null);
          alert(`Đã nhập thành công ${newQuestions.length} câu hỏi!`);
        } catch (innerError: any) {
          console.error("Error processing Excel data:", innerError);
          alert(innerError.message || "Có lỗi xảy ra khi xử lý dữ liệu Excel.");
        } finally {
          setIsExtracting(false);
        }
      };
      reader.onerror = () => {
        setIsExtracting(false);
        alert("Không thể đọc file Excel.");
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (error) {
      console.error("Error parsing Excel:", error);
      alert("Có lỗi xảy ra khi đọc file Excel. Vui lòng kiểm tra lại định dạng.");
      setIsExtracting(false);
    }
  };

  const removeQuestion = (index: number) => {
    const newQuestions = [...(formData.questions || [])];
    newQuestions.splice(index, 1);
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateQuestionPoints = (index: number, points: number) => {
    const newQuestions = [...(formData.questions || [])];
    newQuestions[index] = { ...newQuestions[index], points };
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleOpenQuestionModal = (index?: number) => {
    if (index !== undefined && formData.questions) {
      setEditingQuestionIndex(index);
      const q = { ...formData.questions[index] };
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
      setQuestionForm({
        type: 'multiple_choice',
        difficulty: 'recognition',
        content: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        subQuestions: [
          { id: 'a', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'b', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'c', content: '', difficulty: 'recognition', correctAnswer: true },
          { id: 'd', content: '', difficulty: 'recognition', correctAnswer: true }
        ],
        points: 0.25
      });
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const newQuestions = [...(formData.questions || [])];
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
    
    setFormData({ ...formData, questions: newQuestions });
    setIsQuestionModalOpen(false);
  };

  const toggleAssignClass = (classId: string) => {
    const currentIds = formData.assignedTo?.ids || [];
    const newIds = currentIds.includes(classId) 
      ? currentIds.filter(id => id !== classId)
      : [...currentIds, classId];
    
    setFormData({
      ...formData,
      assignedTo: { type: 'class', ids: newIds }
    });
  };

  const toggleAssignGrade = (grade: string) => {
    const currentIds = formData.assignedTo?.ids || [];
    const newIds = currentIds.includes(grade) 
      ? currentIds.filter(id => id !== grade)
      : [...currentIds, grade];
    
    setFormData({
      ...formData,
      assignedTo: { type: 'grade', ids: newIds }
    });
  };

  const filteredTests = tests.filter(t => 
    t.title?.toLowerCase()?.includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Kiểm tra & Đánh giá</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          <span>Tạo đề kiểm tra</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Tìm kiếm bài kiểm tra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-6 text-sm font-semibold text-gray-600">Tên bài kiểm tra</th>
                <th className="py-3 px-6 text-sm font-semibold text-gray-600">Thời gian làm bài</th>
                <th className="py-3 px-6 text-sm font-semibold text-gray-600">Thời hạn</th>
                <th className="py-3 px-6 text-sm font-semibold text-gray-600">Giao cho</th>
                <th className="py-3 px-6 text-sm font-semibold text-gray-600 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.length > 0 ? filteredTests.map(test => (
                <tr key={test.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 font-medium text-gray-900">
                    {test.title}
                    <div className="text-xs text-gray-500 font-normal mt-1">{test.questions.length} câu hỏi</div>
                  </td>
                  <td className="py-4 px-6 text-gray-600">
                    <span className="flex items-center gap-1"><Clock size={16} /> {test.durationMinutes} phút</span>
                  </td>
                  <td className="py-4 px-6 text-gray-600 text-sm">
                    <div>Bắt đầu: {new Date(test.startTime).toLocaleString('vi-VN')}</div>
                    <div className="text-red-600">Kết thúc: {new Date(test.endTime).toLocaleString('vi-VN')}</div>
                  </td>
                  <td className="py-4 px-6 text-gray-600">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Users size={14} /> 
                      {test.assignedTo?.type === 'class' 
                        ? `${test.assignedTo.ids.length} lớp` 
                        : test.assignedTo?.type === 'grade'
                        ? `Khối ${test.assignedTo.ids.join(', ')}`
                        : 'Chưa giao'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => navigate(`/admin/tests/${test.id}/submissions`)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Xem kết quả"
                      >
                        <Users size={18} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(test)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Sửa"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete(test.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">Không tìm thấy bài kiểm tra nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Test Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingTest ? "Sửa bài kiểm tra" : "Tạo bài kiểm tra mới"}
        size="7xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 border-b pb-2">Thông tin chung</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên bài kiểm tra</label>
              <input 
                type="text" 
                required
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="VD: Kiểm tra 1 tiết Học kì 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề (Tùy chọn)</label>
                <select 
                  value={formData.topicId}
                  onChange={e => setFormData({...formData, topicId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- Chọn chủ đề --</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian làm bài (phút)</label>
                <input 
                  type="number" 
                  required
                  min={1}
                  value={formData.durationMinutes}
                  onChange={e => setFormData({...formData, durationMinutes: Number(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian bắt đầu</label>
                <input 
                  type="datetime-local" 
                  required
                  value={formData.startTime}
                  onChange={e => setFormData({...formData, startTime: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian kết thúc</label>
                <input 
                  type="datetime-local" 
                  required
                  value={formData.endTime}
                  onChange={e => setFormData({...formData, endTime: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 border-b pb-2">Giao bài cho</h4>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input 
                  type="radio" 
                  name="assignType" 
                  checked={formData.assignedTo?.type === 'class'}
                  onChange={() => setFormData({...formData, assignedTo: { type: 'class', ids: [] }})}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Theo Lớp</span>
              </label>
              <label className="flex items-center gap-2">
                <input 
                  type="radio" 
                  name="assignType" 
                  checked={formData.assignedTo?.type === 'grade'}
                  onChange={() => setFormData({...formData, assignedTo: { type: 'grade', ids: [] }})}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Theo Khối</span>
              </label>
            </div>

            {formData.assignedTo?.type === 'class' ? (
              <div className="grid grid-cols-3 gap-2">
                {classes.map(c => (
                  <label key={c.id} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input 
                      type="checkbox" 
                      checked={formData.assignedTo?.ids.includes(c.id)}
                      onChange={() => toggleAssignClass(c.id)}
                      className="text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {['6', '7', '8', '9', '10', '11', '12'].map(g => (
                  <label key={g} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input 
                      type="checkbox" 
                      checked={formData.assignedTo?.ids.includes(g)}
                      onChange={() => toggleAssignGrade(g)}
                      className="text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm">Khối {g}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-semibold text-gray-900">Danh sách câu hỏi ({formData.questions?.length || 0})</h4>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setIsBankModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <Search size={16} />
                  Chọn từ ngân hàng
                </button>
                <button 
                  type="button"
                  onClick={() => handleOpenQuestionModal()}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Plus size={16} />
                  Thêm thủ công
                </button>
                <button 
                  type="button"
                  onClick={() => setIsExcelImportModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <FileSpreadsheet size={16} />
                  Nhập từ Excel
                </button>
                <button 
                  type="button"
                  onClick={() => setIsAIModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <Sparkles size={16} />
                  Tạo bằng AI
                </button>
              </div>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {formData.questions?.map((q, index) => (
                <div key={`${q.id || 'q'}-${index}`} className="p-3 border border-gray-200 rounded-xl bg-gray-50 relative group">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      type="button"
                      onClick={() => handleOpenQuestionModal(index)}
                      className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2 text-sm mb-1">
                    <span className="font-medium">Câu {index + 1}:</span>
                    <span className="text-gray-600">
                      {q.type === 'multiple_choice' ? 'Phần I: Trắc nghiệm' : 
                       q.type === 'true_false' ? 'Phần II: Đúng/Sai' : 
                       q.type === 'short_answer' ? 'Phần III: Trả lời ngắn' : 'Phần IV: Tự luận'}
                    </span>
                    {q.difficulty && (
                      <span className="text-gray-500 italic">
                        - {q.difficulty === 'recognition' ? 'Nhận biết' : q.difficulty === 'understanding' ? 'Thông hiểu' : 'Vận dụng'}
                      </span>
                    )}
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
                            onChange={(e) => updateQuestionPoints(index, Number(e.target.value))}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-600">điểm</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div 
                    className="text-gray-900 text-sm mb-2 break-words"
                    dangerouslySetInnerHTML={{ __html: String(q.content || '') }}
                  />
                  {q.type === 'multiple_choice' && (
                    <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                      {ensureArray(q.options).map((opt: string, i: number) => (
                        <li key={i} className={`break-words ${opt === q.correctAnswer ? 'text-emerald-600 font-medium' : ''}`}>
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.type === 'true_false' && (
                    <div className="mt-2 space-y-1">
                      {ensureArray(q.subQuestions).map((sq: any, i: number) => (
                        <div key={i} className="text-sm flex items-start gap-2">
                          <span className="font-medium text-gray-700 shrink-0">{sq.id})</span>
                          <div 
                            className="text-gray-600 flex-1 min-w-0 break-words"
                            dangerouslySetInnerHTML={{ __html: String(sq.content || '') }}
                          />
                          <span className="text-xs text-gray-500 italic shrink-0">
                            ({sq.difficulty === 'recognition' ? 'Nhận biết' : sq.difficulty === 'understanding' ? 'Thông hiểu' : 'Vận dụng'})
                          </span>
                          <span className={`font-medium shrink-0 ${sq.correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}>
                            {sq.correctAnswer ? 'Đúng' : 'Sai'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'short_answer' && (
                    <p className="text-sm text-emerald-600 font-medium mt-1">Đáp án: {q.correctAnswer}</p>
                  )}
                </div>
              ))}
              {(!formData.questions || formData.questions.length === 0) && (
                <p className="text-center text-gray-500 py-4 text-sm">Chưa có câu hỏi nào. Hãy tạo bằng AI.</p>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Lưu đề kiểm tra
            </button>
          </div>
        </form>
      </Modal>

      {/* AI Generate Modal */}
      <Modal 
        isOpen={isAIModalOpen} 
        onClose={() => !isGenerating && setIsAIModalOpen(false)}
        title="Tạo câu hỏi bằng AI"
      >
        <div className="space-y-4">
          <div className="p-4 bg-purple-50 text-purple-800 rounded-xl text-sm flex gap-3 items-start">
            <Sparkles className="shrink-0 mt-0.5" size={18} />
            <p>AI sẽ tự động tạo ngân hàng câu hỏi dựa trên chủ đề bạn nhập. Bạn có thể chỉnh sửa hoặc xóa bớt sau khi tạo.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề / Nội dung kiến thức</label>
            <textarea 
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              rows={3}
              placeholder="VD: Các thành phần cơ bản của máy tính, thiết bị vào ra..."
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 border-b pb-2">Cấu trúc đề</h4>
            
            {[
              { id: 'multiple_choice', label: 'Phần I: Trắc nghiệm nhiều lựa chọn' },
              { id: 'true_false', label: 'Phần II: Đúng/Sai' },
              { id: 'short_answer', label: 'Phần III: Trả lời ngắn' },
              { id: 'essay', label: 'Phần IV: Tự luận' }
            ].map(part => (
              <div key={part.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="font-medium text-sm text-gray-800 mb-2">{part.label}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nhận biết</label>
                    <input 
                      type="number" min={0}
                      value={aiConfig[part.id as QuestionType].recognition}
                      onChange={e => setAiConfig(prev => ({
                        ...prev,
                        [part.id]: { ...prev[part.id as QuestionType], recognition: Number(e.target.value) }
                      }))}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      disabled={isGenerating}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Thông hiểu</label>
                    <input 
                      type="number" min={0}
                      value={aiConfig[part.id as QuestionType].understanding}
                      onChange={e => setAiConfig(prev => ({
                        ...prev,
                        [part.id]: { ...prev[part.id as QuestionType], understanding: Number(e.target.value) }
                      }))}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      disabled={isGenerating}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Vận dụng</label>
                    <input 
                      type="number" min={0}
                      value={aiConfig[part.id as QuestionType].application}
                      onChange={e => setAiConfig(prev => ({
                        ...prev,
                        [part.id]: { ...prev[part.id as QuestionType], application: Number(e.target.value) }
                      }))}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      disabled={isGenerating}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button 
              type="button" 
              onClick={() => setIsAIModalOpen(false)}
              disabled={isGenerating}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button 
              type="button"
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Đang tạo...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Tạo câu hỏi</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Excel Import Modal */}
      <Modal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        title="Nhập câu hỏi từ file Excel"
      >
        <form onSubmit={handleImportExcel} className="space-y-4">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">File Excel (Bắt buộc)</label>
                <button
                  type="button"
                  onClick={handleDownloadExcelSample}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                >
                  <Download size={14} /> Tải file mẫu
                </button>
              </div>
              <div className="p-6 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-emerald-500 transition-colors bg-gray-50">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <div className="text-sm text-gray-600">
                  <label htmlFor="excel-file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-emerald-500">
                    <span>{selectedFile ? selectedFile.name : 'Tải lên file Excel'}</span>
                    <input 
                      id="excel-file-upload" 
                      name="excel-file-upload" 
                      type="file" 
                      className="sr-only" 
                      accept=".xlsx, .xls" 
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      disabled={isExtracting}
                      required 
                    />
                  </label>
                  {!selectedFile && <p className="pl-1">hoặc kéo thả vào đây</p>}
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t">
            <button 
              type="button" 
              onClick={() => setIsExcelImportModalOpen(false)}
              disabled={isExtracting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={isExtracting || !selectedFile}
              className="flex items-center gap-2 px-4 py-2 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Bắt đầu nhập</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Question Modal */}
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
                    points: type === 'true_false' ? 1 : questionForm.points
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="multiple_choice">Trắc nghiệm nhiều lựa chọn</option>
                <option value="true_false">Đúng/Sai</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung câu hỏi (Lệnh dẫn/Ngữ cảnh)</label>
            <div className="bg-white rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
              <QuillEditor 
                value={questionForm.content || ''}
                onChange={content => setQuestionForm({...questionForm, content})}
                className="h-40 mb-12"
                placeholder="Nhập nội dung câu hỏi hoặc lệnh dẫn/ngữ cảnh chung..."
              />
            </div>
          </div>

          {questionForm.type === 'multiple_choice' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Các lựa chọn</label>
              {Array.isArray(questionForm.options) && questionForm.options.map((opt, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input 
                    type="radio" 
                    name="correctAnswer"
                    checked={questionForm.correctAnswer === opt && opt !== ''}
                    onChange={() => setQuestionForm({...questionForm, correctAnswer: opt})}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <input 
                    type="text" 
                    required
                    value={opt}
                    onChange={e => {
                      const newOptions = [...(questionForm.options || [])];
                      newOptions[idx] = e.target.value;
                      setQuestionForm({...questionForm, options: newOptions});
                    }}
                    placeholder={`Lựa chọn ${idx + 1}`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
              <p className="text-xs text-gray-500">Chọn nút radio để đánh dấu đáp án đúng.</p>
            </div>
          )}

          {questionForm.type === 'true_false' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Các ý hỏi (a, b, c, d)</label>
              {(Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? (() => { try { return JSON.parse(questionForm.subQuestions); } catch { return []; } })() : [])).map((sq: any, idx: number) => (
                <div key={`${sq.id || 'sq'}-${idx}`} className="p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-gray-700 w-6 text-center">{sq.id})</span>
                    <div className="flex-1 bg-white rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                      <QuillEditor 
                        value={sq.content || ''}
                        onChange={content => {
                          const currentSubs = Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? JSON.parse(questionForm.subQuestions) : []);
                          const newSubQs = [...currentSubs];
                          if (newSubQs[idx]) {
                            newSubQs[idx] = { ...sq, content };
                            setQuestionForm({...questionForm, subQuestions: newSubQs});
                          }
                        }}
                        className="h-20 mb-10"
                        placeholder={`Nội dung ý ${sq.id}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-6 pl-10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Mức độ:</span>
                      <select 
                        value={sq.difficulty}
                        onChange={e => {
                          const currentSubs = Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? JSON.parse(questionForm.subQuestions) : []);
                          const newSubQs = [...currentSubs];
                          if (newSubQs[idx]) {
                            newSubQs[idx] = { ...sq, difficulty: e.target.value as any };
                            setQuestionForm({...questionForm, subQuestions: newSubQs});
                          }
                        }}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="recognition">Nhận biết</option>
                        <option value="understanding">Thông hiểu</option>
                        <option value="application">Vận dụng</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Đáp án:</span>
                      <label className="flex items-center gap-1 text-sm">
                        <input 
                          type="radio" 
                          name={`tfAnswer-${sq.id}`}
                          checked={sq.correctAnswer === true}
                          onChange={() => {
                            const currentSubs = Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? JSON.parse(questionForm.subQuestions) : []);
                            const newSubQs = [...currentSubs];
                            if (newSubQs[idx]) {
                              newSubQs[idx] = { ...sq, correctAnswer: true };
                              setQuestionForm({...questionForm, subQuestions: newSubQs});
                            }
                          }}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        Đúng
                      </label>
                      <label className="flex items-center gap-1 text-sm">
                        <input 
                          type="radio" 
                          name={`tfAnswer-${sq.id}`}
                          checked={sq.correctAnswer === false}
                          onChange={() => {
                            const currentSubs = Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? JSON.parse(questionForm.subQuestions) : []);
                            const newSubQs = [...currentSubs];
                            if (newSubQs[idx]) {
                              newSubQs[idx] = { ...sq, correctAnswer: false };
                              setQuestionForm({...questionForm, subQuestions: newSubQs});
                            }
                          }}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        Sai
                      </label>
                    </div>
                  </div>
                  <div>
                    <input 
                      type="text"
                      value={sq.explanation || ''}
                      onChange={e => {
                        const newSubQs = [...(questionForm.subQuestions || [])];
                        newSubQs[idx] = { ...sq, explanation: e.target.value };
                        setQuestionForm({...questionForm, subQuestions: newSubQs});
                      }}
                      placeholder="Giải thích tại sao đúng/sai..."
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs mt-2"
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
                value={questionForm.correctAnswer as string || ''}
                onChange={e => setQuestionForm({...questionForm, correctAnswer: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giải thích đáp án</label>
            <textarea 
              value={questionForm.explanation || ''}
              onChange={e => setQuestionForm({...questionForm, explanation: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={2}
              placeholder="Nhập giải thích ngắn gọn cho đáp án..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Điểm số</label>
            <input 
              type="number" 
              required
              min={0}
              step={0.01}
              value={questionForm.type === 'true_false' ? 1 : questionForm.points}
              onChange={e => setQuestionForm({...questionForm, points: Number(e.target.value)})}
              disabled={questionForm.type === 'true_false'}
              className={`w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${questionForm.type === 'true_false' ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
            />
            {questionForm.type === 'true_false' && (
              <p className="text-xs text-amber-600 mt-1">Câu hỏi Đúng/Sai mặc định là 1 điểm (0.1đ/1 ý, 0.25đ/2 ý, 0.5đ/3 ý, 1đ/4 ý).</p>
            )}
          </div>

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

      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Xác nhận xóa"
      >
        <div className="p-4">
          <p className="text-gray-700 mb-6">Bạn có chắc chắn muốn xóa bài kiểm tra này không?</p>
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

      {/* Question Bank Modal */}
      <Modal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        title="Chọn câu hỏi từ ngân hàng"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <select 
              value={bankFilterSubject}
              onChange={(e) => setBankFilterSubject(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả môn học</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select 
              value={bankFilterTopic}
              onChange={(e) => setBankFilterTopic(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả chủ đề</option>
              {topics.filter(t => !bankFilterSubject || t.subjectId === bankFilterSubject).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select 
              value={bankFilterDifficulty}
              onChange={(e) => setBankFilterDifficulty(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả mức độ</option>
              <option value="recognition">Nhận biết</option>
              <option value="understanding">Thông hiểu</option>
              <option value="application">Vận dụng</option>
            </select>
            <select 
              value={bankFilterType}
              onChange={(e) => setBankFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả loại</option>
              <option value="multiple_choice">Trắc nghiệm</option>
              <option value="true_false">Đúng/Sai</option>
              <option value="short_answer">Trả lời ngắn</option>
              <option value="essay">Tự luận</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Tìm kiếm nội dung câu hỏi..."
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-xl">
            {bankQuestions.filter(q => {
              if (bankSearch && !q.content?.toLowerCase()?.includes(bankSearch.toLowerCase())) return false;
              if (bankFilterSubject && q.subjectId !== bankFilterSubject) return false;
              if (bankFilterTopic && q.topicId !== bankFilterTopic) return false;
              if (bankFilterDifficulty && q.difficulty !== bankFilterDifficulty) return false;
              if (bankFilterType && q.type !== bankFilterType) return false;
              return true;
            }).map((q, index) => (
              <label key={`${q.id}-${index}`} className="flex items-start gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={selectedBankQuestions.includes(q.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedBankQuestions([...selectedBankQuestions, q.id]);
                    } else {
                      setSelectedBankQuestions(selectedBankQuestions.filter(id => id !== q.id));
                    }
                  }}
                  className="mt-1 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div 
                      className="text-sm font-medium text-gray-900 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: String(q.content || '') }}
                    />
                    <span className="text-xs font-medium text-indigo-600 whitespace-nowrap ml-2">{q.type === 'true_false' ? 1 : q.points} điểm</span>
                  </div>
                  <div className="flex gap-2 mt-1 text-xs text-gray-500">
                    <span>{q.type === 'multiple_choice' ? 'Trắc nghiệm' : q.type === 'true_false' ? 'Đúng/Sai' : q.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}</span>
                    <span>•</span>
                    <span>{q.difficulty === 'recognition' ? 'Nhận biết' : q.difficulty === 'understanding' ? 'Thông hiểu' : 'Vận dụng'}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="pt-4 flex justify-between items-center border-t">
            <span className="text-sm text-gray-600">Đã chọn: {selectedBankQuestions.length} câu</span>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setIsBankModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
              <button 
                type="button"
                onClick={() => {
                  const selectedQs = bankQuestions.filter(q => selectedBankQuestions.includes(q.id)).map(q => {
                    const { subjectId, topicId, createdAt, ...rest } = q;
                    return {
                      ...rest,
                      points: rest.type === 'multiple_choice' ? 0.25 : (rest.type === 'true_false' ? 1 : (rest.points || 1))
                    } as Question;
                  });
                  setFormData({
                    ...formData,
                    questions: [...(formData.questions || []), ...selectedQs]
                  });
                  setIsBankModalOpen(false);
                  setSelectedBankQuestions([]);
                }}
                disabled={selectedBankQuestions.length === 0}
                className="px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                Thêm vào đề
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
