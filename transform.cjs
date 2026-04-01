const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AssignmentManagement.tsx', 'utf8');

// Rename component
content = content.replace('const LessonManagement = () => {', 'export const AssignmentManagement = () => {');
content = content.replace('export default LessonManagement;', '');

// Remove activeTab
content = content.replace(/const \[activeTab, setActiveTab\] = useState<'lessons' \| 'assignments'>\('lessons'\);\n/g, '');

// Remove tabs UI
const tabsRegex = /<div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">[\s\S]*?<\/div>\n/m;
content = content.replace(tabsRegex, '');

// Remove the ternary operator for activeTab
// We need to be careful here. The ternary operator spans from line 640 to 812.
const startIdx = content.indexOf("{activeTab === 'lessons' ? (");
const endIdx = content.indexOf(") : (", startIdx);
if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + content.substring(endIdx + 5);
}

// Remove the closing parenthesis of the ternary operator
const closeIdx = content.lastIndexOf(")}");
if (closeIdx !== -1) {
  content = content.substring(0, closeIdx) + content.substring(closeIdx + 2);
}

// Rename independentAssignments to assignments
content = content.replace(/independentAssignments/g, 'assignments');
content = content.replace(/setIndependentAssignments/g, 'setAssignments');

// Change the filter to show all assignments
content = content.replace(/setAssignments\(assignData\.filter\(a => !a\.lessonId\)\);/g, 'setAssignments(assignData);');

// Change the title
content = content.replace(/Quản lý Bài giảng & Bài tập/g, 'Quản lý Bài tập');
content = content.replace(/Soạn thảo và quản lý nội dung bài học, bài tập/g, 'Quản lý và chấm điểm bài tập');

// Remove the "Thêm bài giảng" button
const addLessonBtnRegex = /<button\s+onClick={\(\) => handleOpenModal\(\)}[\s\S]*?<\/button>/m;
content = content.replace(addLessonBtnRegex, '');

fs.writeFileSync('src/pages/admin/AssignmentManagement.tsx', content);
console.log('Done');
