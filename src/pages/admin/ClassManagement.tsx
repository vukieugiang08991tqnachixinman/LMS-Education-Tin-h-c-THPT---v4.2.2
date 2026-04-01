import React, { useEffect, useState } from 'react';
import { dataProvider } from '../../core/provider';
import { Class } from '../../core/types';
import { Modal } from '../../components/Modal';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';

export const ClassManagement: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    grade: 10,
    teacherName: '',
    academicYear: '2023-2024'
  });

  const fetchData = async () => {
    const data = await dataProvider.getList<Class>('classes');
    setClasses(data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (cls?: Class) => {
    if (cls) {
      setEditingClass(cls);
      setFormData({
        name: cls.name,
        grade: cls.grade,
        teacherName: cls.teacherName || '',
        academicYear: cls.academicYear || ''
      });
    } else {
      setEditingClass(null);
      setFormData({ name: '', grade: 10, teacherName: '', academicYear: '2023-2024' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      teacherId: dataProvider.getCurrentUser()?.id || 't1' // Mock teacher ID
    };

    if (editingClass) {
      await dataProvider.update('classes', editingClass.id, payload);
    } else {
      await dataProvider.create('classes', payload);
    }
    
    setIsModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await dataProvider.delete('classes', confirmDelete);
      setConfirmDelete(null);
      fetchData();
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.teacherName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý Lớp học</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1a7a53] text-white px-5 py-2.5 rounded-xl font-semibold shadow-[0_4px_0_#115e3e] hover:translate-y-[2px] hover:shadow-[0_2px_0_#115e3e] active:translate-y-[4px] active:shadow-[0_0px_0_#115e3e] transition-all"
        >
          <Plus size={20} />
          <span>Thêm lớp học</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Tìm kiếm theo tên lớp, GVCN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-4 sm:px-6 text-sm font-semibold text-gray-600">Tên lớp</th>
                <th className="py-3 px-4 sm:px-6 text-sm font-semibold text-gray-600">Khối</th>
                <th className="py-3 px-4 sm:px-6 text-sm font-semibold text-gray-600">GVCN</th>
                <th className="py-3 px-4 sm:px-6 text-sm font-semibold text-gray-600">Năm học</th>
                <th className="py-3 px-4 sm:px-6 text-sm font-semibold text-gray-600 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.length > 0 ? filteredClasses.map(cls => (
                <tr key={cls.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4 sm:px-6 font-medium text-gray-900">{cls.name}</td>
                  <td className="py-4 px-4 sm:px-6 text-gray-600">{cls.grade}</td>
                  <td className="py-4 px-4 sm:px-6 text-gray-600">{cls.teacherName || '-'}</td>
                  <td className="py-4 px-4 sm:px-6 text-gray-600">{cls.academicYear || '-'}</td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(cls)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Sửa"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete(cls.id)}
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
                  <td colSpan={5} className="py-8 text-center text-gray-500">Không tìm thấy lớp học nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingClass ? "Sửa thông tin lớp học" : "Thêm lớp học mới"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên lớp</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="VD: 10A1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Khối</label>
            <select 
              value={formData.grade}
              onChange={e => setFormData({...formData, grade: Number(e.target.value)})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={10}>Khối 10</option>
              <option value={11}>Khối 11</option>
              <option value={12}>Khối 12</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên GVCN</label>
            <input 
              type="text" 
              required
              value={formData.teacherName}
              onChange={e => setFormData({...formData, teacherName: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="VD: Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Năm học</label>
            <input 
              type="text" 
              required
              value={formData.academicYear}
              onChange={e => setFormData({...formData, academicYear: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="VD: 2023-2024"
            />
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
          <p className="text-gray-700 text-center mb-8 font-medium">Bạn có chắc chắn muốn xóa lớp học này không? Hành động này không thể hoàn tác.</p>
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
