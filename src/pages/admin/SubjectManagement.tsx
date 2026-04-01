import React, { useEffect, useState } from 'react';
import { dataProvider } from '../../core/provider';
import { Subject, Topic, Lesson } from '../../core/types';
import { Modal } from '../../components/Modal';
import { Plus, Search, Edit2, Trash2, ChevronDown, ChevronRight, FileUp, BookOpen, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { parseTruncatedJSON } from '../../utils/jsonUtils';

export const SubjectManagement: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [search, setSearch] = useState('');
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  
  // Modals state
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Edit state
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  
  // Form state
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '' });
  const [topicForm, setTopicForm] = useState({ name: '', order: 1 });

  // PDF Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'subject' | 'topic', id: string } | null>(null);

  const fetchData = async () => {
    const [subData, topData, lesData] = await Promise.all([
      dataProvider.getList<Subject>('subjects'),
      dataProvider.getList<Topic>('topics'),
      dataProvider.getList<Lesson>('lessons')
    ]);
    setSubjects(subData);
    setTopics(topData);
    setLessons(lesData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Subject Handlers ---
  const handleOpenSubjectModal = (subject?: Subject) => {
    if (subject) {
      setEditingSubject(subject);
      setSubjectForm({ name: subject.name, description: subject.description });
    } else {
      setEditingSubject(null);
      setSubjectForm({ name: '', description: '' });
    }
    setIsSubjectModalOpen(true);
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubject) {
      await dataProvider.update('subjects', editingSubject.id, subjectForm);
    } else {
      await dataProvider.create('subjects', subjectForm);
    }
    setIsSubjectModalOpen(false);
    fetchData();
  };

  const handleDeleteSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ type: 'subject', id });
  };

  // --- Topic Handlers ---
  const handleOpenTopicModal = (subjectId: string, topic?: Topic, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSubjectId(subjectId);
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({ name: topic.name, order: topic.order });
    } else {
      setEditingTopic(null);
      const subjectTopics = topics.filter(t => t.subjectId === subjectId);
      const nextOrder = subjectTopics.length > 0 ? Math.max(...subjectTopics.map(t => t.order)) + 1 : 1;
      setTopicForm({ name: '', order: nextOrder });
    }
    setIsTopicModalOpen(true);
  };

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...topicForm, subjectId: selectedSubjectId };
    if (editingTopic) {
      await dataProvider.update('topics', editingTopic.id, payload);
    } else {
      await dataProvider.create('topics', payload);
    }
    setIsTopicModalOpen(false);
    fetchData();
  };

  const handleDeleteTopic = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ type: 'topic', id });
  };

  const confirmDeletion = async () => {
    if (!confirmDelete) return;
    
    try {
      if (confirmDelete.type === 'subject') {
        await dataProvider.delete('subjects', confirmDelete.id);
        const relatedTopics = topics.filter(t => t.subjectId === confirmDelete.id);
        for (const t of relatedTopics) {
          await dataProvider.delete('topics', t.id);
        }
      } else {
        await dataProvider.delete('topics', confirmDelete.id);
      }
      fetchData();
    } catch (error) {
      console.error("Error deleting:", error);
    } finally {
      setConfirmDelete(null);
    }
  };

  // --- Import PDF Handler ---
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleImportPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Vui lòng chọn file PDF');
      return;
    }

    setIsExtracting(true);
    try {
      const base64Data = await readFileAsBase64(selectedFile);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Hãy tìm phần "Mục lục" (Table of Contents) trong file PDF này. 
Trích xuất danh sách các Chương hoặc Chủ đề chính VÀ các Bài học (Lessons) thuộc từng chương/chủ đề đó.
Bỏ qua nội dung chi tiết của sách, chỉ tập trung vào Mục lục để xử lý thật nhanh.
Trả về mảng JSON gồm các object có 'name' (Tên chương/chủ đề), 'order' (số thứ tự tăng dần từ 1) và mảng 'lessons' chứa các bài học (mỗi bài học có 'title' và 'order').`;

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
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Tên chương hoặc chủ đề" },
                order: { type: Type.NUMBER, description: "Thứ tự của chương/chủ đề" },
                lessons: {
                  type: Type.ARRAY,
                  description: "Danh sách các bài học thuộc chương/chủ đề này",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "Tên bài học" },
                      order: { type: Type.NUMBER, description: "Thứ tự của bài học" }
                    },
                    required: ["title", "order"]
                  }
                }
              },
              required: ["name", "order"]
            }
          }
        }
      });

      const extractedTopics = parseTruncatedJSON(response.text);
      
      const existingTopics = topics.filter(t => t.subjectId === selectedSubjectId);
      let startOrder = existingTopics.length > 0 ? Math.max(...existingTopics.map(t => t.order)) : 0;

      const newTopicsPayloads = [];
      const newLessonsPayloads = [];

      for (const t of extractedTopics) {
        startOrder++;
        const topicId = Math.random().toString(36).substr(2, 9);
        newTopicsPayloads.push({
          id: topicId,
          name: t.name, 
          order: startOrder,
          subjectId: selectedSubjectId 
        });

        if (t.lessons && Array.isArray(t.lessons)) {
          let lessonOrder = 0;
          for (const l of t.lessons) {
            lessonOrder++;
            newLessonsPayloads.push({
              id: Math.random().toString(36).substr(2, 9),
              topicId: topicId,
              title: l.title,
              content: 'Nội dung đang được cập nhật...',
              order: lessonOrder,
              status: 'draft',
              grade: '10'
            });
          }
        }
      }
      
      if (dataProvider.createMany) {
        if (newTopicsPayloads.length > 0) {
          await dataProvider.createMany('topics', newTopicsPayloads);
        }
        if (newLessonsPayloads.length > 0) {
          await dataProvider.createMany('lessons', newLessonsPayloads);
        }
      } else {
        // Fallback
        for (const t of newTopicsPayloads) {
          await dataProvider.create('topics', t);
        }
        for (const l of newLessonsPayloads) {
          await dataProvider.create('lessons', l);
        }
      }
      
      setIsImportModalOpen(false);
      setSelectedFile(null);
      fetchData();
      alert('Đã nhập dữ liệu từ PDF thành công!');
    } catch (error) {
      console.error('Lỗi khi trích xuất PDF:', error);
      alert('Có lỗi xảy ra khi đọc file PDF. File có thể quá lớn hoặc không đúng định dạng. Vui lòng thử lại.');
    } finally {
      setIsExtracting(false);
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Môn học & Chủ đề</h2>
        <button 
          onClick={() => handleOpenSubjectModal()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#d97706] text-white px-5 py-2.5 rounded-xl font-semibold shadow-[0_4px_0_#b45309] hover:translate-y-[2px] hover:shadow-[0_2px_0_#b45309] active:translate-y-[4px] active:shadow-[0_0px_0_#b45309] transition-all"
        >
          <Plus size={20} />
          <span>Thêm môn học</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Tìm kiếm môn học..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="p-2 sm:p-4 space-y-4">
          {filteredSubjects.length > 0 ? filteredSubjects.map(subject => {
            const isExpanded = expandedSubject === subject.id;
            const subjectTopics = topics.filter(t => t.subjectId === subject.id).sort((a, b) => a.order - b.order);
            
            return (
              <div key={subject.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Subject Header */}
                <div 
                  className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => setExpandedSubject(isExpanded ? null : subject.id)}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                      <BookOpen size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{subject.name}</h3>
                      <p className="text-xs text-gray-500">{subjectTopics.length} chủ đề</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenSubjectModal(subject); }}
                      className="p-1.5 sm:p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Sửa môn học"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteSubject(subject.id, e)}
                      className="p-1.5 sm:p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Xóa môn học"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Topics List */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 bg-white border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                      <h4 className="font-semibold text-gray-700 text-sm sm:text-base">Danh sách Chủ đề / Chương</h4>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => { setSelectedSubjectId(subject.id); setIsImportModalOpen(true); }}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <FileUp size={14} />
                          Nhập PDF
                        </button>
                        <button 
                          onClick={() => handleOpenTopicModal(subject.id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <Plus size={14} />
                          Thêm chủ đề
                        </button>
                      </div>
                    </div>

                    {subjectTopics.length > 0 ? (
                      <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[400px]">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 w-12 sm:w-16">STT</th>
                              <th className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">Tên chủ đề</th>
                              <th className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 text-right">Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjectTopics.map(topic => {
                              const topicLessons = lessons.filter(l => l.topicId === topic.id);
                              return (
                              <tr key={topic.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600">{topic.order}</td>
                                <td className="py-3 px-2 sm:px-4 font-medium text-gray-900 text-xs sm:text-sm">
                                  {topic.name}
                                  {topicLessons.length > 0 && (
                                    <span className="ml-2 text-[10px] font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                      {topicLessons.length} bài học
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-2 sm:px-4 text-right">
                                  <div className="flex items-center justify-end gap-1 sm:gap-2">
                                    <button 
                                      onClick={() => handleOpenTopicModal(subject.id, topic)}
                                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={(e) => handleDeleteTopic(topic.id, e)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )})}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-4 text-sm">Chưa có chủ đề nào. Hãy thêm mới hoặc nhập từ PDF.</p>
                    )}
                  </div>
                )}
              </div>
            );
          }) : (
            <p className="text-center text-gray-500 py-8">Không tìm thấy môn học nào.</p>
          )}
        </div>
      </div>

      {/* Subject Modal */}
      <Modal 
        isOpen={isSubjectModalOpen} 
        onClose={() => setIsSubjectModalOpen(false)}
        title={editingSubject ? "Sửa môn học" : "Thêm môn học mới"}
      >
        <form onSubmit={handleSubjectSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên môn học</label>
            <input 
              type="text" 
              required
              value={subjectForm.name}
              onChange={e => setSubjectForm({...subjectForm, name: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="VD: Tin học 10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <textarea 
              value={subjectForm.description}
              onChange={e => setSubjectForm({...subjectForm, description: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              placeholder="Mô tả ngắn về môn học..."
            />
          </div>
          <div className="pt-6 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsSubjectModalOpen(false)}
              className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-bold transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit"
              className="px-6 py-2.5 text-white bg-[#2563eb] rounded-xl hover:bg-blue-700 font-bold shadow-[0_4px_0_#1e40af] hover:translate-y-[2px] hover:shadow-[0_2px_0_#1e40af] active:translate-y-[4px] active:shadow-[0_0px_0_#1e40af] transition-all"
            >
              Lưu thông tin
            </button>
          </div>
        </form>
      </Modal>

      {/* Topic Modal */}
      <Modal 
        isOpen={isTopicModalOpen} 
        onClose={() => setIsTopicModalOpen(false)}
        title={editingTopic ? "Sửa chủ đề" : "Thêm chủ đề mới"}
      >
        <form onSubmit={handleTopicSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên chủ đề</label>
            <input 
              type="text" 
              required
              value={topicForm.name}
              onChange={e => setTopicForm({...topicForm, name: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="VD: Chủ đề 1: Máy tính và xã hội tri thức"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thứ tự (STT)</label>
            <input 
              type="number" 
              required
              min={1}
              value={topicForm.order}
              onChange={e => setTopicForm({...topicForm, order: Number(e.target.value)})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsTopicModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Lưu
            </button>
          </div>
        </form>
      </Modal>

      {/* Import PDF Modal */}
      <Modal 
        isOpen={isImportModalOpen} 
        onClose={() => !isExtracting && setIsImportModalOpen(false)}
        title="Nhập dữ liệu từ file PDF"
      >
        <form onSubmit={handleImportPDF} className="space-y-4">
          <div className="p-6 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-indigo-500 transition-colors bg-gray-50">
            <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <div className="text-sm text-gray-600">
              <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                <span>{selectedFile ? selectedFile.name : 'Tải lên file PDF'}</span>
                <input 
                  id="file-upload" 
                  name="file-upload" 
                  type="file" 
                  className="sr-only" 
                  accept=".pdf" 
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  disabled={isExtracting}
                  required 
                />
              </label>
              {!selectedFile && <p className="pl-1">hoặc kéo thả vào đây</p>}
            </div>
            <p className="text-xs text-gray-500 mt-2">Hệ thống sẽ dùng AI để tự động trích xuất các chương/chủ đề từ sách.</p>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsImportModalOpen(false)}
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
                  <span>Đang trích xuất...</span>
                </>
              ) : (
                <span>Bắt đầu trích xuất</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Xác nhận xóa"
      >
        <div className="p-4">
          <p className="text-gray-700 mb-6">
            {confirmDelete?.type === 'subject' 
              ? 'Bạn có chắc chắn muốn xóa môn học này? Các chủ đề con cũng sẽ bị xóa vĩnh viễn.' 
              : 'Bạn có chắc chắn muốn xóa chủ đề này?'}
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={confirmDeletion}
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
