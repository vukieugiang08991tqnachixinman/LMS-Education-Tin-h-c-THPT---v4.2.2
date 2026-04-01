const fs = require('fs');

let amContent = fs.readFileSync('src/pages/admin/AssignmentManagement.tsx', 'utf8');
let lmContent = fs.readFileSync('src/pages/admin/LessonManagement.tsx', 'utf8');

// Get isModalOpen and confirmDelete from AssignmentManagement.tsx
const startModal1 = amContent.indexOf('{/* Modal Thêm/Sửa */}');
const endModal1 = amContent.indexOf('{/* Modal Chấm bài */}');

let modals = '';
if (startModal1 !== -1 && endModal1 !== -1) {
  modals = amContent.substring(startModal1, endModal1);
}

// Append to LessonManagement.tsx
lmContent = lmContent.trim();
if (lmContent.endsWith('<>')) {
  lmContent = lmContent.substring(0, lmContent.length - 2);
}
if (lmContent.endsWith('</>')) {
  lmContent = lmContent.substring(0, lmContent.length - 3);
}

lmContent += `

      ${modals}

      {/* Modal Giao bài tập */}
      <Modal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        title="Giao bài tập cho học sinh"
        size="lg"
      >
        <form onSubmit={handleSubmitAssignment} className="space-y-6">
          <div className="p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Phương thức tạo bài tập</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setAssignmentMode('manual')}
                  className={\`py-2 px-4 rounded-xl border text-sm font-medium transition-colors \${
                    assignmentMode === 'manual' 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }\`}
                >
                  Nhập thủ công
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentMode('ai')}
                  className={\`py-2 px-4 rounded-xl border text-sm font-medium transition-colors \${
                    assignmentMode === 'ai' 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }\`}
                >
                  Tạo bằng AI
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentMode('file')}
                  className={\`py-2 px-4 rounded-xl border text-sm font-medium transition-colors \${
                    assignmentMode === 'file' 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }\`}
                >
                  Tải file lên
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề bài tập</label>
                <input
                  type="text"
                  required
                  value={assignmentFormData.title}
                  onChange={e => setAssignmentFormData({...assignmentFormData, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              {assignmentMode === 'manual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung bài tập</label>
                  <textarea
                    required
                    rows={6}
                    value={assignmentFormData.description}
                    onChange={e => setAssignmentFormData({...assignmentFormData, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                    placeholder="Nhập nội dung bài tập..."
                  />
                </div>
              )}

              {assignmentMode === 'ai' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Tạo bài tập bằng AI</label>
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p className="text-sm text-indigo-800 mb-3">
                      AI sẽ tự động đọc nội dung bài giảng "{selectedLessonForAssignment?.title}" và tạo ra các bài tập phù hợp.
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerateAssignment}
                      disabled={isGeneratingAssignment}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium"
                    >
                      {isGeneratingAssignment ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Đang tạo...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>Tạo bài tập ngay</span>
                        </>
                      )}
                    </button>
                  </div>
                  {assignmentFormData.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung đã tạo (có thể chỉnh sửa)</label>
                      <textarea
                        required
                        rows={6}
                        value={assignmentFormData.description}
                        onChange={e => setAssignmentFormData({...assignmentFormData, description: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {assignmentMode === 'file' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File đính kèm (PDF, Word, Excel...)</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-indigo-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                          <span>Tải file lên</span>
                          <input type="file" className="sr-only" onChange={handleFileChange} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">
                        {selectedFile ? selectedFile.name : 'Chưa chọn file nào'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hạn nộp</label>
                <input
                  type="date"
                  required
                  value={assignmentFormData.dueDate}
                  onChange={e => setAssignmentFormData({...assignmentFormData, dueDate: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
            <button
              type="button"
              onClick={() => setIsAssignmentModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
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

    </div>
  );
};

export default LessonManagement;
`;

fs.writeFileSync('src/pages/admin/LessonManagement.tsx', lmContent);
console.log('Done');
