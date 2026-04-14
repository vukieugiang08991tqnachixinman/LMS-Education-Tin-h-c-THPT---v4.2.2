import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dataProvider } from '../../core/provider';
import { Test, Submission, User, Class } from '../../core/types';
import { ArrowLeft, Search, CheckCircle, XCircle, Clock, FileText, Users, Sparkles, Upload, Loader2, Save } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { GoogleGenAI, Type } from '@google/genai';
import { SubmissionDetailModal } from './SubmissionDetailModal';
import { parseTruncatedJSON } from '../../utils/jsonUtils';

export const TestSubmissions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [submissions, setSubmissions] = useState<(Submission & { student?: User, class?: Class })[]>([]);
  const [missingStudents, setMissingStudents] = useState<(User & { class?: Class })[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<(Submission & { student?: User, class?: Class }) | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'submitted' | 'missing'>('submitted');

  const fetchData = async () => {
    if (!id) return;
    try {
      const testData = await dataProvider.getOne<Test>('tests', id);
      setTest(testData);

      const allSubmissions = await dataProvider.getList<Submission>('submissions', { testId: id });
      const allStudents = await dataProvider.getList<User>('users', { role: 'student' });
      const allClasses = await dataProvider.getList<Class>('classes');

      const enrichedSubmissions = allSubmissions.map(sub => {
        const student = allStudents.find(s => s.id === sub.studentId);
        const studentClass = allClasses.find(c => c.id === student?.classId);
        return {
          ...sub,
          student,
          class: studentClass
        };
      });

      setSubmissions(enrichedSubmissions);

      // Calculate missing students
      let assignedStudents: User[] = [];
      if (testData.assignedTo?.type === 'class') {
        assignedStudents = allStudents.filter(s => s.classId && testData.assignedTo.ids.includes(s.classId));
      } else if (testData.assignedTo?.type === 'grade') {
        const targetClasses = allClasses.filter(c => testData.assignedTo.ids.includes(c.grade.toString()));
        const targetClassIds = targetClasses.map(c => c.id);
        assignedStudents = allStudents.filter(s => s.classId && targetClassIds.includes(s.classId));
      }

      const submittedStudentIds = new Set(allSubmissions.map(sub => sub.studentId));
      const missing = assignedStudents.filter(s => !submittedStudentIds.has(s.id));

      const enrichedMissing = missing.map(student => {
        const studentClass = allClasses.find(c => c.id === student.classId);
        return {
          ...student,
          class: studentClass
        };
      });

      setMissingStudents(enrichedMissing);
    } catch (error) {
      console.error("Error fetching submissions", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (!test) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;

  const filteredSubmissions = submissions.filter(sub => 
    (sub.student?.fullName || sub.student?.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (sub.class?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredMissing = missingStudents.filter(student => 
    (student.fullName || student.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (student.class?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/admin/tests')}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kết quả bài kiểm tra</h2>
          <p className="text-gray-500">{test.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Số bài đã nộp</p>
            <p className="text-2xl font-bold text-gray-900">{submissions.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Điểm trung bình</p>
            <p className="text-2xl font-bold text-gray-900">
              {submissions.length > 0 
                ? (submissions.reduce((acc, sub) => acc + (sub.score || 0), 0) / submissions.length).toFixed(1)
                : '0'}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Tổng số câu hỏi</p>
            <p className="text-2xl font-bold text-gray-900">{test.questions?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('submitted')}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${
              activeTab === 'submitted' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Đã nộp ({submissions.length})
          </button>
          <button
            onClick={() => setActiveTab('missing')}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${
              activeTab === 'missing' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Chưa nộp ({missingStudents.length})
          </button>
        </div>
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Tìm kiếm học sinh hoặc lớp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'submitted' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600">Học sinh</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600">Lớp</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600">Thời gian nộp</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600">Điểm số</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length > 0 ? filteredSubmissions.map(sub => (
                  <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-900">
                      {sub.student?.fullName || sub.student?.username || 'Học sinh ẩn danh'}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {sub.class?.name || 'Không có lớp'}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : 'N/A'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${
                        sub.score !== undefined && sub.score >= 5 ? 'bg-emerald-100 text-emerald-800' : 
                        sub.score !== undefined ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {sub.score !== undefined ? sub.score : 'Chưa chấm'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setIsModalOpen(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">Không có bài nộp nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600">Học sinh</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600">Tên đăng nhập</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600">Lớp</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredMissing.length > 0 ? filteredMissing.map(student => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-900">
                      {student.fullName || 'Chưa cập nhật'}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {student.username}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {student.class?.name || 'Không có lớp'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800">
                        Chưa nộp bài
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">Tất cả học sinh đã nộp bài.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SubmissionDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        test={test}
        submission={selectedSubmission}
        onSaved={() => {
          fetchData();
        }}
      />
    </div>
  );
};
