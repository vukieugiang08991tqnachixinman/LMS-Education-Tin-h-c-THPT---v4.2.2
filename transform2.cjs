const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AssignmentManagement.tsx', 'utf8');

// Remove isModalOpen modal
const startModal1 = content.indexOf('{/* Modal Thêm/Sửa */}');
const endModal1 = content.indexOf('{/* Modal Xóa */}');
if (startModal1 !== -1 && endModal1 !== -1) {
  content = content.substring(0, startModal1) + content.substring(endModal1);
}

// Remove isAssignmentModalOpen modal
const startModal2 = content.indexOf('{/* Modal Giao bài tập */}');
const endModal2 = content.indexOf('{/* Modal Chấm bài */}');
if (startModal2 !== -1 && endModal2 !== -1) {
  content = content.substring(0, startModal2) + content.substring(endModal2);
}

// Remove Modal Xóa
const startModal3 = content.indexOf('{/* Modal Xóa */}');
const endModal3 = content.indexOf('{/* Modal Giao bài tập */}');
if (startModal3 !== -1 && endModal3 !== -1) {
  content = content.substring(0, startModal3) + content.substring(endModal3);
}

// Remove the closing `)}` that might be left over from the ternary
content = content.replace(/<\/div>\n      \)}\n/g, '</div>\n');

fs.writeFileSync('src/pages/admin/AssignmentManagement.tsx', content);
console.log('Done');
