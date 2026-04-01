import React, { useEffect, useState } from 'react';
import { dataProvider } from '../../core/provider';
import { Announcement, Class } from '../../core/types';
import { Modal } from '../../components/Modal';
import { Plus, Trash2, Bell, Send } from 'lucide-react';

export const Announcements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target: 'all'
  });

  const fetchData = async () => {
    const [annData, clsData] = await Promise.all([
      dataProvider.getList<Announcement>('announcements'),
      dataProvider.getList<Class>('classes')
    ]);
    setAnnouncements(annData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setClasses(clsData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = dataProvider.getCurrentUser();
    if (!currentUser) return;

    const payload = {
      ...formData,
      createdAt: new Date().toISOString(),
      authorId: currentUser.id
    };

    await dataProvider.create('announcements', payload);
    setIsModalOpen(false);
    setFormData({ title: '', content: '', target: 'all' });
    fetchData();
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await dataProvider.delete('announcements', confirmDelete);
      setConfirmDelete(null);
      fetchData();
    }
  };

  const getTargetLabel = (target: string) => {
    if (target === 'all') return 'Tất cả';
    if (target === 'students') return 'Tất cả học sinh';
    const cls = classes.find(c => c.id === target);
    return cls ? `Lớp ${cls.name}` : target;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell className="text-pink-600" size={24} />
          Quản lý Thông báo
        </h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#db2777] text-white px-5 py-2.5 rounded-xl font-semibold shadow-[0_4px_0_#9d174d] hover:translate-y-[2px] hover:shadow-[0_2px_0_#9d174d] active:translate-y-[4px] active:shadow-[0_0px_0_#9d174d] transition-all"
        >
          <Plus size={20} />
          <span>Tạo thông báo</span>
        </button>
      </div>

      <div className="grid gap-4">
        {announcements.length > 0 ? announcements.map(ann => (
          <div key={ann.id} className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">{ann.title}</h3>
                <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-pink-100 text-pink-700 whitespace-nowrap">
                  Gửi đến: {getTargetLabel(ann.target)}
                </span>
              </div>
              <p className="text-sm sm:text-base text-gray-600 whitespace-pre-wrap break-words">{ann.content}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-4">
                Đăng lúc: {new Date(ann.createdAt).toLocaleString('vi-VN')}
              </p>
            </div>
            <button 
              onClick={() => setConfirmDelete(ann.id)}
              className="self-end sm:self-start p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
              title="Xóa thông báo"
            >
              <Trash2 size={20} />
            </button>
          </div>
        )) : (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500">
            <Bell size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Chưa có thông báo nào.</p>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Tạo thông báo mới"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Tiêu đề</label>
            <input 
              type="text" 
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium"
              placeholder="Nhập tiêu đề thông báo..."
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Gửi đến</label>
            <select 
              value={formData.target}
              onChange={e => setFormData({...formData, target: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium"
            >
              <option value="all">Tất cả</option>
              <option value="students">Tất cả học sinh</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>Lớp {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nội dung</label>
            <textarea 
              required
              rows={5}
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium resize-none"
              placeholder="Nhập nội dung thông báo..."
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
              className="flex items-center gap-2 px-6 py-2.5 text-white bg-[#db2777] rounded-xl hover:bg-pink-700 font-bold shadow-[0_4px_0_#9d174d] hover:translate-y-[2px] hover:shadow-[0_2px_0_#9d174d] active:translate-y-[4px] active:shadow-[0_0px_0_#9d174d] transition-all"
            >
              <Send size={18} />
              Gửi thông báo
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
          <p className="text-gray-700 mb-6 font-medium">Bạn có chắc chắn muốn xóa thông báo này không?</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-bold transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleDelete}
              className="px-6 py-2.5 text-white bg-red-600 rounded-xl hover:bg-red-700 font-bold shadow-[0_4px_0_#b91c1c] hover:translate-y-[2px] hover:shadow-[0_2px_0_#b91c1c] active:translate-y-[4px] active:shadow-[0_0px_0_#b91c1c] transition-all"
            >
              Xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
