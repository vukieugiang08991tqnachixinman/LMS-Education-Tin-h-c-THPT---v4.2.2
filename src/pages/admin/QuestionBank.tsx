import React, { useState, useEffect } from 'react';
import { dataProvider } from '../../core/provider';
import { BankQuestion, Subject, Topic, QuestionType, QuestionDifficulty } from '../../core/types';
import { Plus, Edit2, Trash2, Search, Filter, Sparkles, Upload, Loader2, Save, X, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { GoogleGenAI, Type } from '@google/genai';
import { parseTruncatedJSON } from '../../utils/jsonUtils';
import * as XLSX from 'xlsx';
import { QuillEditor } from '../../components/QuillEditor';
import { ensureArray } from '../../core/utils/data';

export const QuestionBank: React.FC = () => {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modals
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isAIGenModalOpen, setIsAIGenModalOpen] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<BankQuestion[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Form states
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState<Partial<BankQuestion>>({
    type: 'multiple_choice',
    difficulty: 'recognition',
    content: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    points: 1,
    subjectId: '',
    topicId: ''
  });

  // AI Gen state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiConfig, setAiConfig] = useState({
    subjectId: '',
    topicId: '',
    count: 5,
    types: { multiple_choice: true, true_false: false, short_answer: false, essay: false },
    difficulties: { recognition: 2, understanding: 2, application: 1 },
    tfSubDifficulties: { recognition: 2, understanding: 1, application: 1 }
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [excelImportConfig, setExcelImportConfig] = useState({ subjectId: '', topicId: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [qData, sData, tData] = await Promise.all([
        dataProvider.getList<BankQuestion>('bank_questions'),
        dataProvider.getList<Subject>('subjects'),
        dataProvider.getList<Topic>('topics')
      ]);
      setQuestions(qData);
      setSubjects(sData);
      setTopics(tData);
    } catch (error) {
      console.error("Error fetching data", error);
    }
  };

  const handleOpenQuestionModal = (question?: BankQuestion) => {
    if (question) {
      setEditingQuestion(question);
      const parsedQuestion = { ...question };
      if (typeof parsedQuestion.options === 'string') {
        try {
          parsedQuestion.options = JSON.parse(parsedQuestion.options);
        } catch (e) {
          parsedQuestion.options = ['', '', '', ''];
        }
      }
      if (typeof parsedQuestion.subQuestions === 'string') {
        try {
          parsedQuestion.subQuestions = JSON.parse(parsedQuestion.subQuestions);
        } catch (e) {
          parsedQuestion.subQuestions = [];
        }
      }
      if (Array.isArray(parsedQuestion.correctAnswer) && parsedQuestion.correctAnswer.length === 0) {
        parsedQuestion.correctAnswer = '';
      }
      if (Array.isArray(parsedQuestion.explanation) && parsedQuestion.explanation.length === 0) {
        parsedQuestion.explanation = '';
      }
      setQuestionForm(parsedQuestion);
    } else {
      setEditingQuestion(null);
      setQuestionForm({
        type: 'multiple_choice',
        difficulty: 'recognition',
        content: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 1,
        subjectId: filterSubject || (subjects.length > 0 ? subjects[0].id : ''),
        topicId: filterTopic || ''
      });
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...questionForm };
      if (payload.type !== 'true_false') {
        payload.correctAnswer = String(payload.correctAnswer || '');
      }
      if (editingQuestion) {
        await dataProvider.update('bank_questions', editingQuestion.id, payload);
      } else {
        await dataProvider.create('bank_questions', { ...payload, createdAt: new Date().toISOString() });
      }
      setIsQuestionModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving question", error);
    }
  };

  const handleDeleteQuestion = async () => {
    if (confirmDelete) {
      try {
        await dataProvider.delete('bank_questions', confirmDelete);
        setConfirmDelete(null);
        setSelectedQuestions(prev => prev.filter(id => id !== confirmDelete));
        fetchData();
      } catch (error) {
        console.error("Error deleting question", error);
      }
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedQuestions(filteredQuestions.map(q => q.id));
    } else {
      setSelectedQuestions([]);
    }
  };

  const handleSelectQuestion = (id: string) => {
    setSelectedQuestions(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedQuestions.map(id => dataProvider.delete('bank_questions', id)));
      setConfirmBulkDelete(false);
      setSelectedQuestions([]);
      fetchData();
    } catch (error) {
      console.error("Error bulk deleting questions", error);
    }
  };

  const handleGenerateQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let parts: any[] = [];
      
      const prompt = `Tạo ${aiConfig.count} câu hỏi kiểm tra về chủ đề: "${aiPrompt}".
      
      BẠN PHẢI TẠO ĐÚNG SỐ LƯỢNG VÀ ĐỘ KHÓ NHƯ YÊU CẦU DƯỚI ĐÂY. KHÔNG ĐƯỢC THIẾU HOẶC THỪA:
      - Nhận biết: ${aiConfig.difficulties.recognition} câu
      - Thông hiểu: ${aiConfig.difficulties.understanding} câu
      - Vận dụng: ${aiConfig.difficulties.application} câu
      
      Các loại câu hỏi cần tạo:
      ${Object.entries(aiConfig.types).filter(([_, v]) => v).map(([k, _]) => `- ${k}`).join('\n')}
      
      ${aiConfig.types.true_false ? `ĐỐI VỚI CÂU HỎI ĐÚNG/SAI (true_false):
      Mỗi câu hỏi Đúng/Sai phải có chính xác các mệnh đề (subQuestions) theo độ khó sau:
      - Nhận biết: ${aiConfig.tfSubDifficulties.recognition} mệnh đề
      - Thông hiểu: ${aiConfig.tfSubDifficulties.understanding} mệnh đề
      - Vận dụng: ${aiConfig.tfSubDifficulties.application} mệnh đề
      Tổng cộng ${aiConfig.tfSubDifficulties.recognition + aiConfig.tfSubDifficulties.understanding + aiConfig.tfSubDifficulties.application} mệnh đề cho mỗi câu hỏi Đúng/Sai.` : ''}
      
      Trả về mảng JSON các câu hỏi. Mỗi câu hỏi có định dạng:
      {
        "id": "tạo_id_ngẫu_nhiên",
        "type": "multiple_choice" | "true_false" | "short_answer" | "essay",
        "difficulty": "recognition" | "understanding" | "application",
        "content": "Nội dung câu hỏi",
        "points": 1,
        "options": ["Lựa chọn 1", "Lựa chọn 2", "Lựa chọn 3", "Lựa chọn 4"], // Chỉ dành cho multiple_choice
        "correctAnswer": "Nội dung chính xác của đáp án đúng (không phải A, B, C, D)", // Dành cho multiple_choice, short_answer, essay (hướng dẫn chấm)
        "subQuestions": [ // Chỉ dành cho true_false
          { "id": "a", "content": "Mệnh đề 1", "correctAnswer": true, "difficulty": "recognition", "explanation": "Giải thích chi tiết" },
          { "id": "b", "content": "Mệnh đề 2", "correctAnswer": false, "difficulty": "understanding", "explanation": "Giải thích chi tiết" }
        ]
      }
      `;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                difficulty: { type: Type.STRING },
                content: { type: Type.STRING },
                points: { type: Type.NUMBER },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                subQuestions: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      content: { type: Type.STRING },
                      correctAnswer: { type: Type.BOOLEAN },
                      difficulty: { type: Type.STRING, description: "Mức độ: 'recognition', 'understanding', 'application'" },
                      explanation: { type: Type.STRING }
                    }
                  } 
                }
              },
              required: ["id", "type", "difficulty", "content", "points"]
            }
          }
        }
      });

      const jsonText = response.text || '[]';
      const generatedQuestions = parseTruncatedJSON(jsonText);
      
      const newQuestionsPayloads = generatedQuestions.map((q: any, index: number) => ({
        ...q,
        id: `bq_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        subQuestions: q.subQuestions?.map((sq: any, sqIdx: number) => ({
          ...sq,
          id: `sq_${Date.now()}_${index}_${sqIdx}_${Math.random().toString(36).substr(2, 9)}`
        })),
        subjectId: aiConfig.subjectId,
        topicId: aiConfig.topicId,
        createdAt: new Date().toISOString()
      }));

      if (dataProvider.createMany && newQuestionsPayloads.length > 0) {
        await dataProvider.createMany('bank_questions', newQuestionsPayloads);
      } else {
        for (const q of newQuestionsPayloads) {
          await dataProvider.create('bank_questions', q);
        }
      }
      
      setIsAIGenModalOpen(false);
      setAiPrompt('');
      fetchData();
      alert(`Đã tạo thành công ${generatedQuestions.length} câu hỏi!`);
    } catch (error) {
      console.error("Error generating questions:", error);
      alert("Có lỗi xảy ra khi tạo câu hỏi. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadExcelTemplate = () => {
    const wsData = [
      ['Loại câu hỏi', 'Mức độ', 'Nội dung câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 'Đáp án đúng', 'Giải thích'],
      ['multiple_choice', 'recognition', 'Thủ đô của Việt Nam là gì?', 'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'A', 'Hà Nội là thủ đô của nước CHXHCN Việt Nam.'],
      ['trắc nghiệm', 'nhận biết', '2 + 2 bằng mấy?', '3', '4', '5', '6', 'B', 'Phép cộng cơ bản'],
      ['true_false', 'understanding', 'Chọn đúng sai cho các mệnh đề sau về máy tính:', 'RAM là bộ nhớ trong', 'ROM là bộ nhớ ngoài', 'CPU là bộ xử lý trung tâm', 'Bàn phím là thiết bị ra', 'Đúng, Sai, Đúng, Sai', 'RAM là bộ nhớ trong, ROM là bộ nhớ trong, CPU là bộ xử lý trung tâm, Bàn phím là thiết bị vào.'],
      ['đúng/sai', 'thông hiểu', 'Các khẳng định sau đúng hay sai?', 'Trái đất hình vuông', 'Mặt trời mọc ở hướng Đông', 'Nước sôi ở 100 độ C', 'Con người có 3 lá phổi', 'Sai, Đúng, Đúng, Sai', 'Kiến thức cơ bản'],
      ['short_answer', 'application', 'Tính 2 + 2 = ?', '', '', '', '', '4', 'Phép cộng cơ bản'],
      ['trả lời ngắn', 'vận dụng', 'Đơn vị của lực là gì?', '', '', '', '', 'Newton', 'Vật lý'],
      ['essay', 'application', 'Hãy viết một đoạn văn ngắn về mùa xuân.', '', '', '', '', 'Học sinh tự viết', 'Chấm theo ý'],
      ['tự luận', 'vận dụng', 'Trình bày cảm nhận của em về bài thơ Sóng.', '', '', '', '', 'Học sinh tự viết', 'Ngữ văn']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Add comments/instructions
    ws['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Mau_Nhap_Cau_Hoi.xlsx');
  };

  const handleExcelImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsExtracting(true);
    try {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const dataBuffer = evt.target?.result;
          if (!dataBuffer) throw new Error("Không thể đọc nội dung file");
          
          const wb = XLSX.read(dataBuffer, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          console.log("Excel data raw:", data);

          if (!data || data.length <= 1) {
            throw new Error("File Excel trống hoặc chỉ có tiêu đề");
          }
          
          // Skip header row
          const rows = data.slice(1).filter(row => row && row.length > 0 && row[2]); // Must have content in column 3
          
          if (rows.length === 0) {
            throw new Error("Không tìm thấy dữ liệu câu hỏi hợp lệ trong file Excel");
          }

          const newQuestionsPayloads: BankQuestion[] = rows.map((row, index) => {
            const rawType = String(row[0] || '').toLowerCase().trim();
            const rawDifficulty = String(row[1] || '').toLowerCase().trim();
            
            const typeMap: Record<string, QuestionType> = {
              'trắc nghiệm': 'multiple_choice',
              'multiple_choice': 'multiple_choice',
              'đúng/sai': 'true_false',
              'true_false': 'true_false',
              'trả lời ngắn': 'short_answer',
              'short_answer': 'short_answer',
              'tự luận': 'essay',
              'essay': 'essay'
            };

            const difficultyMap: Record<string, QuestionDifficulty> = {
              'nhận biết': 'recognition',
              'recognition': 'recognition',
              'thông hiểu': 'understanding',
              'understanding': 'understanding',
              'vận dụng': 'application',
              'application': 'application'
            };

            const type = typeMap[rawType] || 'multiple_choice';
            const difficulty = difficultyMap[rawDifficulty] || 'recognition';
            const content = String(row[2] || '').trim();
            const optA = String(row[3] || '').trim();
            const optB = String(row[4] || '').trim();
            const optC = String(row[5] || '').trim();
            const optD = String(row[6] || '').trim();
            const correctAnswerRaw = String(row[7] || '').trim();
            const explanation = String(row[8] || '').trim();

            const qId = `bq_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;

            let options: string[] | undefined = undefined;
            let correctAnswer: any = correctAnswerRaw;
            let subQuestions: any[] | undefined = undefined;

            if (type === 'multiple_choice') {
              options = [optA, optB, optC, optD].filter(Boolean);
              const ansLetter = correctAnswerRaw.toUpperCase();
              const ansIndex = ansLetter === 'A' ? 0 : ansLetter === 'B' ? 1 : ansLetter === 'C' ? 2 : ansLetter === 'D' ? 3 : -1;
              
              if (ansIndex !== -1 && options[ansIndex]) {
                correctAnswer = options[ansIndex];
              } else {
                // If not A,B,C,D, try to match the text directly
                const foundIndex = options.findIndex(opt => opt.toLowerCase() === correctAnswerRaw.toLowerCase());
                if (foundIndex !== -1) {
                  correctAnswer = options[foundIndex];
                } else {
                  correctAnswer = correctAnswerRaw;
                }
              }
            } else if (type === 'true_false') {
              // Parse true/false answers like "Đúng, Sai, Đúng, Sai" or "T, F, T, F" or "1, 0, 1, 0"
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
              id: qId,
              type: type as QuestionType,
              difficulty: difficulty as QuestionDifficulty,
              content,
              options,
              correctAnswer,
              subQuestions,
              explanation,
              subjectId: excelImportConfig.subjectId,
              topicId: excelImportConfig.topicId,
              createdAt: new Date().toISOString(),
              points: 1
            };
          });

          setPreviewQuestions(newQuestionsPayloads);
          setIsExcelImportModalOpen(false);
          setIsPreviewModalOpen(true);
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

  const handleSavePreviewQuestions = async () => {
    setIsExtracting(true);
    try {
      if (dataProvider.createMany && previewQuestions.length > 0) {
        await dataProvider.createMany('bank_questions', previewQuestions);
      } else {
        for (const q of previewQuestions) {
          await dataProvider.create('bank_questions', q);
        }
      }
      setIsPreviewModalOpen(false);
      setPreviewQuestions([]);
      setSelectedFile(null);
      fetchData();
      alert(`Đã lưu thành công ${previewQuestions.length} câu hỏi!`);
    } catch (error) {
      console.error("Error saving preview questions:", error);
      alert("Có lỗi xảy ra khi lưu. Vui lòng thử lại.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePreviewChange = (index: number, field: keyof BankQuestion, value: any) => {
    const newQuestions = [...previewQuestions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setPreviewQuestions(newQuestions);
  };

  const handlePreviewOptionChange = (qIndex: number, optIndex: number, value: string) => {
    const newQuestions = [...previewQuestions];
    let currentOptions = newQuestions[qIndex].options;
    if (typeof currentOptions === 'string') {
      try {
        currentOptions = JSON.parse(currentOptions);
      } catch (e) {
        currentOptions = [];
      }
    }
    const options = [...(Array.isArray(currentOptions) ? currentOptions : [])];
    const oldOpt = options[optIndex];
    options[optIndex] = value;
    
    let correctAnswer = newQuestions[qIndex].correctAnswer;
    if (correctAnswer === oldOpt) {
      correctAnswer = value;
    }
    
    newQuestions[qIndex] = { ...newQuestions[qIndex], options, correctAnswer };
    setPreviewQuestions(newQuestions);
  };

  const handlePreviewSubQuestionChange = (qIndex: number, sqIndex: number, field: string, value: any) => {
    const newQuestions = [...previewQuestions];
    let currentSubQuestions = newQuestions[qIndex].subQuestions;
    if (typeof currentSubQuestions === 'string') {
      try {
        currentSubQuestions = JSON.parse(currentSubQuestions);
      } catch (e) {
        currentSubQuestions = [];
      }
    }
    const subQuestions = [...(Array.isArray(currentSubQuestions) ? currentSubQuestions : [])];
    subQuestions[sqIndex] = { ...subQuestions[sqIndex], [field]: value };
    newQuestions[qIndex] = { ...newQuestions[qIndex], subQuestions };
    setPreviewQuestions(newQuestions);
  };

  const handleRemovePreviewQuestion = (index: number) => {
    const newQuestions = [...previewQuestions];
    newQuestions.splice(index, 1);
    setPreviewQuestions(newQuestions);
  };

  const filteredQuestions = questions.filter(q => {
    if (search && !q.content?.toLowerCase()?.includes(search.toLowerCase())) return false;
    if (filterSubject && q.subjectId !== filterSubject) return false;
    if (filterTopic && q.topicId !== filterTopic) return false;
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
    if (filterType && q.type !== filterType) return false;
    return true;
  });

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ngân hàng câu hỏi</h2>
          <p className="text-gray-500">Quản lý kho câu hỏi trắc nghiệm và tự luận</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsExcelImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors font-medium"
          >
            <FileSpreadsheet size={20} /> Nhập từ Excel
          </button>
          <button 
            onClick={() => setIsAIGenModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors font-medium"
          >
            <Sparkles size={20} /> Tạo bằng AI
          </button>
          <button 
            onClick={() => handleOpenQuestionModal()}
            className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            <Plus size={20} /> Thêm câu hỏi
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-6 gap-4">
        {selectedQuestions.length > 0 && (
          <div className="col-span-1 md:col-span-6 flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-2">
            <span className="text-sm font-medium text-indigo-800">
              Đã chọn {selectedQuestions.length} câu hỏi
            </span>
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Xóa đã chọn
            </button>
          </div>
        )}
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Tìm kiếm nội dung câu hỏi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select 
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả môn học</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select 
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả chủ đề</option>
          {topics.filter(t => !filterSubject || t.subjectId === filterSubject).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select 
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả mức độ</option>
          <option value="recognition">Nhận biết</option>
          <option value="understanding">Thông hiểu</option>
          <option value="application">Vận dụng</option>
        </select>
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả loại</option>
          <option value="multiple_choice">Trắc nghiệm</option>
          <option value="true_false">Đúng/Sai</option>
          <option value="short_answer">Trả lời ngắn</option>
          <option value="essay">Tự luận</option>
        </select>
      </div>

      {/* Questions List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 text-sm font-semibold text-gray-600 w-10 text-center">
                <input
                  type="checkbox"
                  checked={filteredQuestions.length > 0 && selectedQuestions.length === filteredQuestions.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
              </th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600 w-16">ID</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600">Nội dung</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600 w-28">Loại</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600 w-28">Mức độ</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600 w-24 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuestions.length > 0 ? filteredQuestions.map((q, index) => (
              <tr key={`${q.id}-${index}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedQuestions.includes(q.id) ? 'bg-indigo-50/30' : ''}`}>
                <td className="py-3 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.includes(q.id)}
                    onChange={() => handleSelectQuestion(q.id)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                </td>
                <td className="py-3 px-4 text-xs text-gray-500">...{String(q.id || '').slice(-4)}</td>
                <td className="py-3 px-4">
                  <div 
                    className="font-medium text-gray-900 line-clamp-1 text-sm"
                    dangerouslySetInnerHTML={{ __html: String(q.content || '') }}
                  />
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {subjects.find(s => s.id === q.subjectId)?.name || 'N/A'} 
                    {q.topicId && ` - ${topics.find(t => t.id === q.topicId)?.name || 'N/A'}`}
                  </div>
                </td>
                <td className="py-3 px-4 text-xs">
                  {q.type === 'multiple_choice' ? 'Trắc nghiệm' : q.type === 'true_false' ? 'Đúng/Sai' : q.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    q.difficulty === 'recognition' ? 'bg-blue-100 text-blue-800' :
                    q.difficulty === 'understanding' ? 'bg-amber-100 text-amber-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {q.difficulty === 'recognition' ? 'Nhận biết' : q.difficulty === 'understanding' ? 'Thông hiểu' : 'Vận dụng'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button 
                      onClick={() => handleOpenQuestionModal(q)}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setConfirmDelete(q.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">Không tìm thấy câu hỏi nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Question Modal */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        title={editingQuestion ? "Sửa câu hỏi" : "Thêm câu hỏi mới"}
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
              <select 
                required
                value={questionForm.subjectId}
                onChange={e => setQuestionForm({...questionForm, subjectId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Chọn môn học</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
              <select 
                value={questionForm.topicId}
                onChange={e => setQuestionForm({...questionForm, topicId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Chọn chủ đề</option>
                {topics.filter(t => !questionForm.subjectId || t.subjectId === questionForm.subjectId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loại câu hỏi</label>
              <select 
                value={questionForm.type}
                onChange={e => setQuestionForm({...questionForm, type: e.target.value as QuestionType})}
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
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <input 
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOptions = [...(questionForm.options || [])];
                      newOptions[idx] = e.target.value;
                      setQuestionForm({...questionForm, options: newOptions});
                      if (questionForm.correctAnswer === opt) {
                        setQuestionForm({...questionForm, options: newOptions, correctAnswer: e.target.value});
                      }
                    }}
                    placeholder={`Lựa chọn ${idx + 1}`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      const newOptions = [...(questionForm.options || [])];
                      newOptions.splice(idx, 1);
                      setQuestionForm({...questionForm, options: newOptions});
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <button 
                type="button"
                onClick={() => setQuestionForm({...questionForm, options: [...(questionForm.options || []), '']})}
                className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
              >
                + Thêm lựa chọn
              </button>
            </div>
          )}

          {questionForm.type === 'true_false' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Các mệnh đề</label>
              {ensureArray(questionForm.subQuestions).map((sq: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl">
                  <span className="font-bold w-6">{sq?.id || (idx + 1)})</span>
                  <div className="flex-1 bg-white rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                    <QuillEditor 
                      value={sq?.content || ''}
                      onChange={content => {
                        const currentSubs = ensureArray(questionForm.subQuestions);
                        const newSubs = [...currentSubs];
                        if (newSubs[idx]) {
                          newSubs[idx] = { ...newSubs[idx], content };
                          setQuestionForm({...questionForm, subQuestions: newSubs});
                        }
                      }}
                      className="h-20 mb-10"
                      placeholder={`Mệnh đề ${idx + 1}`}
                    />
                  </div>
                  <select
                    value={sq?.correctAnswer ? 'true' : 'false'}
                    onChange={(e) => {
                      const currentSubs = ensureArray(questionForm.subQuestions);
                      const newSubs = [...currentSubs];
                      if (newSubs[idx]) {
                        newSubs[idx] = { ...newSubs[idx], correctAnswer: e.target.value === 'true' };
                        setQuestionForm({...questionForm, subQuestions: newSubs});
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="true">Đúng</option>
                    <option value="false">Sai</option>
                  </select>
                  <input 
                    type="text"
                    value={sq.explanation || ''}
                    onChange={(e) => {
                      const currentSubs = Array.isArray(questionForm.subQuestions) ? questionForm.subQuestions : (typeof questionForm.subQuestions === 'string' ? JSON.parse(questionForm.subQuestions) : []);
                      const newSubs = [...currentSubs];
                      if (newSubs[idx]) {
                        newSubs[idx] = { ...newSubs[idx], explanation: e.target.value };
                        setQuestionForm({...questionForm, subQuestions: newSubs});
                      }
                    }}
                    placeholder="Giải thích..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      const newSubs = [...(questionForm.subQuestions || [])];
                      newSubs.splice(idx, 1);
                      setQuestionForm({...questionForm, subQuestions: newSubs});
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <button 
                type="button"
                onClick={() => setQuestionForm({
                  ...questionForm, 
                  subQuestions: [...(questionForm.subQuestions || []), { id: String.fromCharCode(97 + (questionForm.subQuestions?.length || 0)), content: '', difficulty: 'recognition', correctAnswer: true }]
                })}
                className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
              >
                + Thêm mệnh đề
              </button>
            </div>
          )}

          {questionForm.type === 'short_answer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đáp án đúng</label>
              <input 
                type="text"
                value={questionForm.correctAnswer as string || ''}
                onChange={e => setQuestionForm({...questionForm, correctAnswer: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nhập đáp án đúng..."
              />
            </div>
          )}

          {questionForm.type === 'essay' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hướng dẫn chấm</label>
              <div className="bg-white rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                <QuillEditor 
                  value={questionForm.correctAnswer as string || ''}
                  onChange={content => setQuestionForm({...questionForm, correctAnswer: content})}
                  className="h-32 mb-12"
                  placeholder="Nhập hướng dẫn chấm điểm..."
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giải thích đáp án</label>
            <div className="bg-white rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
              <QuillEditor 
                value={questionForm.explanation || ''}
                onChange={content => setQuestionForm({...questionForm, explanation: content})}
                className="h-32 mb-12"
                placeholder="Nhập giải thích chi tiết cho đáp án..."
              />
            </div>
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

      {/* AI Generate Modal */}
      <Modal
        isOpen={isAIGenModalOpen}
        onClose={() => setIsAIGenModalOpen(false)}
        title="Tạo câu hỏi bằng AI"
      >
        <form onSubmit={handleGenerateQuestions} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
              <select 
                required
                value={aiConfig.subjectId}
                onChange={e => setAiConfig({...aiConfig, subjectId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Chọn môn học</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
              <select 
                value={aiConfig.topicId}
                onChange={e => setAiConfig({...aiConfig, topicId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Chọn chủ đề</option>
                {topics.filter(t => !aiConfig.subjectId || t.subjectId === aiConfig.subjectId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề / Yêu cầu bổ sung</label>
            <textarea 
              required
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="VD: Các thành phần cơ bản của máy tính, hệ điều hành Windows..."
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Loại câu hỏi</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={aiConfig.types.multiple_choice} onChange={e => setAiConfig({...aiConfig, types: {...aiConfig.types, multiple_choice: e.target.checked}})} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm">Trắc nghiệm nhiều lựa chọn</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={aiConfig.types.true_false} onChange={e => setAiConfig({...aiConfig, types: {...aiConfig.types, true_false: e.target.checked}})} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm">Đúng/Sai</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={aiConfig.types.short_answer} onChange={e => setAiConfig({...aiConfig, types: {...aiConfig.types, short_answer: e.target.checked}})} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm">Trả lời ngắn</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={aiConfig.types.essay} onChange={e => setAiConfig({...aiConfig, types: {...aiConfig.types, essay: e.target.checked}})} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm">Tự luận</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Số lượng theo mức độ</label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Nhận biết:</span>
                  <input type="number" min="0" value={aiConfig.difficulties.recognition} onChange={e => setAiConfig({...aiConfig, difficulties: {...aiConfig.difficulties, recognition: parseInt(e.target.value) || 0}})} className="w-16 px-2 py-1 border rounded-lg text-center" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Thông hiểu:</span>
                  <input type="number" min="0" value={aiConfig.difficulties.understanding} onChange={e => setAiConfig({...aiConfig, difficulties: {...aiConfig.difficulties, understanding: parseInt(e.target.value) || 0}})} className="w-16 px-2 py-1 border rounded-lg text-center" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Vận dụng:</span>
                  <input type="number" min="0" value={aiConfig.difficulties.application} onChange={e => setAiConfig({...aiConfig, difficulties: {...aiConfig.difficulties, application: parseInt(e.target.value) || 0}})} className="w-16 px-2 py-1 border rounded-lg text-center" />
                </div>
              </div>
              
              {aiConfig.types.true_false && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Số lượng mệnh đề (Đúng/Sai)</label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Nhận biết:</span>
                      <input type="number" min="0" value={aiConfig.tfSubDifficulties.recognition} onChange={e => setAiConfig({...aiConfig, tfSubDifficulties: {...aiConfig.tfSubDifficulties, recognition: parseInt(e.target.value) || 0}})} className="w-16 px-2 py-1 border rounded-lg text-center" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Thông hiểu:</span>
                      <input type="number" min="0" value={aiConfig.tfSubDifficulties.understanding} onChange={e => setAiConfig({...aiConfig, tfSubDifficulties: {...aiConfig.tfSubDifficulties, understanding: parseInt(e.target.value) || 0}})} className="w-16 px-2 py-1 border rounded-lg text-center" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Vận dụng:</span>
                      <input type="number" min="0" value={aiConfig.tfSubDifficulties.application} onChange={e => setAiConfig({...aiConfig, tfSubDifficulties: {...aiConfig.tfSubDifficulties, application: parseInt(e.target.value) || 0}})} className="w-16 px-2 py-1 border rounded-lg text-center" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button 
              type="button" 
              onClick={() => setIsAIGenModalOpen(false)}
              disabled={isGenerating}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={isGenerating || !aiPrompt || !aiConfig.subjectId}
              className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
        </form>
      </Modal>

      {/* Excel Import Modal */}
      <Modal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        title="Nhập câu hỏi từ file Excel"
      >
        <form onSubmit={handleExcelImport} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
              <select 
                required
                value={excelImportConfig.subjectId}
                onChange={e => setExcelImportConfig({...excelImportConfig, subjectId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Chọn môn học</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
              <select 
                value={excelImportConfig.topicId}
                onChange={e => setExcelImportConfig({...excelImportConfig, topicId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Chọn chủ đề</option>
                {topics.filter(t => !excelImportConfig.subjectId || t.subjectId === excelImportConfig.subjectId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">File Excel (Bắt buộc)</label>
                <button 
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium"
                >
                  <Download size={14} /> Tải file mẫu
                </button>
              </div>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:bg-gray-50 transition-colors">
                <div className="space-y-1 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label htmlFor="excel-file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-emerald-500">
                      <span>{selectedFile ? selectedFile.name : 'Tải lên file Excel (.xlsx)'}</span>
                      <input 
                        id="excel-file-upload" 
                        name="excel-file-upload" 
                        type="file" 
                        className="sr-only" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        disabled={isExtracting}
                      />
                    </label>
                    {!selectedFile && <p className="pl-1">hoặc kéo thả vào đây</p>}
                  </div>
                  <p className="text-xs text-gray-500">Hỗ trợ file .xlsx, .xls, .csv</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
            <h4 className="text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1">
              <FileText size={14} /> Hướng dẫn:
            </h4>
            <ul className="text-[10px] text-emerald-700 space-y-1 list-disc pl-4">
              <li>Tải file mẫu về và điền dữ liệu theo đúng định dạng các cột.</li>
              <li>Không thay đổi tên cột ở dòng đầu tiên.</li>
              <li>Hệ thống sẽ đọc và chuyển đổi dữ liệu với độ chính xác 100%.</li>
            </ul>
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
              disabled={isExtracting || !selectedFile || !excelImportConfig.subjectId}
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

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Xem trước và chỉnh sửa câu hỏi"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {previewQuestions.map((q, qIndex) => (
            <div key={`${q.id}-${qIndex}`} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
              <button
                onClick={() => handleRemovePreviewQuestion(qIndex)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-lg"
                title="Xóa câu hỏi này"
              >
                <Trash2 size={16} />
              </button>
              
              <div className="grid grid-cols-2 gap-4 mb-4 pr-10">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Loại câu hỏi</label>
                  <select
                    value={q.type}
                    onChange={(e) => handlePreviewChange(qIndex, 'type', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="multiple_choice">Trắc nghiệm nhiều lựa chọn</option>
                    <option value="true_false">Đúng/Sai</option>
                    <option value="short_answer">Trả lời ngắn</option>
                    <option value="essay">Tự luận</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mức độ</label>
                  <select
                    value={q.difficulty}
                    onChange={(e) => handlePreviewChange(qIndex, 'difficulty', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="recognition">Nhận biết</option>
                    <option value="understanding">Thông hiểu</option>
                    <option value="application">Vận dụng</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nội dung câu hỏi</label>
                <div className="bg-white rounded-lg overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500">
                  <QuillEditor 
                    value={q.content || ''}
                    onChange={(content) => handlePreviewChange(qIndex, 'content', content)}
                    className="h-32 mb-12"
                  />
                </div>
              </div>

              {q.type === 'multiple_choice' && (
                <div className="space-y-2 mb-4">
                  <label className="block text-xs font-medium text-gray-700">Các lựa chọn & Đáp án đúng</label>
                  {ensureArray(q.options).map((opt: string, optIndex: number) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctAnswer === opt && opt !== ''}
                        onChange={() => handlePreviewChange(qIndex, 'correctAnswer', opt)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="text-sm font-medium w-6">{String.fromCharCode(65 + optIndex)}.</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handlePreviewOptionChange(qIndex, optIndex, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'true_false' && (
                <div className="space-y-3 mb-4">
                  <label className="block text-xs font-medium text-gray-700">Các mệnh đề Đúng/Sai</label>
                  {ensureArray(q.subQuestions).map((sq: any, sqIndex: number) => (
                    <div key={sqIndex} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-6">{String.fromCharCode(97 + sqIndex)})</span>
                          <div className="flex-1 bg-white rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500">
                            <QuillEditor 
                              value={sq.content || ''}
                              onChange={content => handlePreviewSubQuestionChange(qIndex, sqIndex, 'content', content)}
                              className="h-20 mb-10"
                              placeholder={`Nội dung ý ${sq.id}`}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 pl-8">
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name={`tf-${qIndex}-${sqIndex}`}
                              checked={sq.correctAnswer === true}
                              onChange={() => handlePreviewSubQuestionChange(qIndex, sqIndex, 'correctAnswer', true)}
                              className="w-3.5 h-3.5 text-emerald-600"
                            />
                            Đúng
                          </label>
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name={`tf-${qIndex}-${sqIndex}`}
                              checked={sq.correctAnswer === false}
                              onChange={() => handlePreviewSubQuestionChange(qIndex, sqIndex, 'correctAnswer', false)}
                              className="w-3.5 h-3.5 text-red-600"
                            />
                            Sai
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'short_answer' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Đáp án đúng</label>
                  <input
                    type="text"
                    value={q.correctAnswer}
                    onChange={(e) => handlePreviewChange(qIndex, 'correctAnswer', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {q.type === 'essay' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hướng dẫn chấm</label>
                  <div className="bg-white rounded-lg overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500">
                    <QuillEditor 
                      value={q.correctAnswer || ''}
                      onChange={content => handlePreviewChange(qIndex, 'correctAnswer', content)}
                      className="h-32 mb-12"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Giải thích (Tùy chọn)</label>
                <div className="bg-white rounded-lg overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500">
                  <QuillEditor 
                    value={q.explanation || ''}
                    onChange={content => handlePreviewChange(qIndex, 'explanation', content)}
                    className="h-32 mb-12"
                  />
                </div>
              </div>
            </div>
          ))}
          
          {previewQuestions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Không có câu hỏi nào để hiển thị.
            </div>
          )}
        </div>

        <div className="pt-4 mt-4 flex justify-between items-center border-t">
          <span className="text-sm font-medium text-gray-600">Tổng số: {previewQuestions.length} câu hỏi</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(false)}
              disabled={isExtracting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSavePreviewQuestions}
              disabled={isExtracting || previewQuestions.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>Lưu vào ngân hàng</span>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Xác nhận xóa hàng loạt */}
      <Modal
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        title="Xác nhận xóa hàng loạt"
      >
        <div className="p-4">
          <p className="text-gray-700 mb-6">Bạn có chắc chắn muốn xóa {selectedQuestions.length} câu hỏi đã chọn không?</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmBulkDelete(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
            >
              Xóa tất cả
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Xác nhận xóa */}
      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Xác nhận xóa"
      >
        <div className="p-4">
          <p className="text-gray-700 mb-6">Bạn có chắc chắn muốn xóa câu hỏi này không?</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleDeleteQuestion}
              className="px-4 py-2 text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
            >
              Xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
