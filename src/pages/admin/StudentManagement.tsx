import React, { useEffect, useState } from 'react';
import { dataProvider } from '../../core/provider';
import { User, Class } from '../../core/types';
import { Modal } from '../../components/Modal';
import { Plus, Search, Edit2, Trash2, Users, ChevronDown } from 'lucide-react';

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // New state for Grade and Class selection
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    dob: '',
    classId: ''
  });

  const fetchData = async () => {
    const [usersData, classesData] = await Promise.all([
      dataProvider.getList<User>('users', { role: 'student' }),
      dataProvider.getList<Class>('classes')
    ]);
    setStudents(usersData);
    setClasses(classesData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (student?: User) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        fullName: student.fullName,
        username: student.username,
        password: student.password || '',
        dob: student.dob || '',
        classId: student.classId || ''
      });
    } else {
      setEditingStudent(null);
      setFormData({ fullName: '', username: '', password: '', dob: '', classId: selectedClassId || classes[0]?.id || '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      role: 'student'
    };

    if (editingStudent) {
      if (!payload.password) {
        delete payload.password;
      }
      await dataProvider.update('users', editingStudent.id, payload);
    } else {
      if (!payload.password) {
        payload.password = '123';
      }
      await dataProvider.create('users', payload);
    }
    
    setIsModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await dataProvider.delete('users', confirmDelete);
      setConfirmDelete(null);
      fetchData();
    }
  };

  const grades = [10, 11, 12];
  
  const classStudents = students.filter(s => String(s.classId) === String(selectedClassId));
  const filteredStudents = classStudents.filter(s => 
    s.fullName?.toLowerCase()?.includes(search.toLowerCase()) ||
    s.username?.toLowerCase()?.includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý Học sinh</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1a7a53] text-white px-5 py-2.5 rounded-xl font-semibold shadow-[0_4px_0_#115e3e] hover:translate-y-[2px] hover:shadow-[0_2px_0_#115e3e] active:translate-y-[4px] active:shadow-[0_0px_0_#115e3e] transition-all"
        >
          <Plus size={20} />
          <span>Thêm học sinh</span>
        </button>
      </div>

      {/* Grade Selection */}
      <div className="grid grid-cols-1 xs:grid-cols-3 gap-4">
        {grades.map(grade => (
          <button
            key={grade}
            onClick={() => {
              setSelectedGrade(grade === selectedGrade ? null : grade);
              setSelectedClassId(null);
              setSearch('');
            }}
            className={`py-4 rounded-2xl font-bold text-lg transition-all border-2 flex items-center justify-center gap-2 ${
              selectedGrade === grade 
                ? 'bg-[#2563eb] text-white border-[#1e40af] shadow-[0_6px_0_#1e40af] translate-y-[2px]' 
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50 shadow-[0_6px_0_#e5e7eb]'
            }`}
          >
            Khối {grade}
            <ChevronDown size={20} className={`transition-transform ${selectedGrade === grade ? 'rotate-180' : ''}`} />
          </button>
        ))}
      </div>

      {/* Class Selection */}
      {selectedGrade && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="text-blue-600" size={24} />
            Chọn lớp thuộc Khối {selectedGrade}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {classes.filter(c => String(c.grade) === String(selectedGrade)).map(cls => (
              <button
                key={cls.id}
                onClick={() => {
                  setSelectedClassId(cls.id === selectedClassId ? null : cls.id);
                  setSearch('');
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                  selectedClassId === cls.id
                    ? 'bg-[#1a7a53] border-[#115e3e] text-white shadow-[0_4px_0_#115e3e] translate-y-[2px]'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50 shadow-[0_4px_0_#e5e7eb]'
                }`}
              >
                <span className="font-black text-xl mb-1">{cls.name}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${selectedClassId === cls.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {students.filter(s => String(s.classId) === String(cls.id)).length} học sinh
                </span>
              </button>
            ))}
            {classes.filter(c => String(c.grade) === String(selectedGrade)).length === 0 && (
              <p className="text-gray-500 col-span-full py-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                Chưa có lớp nào trong khối này.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Student Table */}
      {selectedClassId && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Danh sách học sinh lớp {classes.find(c => String(c.id) === String(selectedClassId))?.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Tổng số: {classStudents.length} học sinh</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Tìm kiếm học sinh..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Họ và tên</th>
                  <th className="py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Tài khoản</th>
                  <th className="py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Mật khẩu</th>
                  <th className="py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider">Ngày sinh</th>
                  <th className="py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? filteredStudents.map(student => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                    <td className="py-4 px-6 font-semibold text-gray-900">{student.fullName}</td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-md border border-gray-200">
                        {student.username}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-md border border-gray-200">
                        {student.password || '******'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-600 font-medium">
                      {student.dob ? new Date(student.dob).toLocaleDateString('vi-VN') : '-'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(student)}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                          title="Sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setConfirmDelete(student.id)}
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                          title="Xóa"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Users size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium text-gray-500">Không tìm thấy học sinh nào</p>
                        {search && <p className="text-sm mt-1">Thử thay đổi từ khóa tìm kiếm</p>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? "Sửa thông tin học sinh" : "Thêm học sinh mới"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Họ và tên</label>
            <input 
              type="text" 
              required
              value={formData.fullName}
              onChange={e => setFormData({...formData, fullName: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              placeholder="VD: Trần Bình An"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Tài khoản đăng nhập</label>
            <input 
              type="text" 
              required
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
              placeholder="VD: hs_an"
              disabled={!!editingStudent}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Mật khẩu</label>
            <input 
              type="text" 
              required={!editingStudent}
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
              placeholder={editingStudent ? "Để trống nếu không muốn đổi mật khẩu" : "Nhập mật khẩu (Mặc định: 123)"}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Ngày sinh</label>
            <input 
              type="date" 
              required
              value={formData.dob}
              onChange={e => setFormData({...formData, dob: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Lớp</label>
            <select 
              value={formData.classId}
              onChange={e => setFormData({...formData, classId: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              required
            >
              <option value="" disabled>Chọn lớp</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Khối {c.grade})</option>
              ))}
            </select>
          </div>
          <div className="pt-6 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
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

      <Modal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Xác nhận xóa"
      >
        <div className="p-2">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={32} />
          </div>
          <p className="text-gray-700 text-center mb-8 font-medium">Bạn có chắc chắn muốn xóa học sinh này không? Hành động này không thể hoàn tác.</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-bold transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleDelete}
              className="px-6 py-2.5 text-white bg-red-600 rounded-xl hover:bg-red-700 font-bold shadow-[0_4px_0_#991b1b] hover:translate-y-[2px] hover:shadow-[0_2px_0_#991b1b] active:translate-y-[4px] active:shadow-[0_0px_0_#991b1b] transition-all"
            >
              Xác nhận xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
