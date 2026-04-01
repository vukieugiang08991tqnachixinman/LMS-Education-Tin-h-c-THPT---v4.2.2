const { execSync } = require('child_process');
execSync('git checkout src/pages/admin/LessonManagement.tsx');
console.log('Restored');
