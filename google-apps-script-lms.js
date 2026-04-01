/**
 * LMS Quản lí học tập - Google Apps Script Backend
 * Hỗ trợ đồng bộ dữ liệu giữa Web App và Google Sheets
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// Cấu hình các bảng và tiêu đề cột tương ứng
const SCHEMA = {
  'users': ['id', 'username', 'password', 'fullName', 'role', 'classId', 'dob', 'xp', 'level', 'badgesJson'],
  'classes': ['id', 'name', 'grade', 'teacherId', 'teacherName', 'academicYear'],
  'subjects': ['id', 'name', 'description'],
  'topics': ['id', 'subjectId', 'name', 'order'],
  'lessons': ['id', 'topicId', 'title', 'content', 'videoUrl', 'pptUrl', 'order', 'status', 'grade', 'classId', 'interactiveContentJson', 'essayQuestionsJson'],
  'assignments': ['id', 'lessonId', 'title', 'description', 'dueDate', 'grade', 'classId', 'subjectId', 'topicId', 'studentIdsJson', 'attachmentsJson', 'questionsJson', 'part1', 'part2', 'part3', 'part4'],
  'bank_questions': ['id', 'type', 'difficulty', 'content', 'optionsJson', 'correctAnswerJson', 'subQuestionsJson', 'points', 'explanation', 'subjectId', 'topicId', 'createdAt'],
  'tests': ['id', 'title', 'topicId', 'durationMinutes', 'startTime', 'endTime', 'questionsJson', 'assignedToJson', 'createdAt'],
  'submissions': ['id', 'assignmentId', 'testId', 'studentId', 'content', 'part1Content', 'part2Content', 'part3Content', 'part4Content', 'fileName', 'fileUrl', 'submittedAt', 'score', 'feedback'],
  'progresses': ['id', 'studentId', 'lessonId', 'completed', 'completedAt', 'lastAccessed', 'quizScoresJson', 'essayAnswersJson', 'teacherFeedbackJson'],
  'announcements': ['id', 'target', 'title', 'content', 'createdAt', 'authorId'],
  'reports': ['id', 'type', 'title', 'dataJson', 'createdAt']
};

/**
 * Xử lý yêu cầu POST từ Web App
 */
function doPost(e) {
  const result = { ok: false, data: null, error: null };
  
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const payload = postData.payload;
    
    if (payload && payload.table && !SCHEMA[payload.table]) {
      // Tự động tạo schema cơ bản nếu bảng chưa có trong định nghĩa
      if (payload.record) {
        SCHEMA[payload.table] = Object.keys(payload.record);
      } else if (payload.data && payload.data.length > 0) {
        SCHEMA[payload.table] = Object.keys(payload.data[0]);
      } else {
        throw new Error('Bảng không xác định: ' + payload.table);
      }
    }
    
    switch (action) {
      case 'fetch_all':
        result.data = fetchAllData();
        result.ok = true;
        break;
        
      case 'sync_all':
        if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu đồng bộ không hợp lệ');
        result.data = syncAllData(payload);
        result.ok = true;
        break;
        
      case 'sync_table':
        if (!payload.table || !payload.data) throw new Error('Thiếu thông tin bảng hoặc dữ liệu');
        result.data = syncTable(payload.table, payload.data);
        result.ok = true;
        break;
        
      case 'upsert_record':
        if (!payload.table || !payload.record) throw new Error('Thiếu thông tin bản ghi');
        result.data = upsertRecord(payload.table, payload.record);
        result.ok = true;
        break;

      case 'delete_record':
        if (!payload.table || !payload.id) throw new Error('Thiếu ID bản ghi cần xóa');
        result.data = deleteRecord(payload.table, payload.id);
        result.ok = true;
        break;
        
      default:
        throw new Error('Hành động không hợp lệ: ' + action);
    }
  } catch (err) {
    result.ok = false;
    result.error = err.message;
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Đồng bộ toàn bộ dữ liệu (Nhiều bảng cùng lúc)
 */
function syncAllData(payload) {
  const results = {};
  Object.keys(payload).forEach(tableName => {
    if (SCHEMA[tableName]) {
      results[tableName] = syncTable(tableName, payload[tableName]);
    }
  });
  return results;
}

/**
 * Lấy toàn bộ dữ liệu từ tất cả các sheet
 */
function fetchAllData() {
  const allData = {};
  Object.keys(SCHEMA).forEach(tableName => {
    allData[tableName] = fetchTableData(tableName);
  });
  return allData;
}

/**
 * Lấy dữ liệu từ một sheet cụ thể
 */
function fetchTableData(tableName) {
  const sheet = getOrCreateSheet(tableName);
  const headers = SCHEMA[tableName];
  if (!headers) return []; // Trả về mảng trống nếu không có định nghĩa bảng
  
  const values = sheet.getDataRange().getValues();
  
  if (values.length <= 1) return []; // Chỉ có header hoặc trống
  
  const dataHeaders = values[0];
  const rows = values.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach(header => {
      const colIdx = dataHeaders.indexOf(header);
      if (colIdx !== -1) {
        let val = row[colIdx];
        // Xử lý JSON string cho các trường đặc biệt hoặc kết thúc bằng "Json"
        const isJsonField = header.endsWith('Json') || ['questions', 'assignedTo', 'content', 'interactiveContent', 'options', 'subQuestions', 'rubricJson', 'optionsJson'].includes(header);
        if (isJsonField && typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        obj[header] = val;
      }
    });
    return obj;
  });
}

/**
 * Đồng bộ toàn bộ một bảng (Ghi đè hoặc cập nhật)
 */
function syncTable(tableName, dataList) {
  const sheet = getOrCreateSheet(tableName);
  const headers = SCHEMA[tableName];
  if (!headers) throw new Error('Không tìm thấy định nghĩa cột cho bảng: ' + tableName);
  
  // Xóa dữ liệu cũ (giữ lại header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (dataList.length === 0) return [];
  
  const rows = dataList.map(item => {
    return headers.map(header => {
      let val = item[header];
      if (typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      return val === undefined ? '' : val;
    });
  });
  
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  return dataList;
}

/**
 * Thêm hoặc cập nhật một bản ghi duy nhất
 */
function upsertRecord(tableName, record) {
  const sheet = getOrCreateSheet(tableName);
  const headers = SCHEMA[tableName];
  if (!headers) throw new Error('Không tìm thấy định nghĩa cột cho bảng: ' + tableName);
  
  const id = record.id;
  if (!id) throw new Error('Bản ghi phải có trường id');
  
  const data = sheet.getDataRange().getValues();
  const idColIdx = headers.indexOf('id');
  if (idColIdx === -1) throw new Error('Không tìm thấy cột id trong định nghĩa bảng: ' + tableName);
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIdx] == id) {
      rowIndex = i + 1;
      break;
    }
  }
  
  const rowData = headers.map(header => {
    let val = record[header];
    if (typeof val === 'object' && val !== null) {
      val = JSON.stringify(val);
    }
    return val === undefined ? '' : val;
  });
  
  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  return record;
}

/**
 * Xóa một bản ghi theo ID
 */
function deleteRecord(tableName, id) {
  const sheet = getOrCreateSheet(tableName);
  const headers = SCHEMA[tableName];
  const data = sheet.getDataRange().getValues();
  const idColIdx = headers.indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIdx] == id) {
      sheet.deleteRow(i + 1);
      return { id: id, deleted: true };
    }
  }
  return { id: id, deleted: false };
}

/**
 * Lấy sheet theo tên, nếu chưa có thì tạo mới với header
 */
/**
 * Lấy sheet theo tên, nếu chưa có thì tạo mới với header
 */
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let sheet = null;
  
  // Kiểm tra thủ công qua danh sách tất cả các trang tính để tránh lỗi cache
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === name) {
      sheet = sheets[i];
      break;
    }
  }
  
  if (!sheet) {
    try {
      sheet = ss.insertSheet(name);
      const headers = SCHEMA[name];
      if (headers) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
      }
    } catch (e) {
      // Nếu vẫn lỗi (có thể do vừa được tạo bởi một yêu cầu song song), thử lấy lại lần cuối
      sheet = ss.getSheetByName(name);
      if (!sheet) throw new Error('Không thể tạo hoặc tìm thấy trang tính "' + name + '": ' + e.message);
    }
  }
  return sheet;
}

/**
 * Xử lý yêu cầu GET (Để kiểm tra Web App có hoạt động không)
 */
function doGet() {
  return ContentService.createTextOutput("LMS Backend is running. Please use POST for data synchronization.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Khởi tạo cơ sở dữ liệu Google Sheets
 * Tạo các tab, thiết lập header và seed dữ liệu mẫu nếu trống
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.keys(SCHEMA).forEach(tableName => {
    const sheet = getOrCreateSheet(tableName);
    
    // Đảm bảo header luôn đúng
    const headers = SCHEMA[tableName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    
    // Kiểm tra nếu sheet trống (chỉ có header hoặc hoàn toàn trống)
    if (sheet.getLastRow() <= 1) {
      const seedData = getSeedData(tableName);
      if (seedData && seedData.length > 0) {
        const rows = seedData.map(item => {
          return headers.map(header => {
            let val = item[header];
            // Xử lý các trường JSON
            if (typeof val === 'object' && val !== null) {
              val = JSON.stringify(val);
            }
            return val === undefined ? '' : val;
          });
        });
        
        if (rows.length > 0) {
          sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        }
      }
    }
  });
  
  // Thông báo hoàn tất
  if (typeof SpreadsheetApp.getUi === 'function') {
    try {
      SpreadsheetApp.getUi().alert('Khởi tạo cơ sở dữ liệu LMS Education Tin học THPT thành công!');
    } catch (e) {
      console.log('Database setup completed.');
    }
  }
}

/**
 * Dữ liệu mẫu (Seed Data) cho hệ thống
 */
function getSeedData(tableName) {
  const now = new Date().toISOString();
  
  const seeds = {
    'users': [
      { id: 'u1', username: 'teacher', password: '123', fullName: 'Giáo viên Tin học', role: 'teacher', classId: '', dob: '1985-01-01', xp: 0, level: 1, badgesJson: [] },
      { id: 'u2', username: 'student', password: '123', fullName: 'Học sinh Mẫu', role: 'student', classId: 'c1', dob: '2008-05-15', xp: 100, level: 1, badgesJson: [] }
    ],
    'classes': [
      { id: 'c1', name: '10A1', grade: 10, teacherId: 'u1', teacherName: 'Giáo viên Tin học', academicYear: '2023-2024' },
      { id: 'c2', name: '11B2', grade: 11, teacherId: 'u1', teacherName: 'Giáo viên Tin học', academicYear: '2023-2024' }
    ],
    'subjects': [
      { id: 's1', name: 'Tin học 10', description: 'Tin học 10 - Kết nối tri thức và cuộc sống' },
      { id: 's2', name: 'Tin học 11', description: 'Tin học 11 - Kết nối tri thức và cuộc sống' }
    ],
    'topics': [
      { id: 't1', subjectId: 's1', name: 'Chủ đề 1: Máy tính và xã hội tri thức', order: 1 },
      { id: 't2', subjectId: 's1', name: 'Chủ đề 2: Mạng máy tính và Internet', order: 2 }
    ],
    'lessons': [
      { 
        id: 'l1', topicId: 't1', title: 'Bài 1: Thông tin và xử lý thông tin', 
        content: 'Thông tin là những gì đem lại hiểu biết cho con người về thế giới xung quanh...', 
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
        pptUrl: '',
        order: 1, status: 'published', grade: '10', classId: '',
        interactiveContentJson: [
          { id: 'b1', type: 'text', data: { content: 'Chào mừng bạn đến với bài học đầu tiên!' } }
        ],
        essayQuestionsJson: []
      }
    ],
    'assignments': [
      { id: 'a1', lessonId: 'l1', title: 'Bài tập về nhà Bài 1', description: 'Hãy tóm tắt nội dung chính của bài học.', dueDate: '2026-12-31', grade: '10', classId: 'c1', subjectId: 's1', topicId: 't1', studentIdsJson: [], attachmentsJson: [], questionsJson: [] }
    ],
    'tests': [
      { 
        id: 'test1', title: 'Kiểm tra 15 phút - Bài 1', topicId: 't1', durationMinutes: 15, 
        startTime: '2023-01-01T00:00:00Z', endTime: '2026-12-31T23:59:59Z', 
        questionsJson: [
          { id: 'q1', type: 'multiple_choice', content: 'Thông tin là gì?', options: ['Dữ liệu', 'Hiểu biết', 'Con số', 'Vật chất'], correctAnswer: 'Hiểu biết', points: 10 }
        ], 
        assignedToJson: { type: 'grade', ids: ['10'] }, 
        createdAt: now 
      }
    ],
    'announcements': [
      { id: 'ann1', target: 'all', title: 'Chào mừng năm học mới', content: 'Chúc các em có một năm học thành công!', createdAt: now, authorId: 'u1' }
    ],
    'bank_questions': [
      { 
        id: 'bq1', type: 'multiple_choice', difficulty: 'recognition', 
        content: 'Đơn vị đo lượng thông tin nhỏ nhất là?', optionsJson: ['Byte', 'Bit', 'KB', 'MB'], 
        correctAnswerJson: 'Bit', subQuestionsJson: [], points: 1, explanation: 'Bit là đơn vị nhỏ nhất', subjectId: 's1', topicId: 't1', createdAt: now 
      }
    ]
  };
  
  return seeds[tableName] || [];
}
