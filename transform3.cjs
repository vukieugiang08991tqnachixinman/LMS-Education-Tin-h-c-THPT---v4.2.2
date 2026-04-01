const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/LessonManagement.tsx', 'utf8');

// Remove activeTab
content = content.replace(/const \[activeTab, setActiveTab\] = useState<'lessons' \| 'assignments'>\('lessons'\);\n/g, '');

// Remove tabs UI
const tabsRegex = /<div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">[\s\S]*?<\/div>\n/m;
content = content.replace(tabsRegex, '');

// Remove the ternary operator for activeTab
const startIdx = content.indexOf("{activeTab === 'lessons' ? (");
const endIdx = content.indexOf(") : (", startIdx);
if (startIdx !== -1 && endIdx !== -1) {
  // We keep the "lessons" part and remove the "assignments" part
  content = content.substring(0, startIdx) + content.substring(startIdx + 28, endIdx);
  
  // Find the closing parenthesis of the ternary operator
  const closeIdx = content.indexOf(")}", endIdx);
  if (closeIdx !== -1) {
    content = content.substring(0, endIdx) + content.substring(closeIdx + 2);
  }
}

// Change the title
content = content.replace(/Quản lý Bài giảng & Bài tập/g, 'Quản lý Bài giảng');
content = content.replace(/Soạn thảo và quản lý nội dung bài học, bài tập/g, 'Soạn thảo và quản lý nội dung bài học');

fs.writeFileSync('src/pages/admin/LessonManagement.tsx', content);
console.log('Done');
