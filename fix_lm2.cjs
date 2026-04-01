const fs = require('fs');

let lmContent = fs.readFileSync('src/pages/admin/LessonManagement.tsx', 'utf8');

// Remove `<>` at line 618
lmContent = lmContent.replace(/<>\n\s*{\/\* Filters \*\/}/, '{/* Filters */}');

// Remove `</>` at line 788
lmContent = lmContent.replace(/<\/div>\n\s*<\/>/, '</div>');

// Add closing `</div>` at the end of the component
lmContent = lmContent.replace(/<\/Modal>\n\n    <\/div>\n  \);\n};\n\nexport default LessonManagement;/g, '</Modal>\n\n    </div>\n  );\n};\n\nexport default LessonManagement;');

fs.writeFileSync('src/pages/admin/LessonManagement.tsx', lmContent);
console.log('Done');
