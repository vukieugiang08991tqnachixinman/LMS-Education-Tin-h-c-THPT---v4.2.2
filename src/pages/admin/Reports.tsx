import React, { useEffect, useState } from 'react';
import { dataProvider } from '../../core/provider';
import { User, Class, Submission, Assignment, Progress, Lesson } from '../../core/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, TrendingUp, CheckCircle, Clock } from 'lucide-react';

export const Reports: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progresses, setProgresses] = useState<Progress[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [clsData, usersData, subData, assignData, progData, lessonData] = await Promise.all([
        dataProvider.getList<Class>('classes'),
        dataProvider.getList<User>('users', { role: 'student' }),
        dataProvider.getList<Submission>('submissions'),
        dataProvider.getList<Assignment>('assignments'),
        dataProvider.getList<Progress>('progresses'),
        dataProvider.getList<Lesson>('lessons')
      ]);
      setClasses(clsData);
      setStudents(usersData);
      setSubmissions(subData);
      setAssignments(assignData);
      setProgresses(progData);
      setLessons(lessonData);
      if (clsData.length > 0) {
        setSelectedClassId(clsData[0].id);
      }
    };
    fetchData();
  }, []);

  const classStudents = students.filter(s => String(s.classId) === String(selectedClassId));
  const studentIds = classStudents.map(s => s.id);

  // 1. % Học sinh hoàn thành bài giảng
  const totalLessons = lessons.length;
  const completionData = classStudents.map(student => {
    const completedLessons = progresses.filter(p => p.studentId === student.id && p.completed).length;
    const percentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    return {
      name: student.fullName,
      completed: Math.round(percentage)
    };
  });

  // 2. Tỷ lệ nộp bài đúng hạn
  let onTimeCount = 0;
  let lateCount = 0;
  let missingCount = 0;

  const selectedClass = classes.find(c => String(c.id) === String(selectedClassId));

  classStudents.forEach(student => {
    const studentClass = classes.find(c => String(c.id) === String(student.classId));
    
    // Lọc các bài tập được giao cho học sinh này
    const studentAssignments = assignments.filter(a => {
      let studentIds = a.studentIds;
      if (typeof studentIds === 'string') {
        try {
          studentIds = JSON.parse(studentIds);
        } catch (e) {
          studentIds = studentIds.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      if (studentIds && studentIds.includes(student.id)) return true;
      if (a.classId && String(a.classId) === String(student.classId) && (!studentIds || studentIds.length === 0)) return true;
      if (studentClass && a.grade && String(a.grade) === String(studentClass.grade) && !a.classId && (!studentIds || studentIds.length === 0)) return true;
      
      if (a.lessonId && !a.classId && !a.grade && (!studentIds || studentIds.length === 0)) {
        const lesson = lessons.find(l => l.id === a.lessonId);
        if (lesson && lesson.status === 'published') {
          if (lesson.classId && String(lesson.classId) !== String(student.classId)) return false;
          if (lesson.grade && studentClass && String(lesson.grade) !== String(studentClass.grade)) return false;
          return true;
        }
        return false;
      }
      return false;
    });

    studentAssignments.forEach(assignment => {
      const sub = submissions.find(s => s.studentId === student.id && s.assignmentId === assignment.id);
      if (!sub) {
        missingCount++;
      } else {
        const isLate = new Date(sub.submittedAt) > new Date(assignment.dueDate);
        if (isLate) lateCount++;
        else onTimeCount++;
      }
    });
  });

  const submissionPieData = [
    { name: 'Đúng hạn', value: onTimeCount, color: '#10b981' }, // emerald-500
    { name: 'Nộp muộn', value: lateCount, color: '#f59e0b' }, // amber-500
    { name: 'Chưa nộp', value: missingCount, color: '#ef4444' } // red-500
  ].filter(d => d.value > 0);

  // 3. Thống kê học lực (Điểm trung bình)
  const studentScores = classStudents.map(student => {
    const studentSubs = submissions.filter(s => s.studentId === student.id && s.score !== undefined);
    const totalScore = studentSubs.reduce((sum, s) => sum + (s.score || 0), 0);
    const avgScore = studentSubs.length > 0 ? totalScore / studentSubs.length : 0;
    
    // Tính số bài nộp muộn
    let lateSubs = 0;
    studentSubs.forEach(sub => {
      const assignment = assignments.find(a => a.id === sub.assignmentId);
      if (assignment && new Date(sub.submittedAt) > new Date(assignment.dueDate)) {
        lateSubs++;
      }
    });

    return {
      ...student,
      avgScore,
      lateSubs,
      subsCount: studentSubs.length
    };
  });

  // Phân loại học lực
  let excellent = 0; // >= 8
  let good = 0; // 6.5 - 7.9
  let average = 0; // 5 - 6.4
  let weak = 0; // < 5

  studentScores.forEach(s => {
    if (s.subsCount === 0) return;
    if (s.avgScore >= 8) excellent++;
    else if (s.avgScore >= 6.5) good++;
    else if (s.avgScore >= 5) average++;
    else weak++;
  });

  const performanceData = [
    { name: 'Giỏi (>=8)', value: excellent, fill: '#3b82f6' },
    { name: 'Khá (6.5-7.9)', value: good, fill: '#10b981' },
    { name: 'TB (5-6.4)', value: average, fill: '#f59e0b' },
    { name: 'Yếu (<5)', value: weak, fill: '#ef4444' }
  ];

  // 4. Học sinh cần hỗ trợ (At Risk)
  // Nộp muộn > 2 bài HOẶC điểm trung bình < 5 (và có ít nhất 1 bài đã chấm)
  const atRiskStudents = studentScores.filter(s => s.lateSubs > 2 || (s.subsCount > 0 && s.avgScore < 5));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-blue-600" />
          Báo cáo & Thống kê
        </h2>
        <select 
          value={selectedClassId}
          onChange={e => setSelectedClassId(e.target.value)}
          className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-gray-700 bg-white shadow-sm"
        >
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} (Khối {c.grade})</option>
          ))}
        </select>
      </div>

      {classStudents.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center text-gray-500">
          <p className="text-lg font-medium">Lớp này chưa có học sinh nào.</p>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Completion Chart */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <CheckCircle className="text-emerald-500" size={20} />
                Tỷ lệ hoàn thành bài giảng (%)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip 
                      cursor={{fill: '#f3f4f6'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="% Hoàn thành" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Submission Status Pie Chart */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Clock className="text-amber-500" size={20} />
                Tình trạng nộp bài tập
              </h3>
              <div className="h-72 flex items-center justify-center">
                {submissionPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={submissionPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {submissionPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-400">Chưa có dữ liệu bài tập</p>
                )}
              </div>
            </div>

            {/* Academic Performance Chart */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp className="text-blue-500" size={20} />
                Thống kê học lực (Dựa trên điểm trung bình)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                      cursor={{fill: '#f3f4f6'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Số lượng học sinh">
                      {performanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* At Risk Students */}
          <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-100">
            <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={24} />
              Học sinh cần hỗ trợ (At Risk)
            </h3>
            <p className="text-red-600 mb-6 font-medium">Danh sách học sinh nộp muộn trên 2 bài hoặc có điểm trung bình dưới 5.0</p>
            
            {atRiskStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse bg-white rounded-2xl overflow-hidden shadow-sm">
                  <thead>
                    <tr className="bg-red-100/50 border-b border-red-100">
                      <th className="py-4 px-6 text-sm font-bold text-red-800 uppercase tracking-wider">Họ và tên</th>
                      <th className="py-4 px-6 text-sm font-bold text-red-800 uppercase tracking-wider text-center">Số bài nộp muộn</th>
                      <th className="py-4 px-6 text-sm font-bold text-red-800 uppercase tracking-wider text-center">Điểm trung bình</th>
                      <th className="py-4 px-6 text-sm font-bold text-red-800 uppercase tracking-wider">Vấn đề</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskStudents.map(student => (
                      <tr key={student.id} className="border-b border-red-50 hover:bg-red-50/50 transition-colors">
                        <td className="py-4 px-6 font-semibold text-gray-900">{student.fullName}</td>
                        <td className="py-4 px-6 text-center font-mono font-bold text-amber-600">{student.lateSubs}</td>
                        <td className="py-4 px-6 text-center font-mono font-bold text-red-600">
                          {student.subsCount > 0 ? student.avgScore.toFixed(1) : '-'}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                            {student.lateSubs > 2 && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 w-fit">
                                Thường xuyên nộp muộn
                              </span>
                            )}
                            {student.subsCount > 0 && student.avgScore < 5 && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 w-fit">
                                Kết quả học tập yếu
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white/60 p-8 rounded-2xl text-center border border-red-100 border-dashed">
                <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500 opacity-50" />
                <p className="text-lg font-bold text-emerald-700">Tuyệt vời! Không có học sinh nào trong danh sách cần hỗ trợ.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
