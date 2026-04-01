/**
 * Google Apps Script - LMS Web API
 * Biến Google Sheet thành một Web API cho hệ thống LMS
 */

function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var payload = requestData.payload;
    
    var result;
    
    switch (action) {
      case 'classes.list':
        result = listData('classes');
        break;
      case 'students.add':
        result = addData('students', payload);
        break;
      case 'assignments.create':
        result = addData('assignments', payload);
        break;
      case 'submissions.grade':
        result = updateData('submissions', payload.id, { grade: payload.grade, feedback: payload.feedback });
        break;
      default:
        throw new Error('Action không hợp lệ: ' + action);
    }
    
    return createJsonResponse({ ok: true, data: result });
    
  } catch (error) {
    return createJsonResponse({ ok: false, error: error.toString() });
  }
}

/**
 * Lớp xử lý dữ liệu (Database Layer)
 */

function listData(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Không tìm thấy sheet: ' + sheetName);
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);
  
  return rows.map(function(row) {
    var obj = {};
    headers.forEach(function(header, index) {
      obj[header] = row[index];
    });
    return obj;
  });
}

function addData(sheetName, payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Không tìm thấy sheet: ' + sheetName);
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRow = headers.map(function(header) {
    return payload[header] || '';
  });
  
  sheet.appendRow(newRow);
  return payload;
}

function updateData(sheetName, id, updates) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Không tìm thấy sheet: ' + sheetName);
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error('Không tìm thấy cột "id" trong sheet ' + sheetName);
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][idIndex] == id) {
      // Tìm thấy dòng cần cập nhật
      for (var key in updates) {
        var colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updates[key]);
        }
      }
      return { id: id, status: 'updated' };
    }
  }
  
  throw new Error('Không tìm thấy bản ghi với id: ' + id);
}

/**
 * Xử lý CORS và trả về JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Hàm doGet để kiểm tra trạng thái API
 */
function doGet(e) {
  return createJsonResponse({ ok: true, message: 'LMS API is running' });
}
