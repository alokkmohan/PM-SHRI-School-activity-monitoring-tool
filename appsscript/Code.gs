// ============================================================
// PM SHRI School Activity Monitoring - Google Apps Script
// Google Sheet ID - Schools master data
// ============================================================

const SHEET_ID = '1Xru8dZVrxCQO2e71oKhLr_ISVPJHGKBZlznK1zSxZj8';
const SCHOOLS_SHEET_NAME = 'Sheet1';
const RESPONSES_SHEET_NAME = 'Responses';
const DATA_START_ROW = 4; // Actual school data starts at row 4
const PHOTOS_FOLDER_ID = '1LJAqwfPqcCBO77GLFzL0SrZqhum5PptJ'; // PM SHRI Photos Drive folder

// ---- Serve the Web App ----
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('PM SHRI School Activity Monitoring')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---- Lookup School by UDISE Code ----
function getSchoolData(udiseCode) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SCHOOLS_SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow < DATA_START_ROW) {
      return { success: false, message: 'Sheet mein data nahi mila.' };
    }

    const data = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 6).getValues();
    const udiseStr = String(udiseCode).trim().replace(/\.0$/, '');

    for (let i = 0; i < data.length; i++) {
      const rowUdise = String(data[i][2]).trim().replace(/\.0$/, '');
      if (rowUdise === udiseStr) {
        return {
          success: true,
          data: {
            slNo: data[i][0],
            district: String(data[i][1]).trim(),
            udise: rowUdise,
            schoolName: String(data[i][3]).trim(),
            principalName: String(data[i][4]).trim(),
            mobile: String(data[i][5]).trim().replace(/\.0$/, '')
          }
        };
      }
    }
    return { success: false, message: 'UDISE Code nahi mila. Kripya sahi code daalen.' };
  } catch (err) {
    return { success: false, message: 'Server error: ' + err.message };
  }
}

// ---- Upload Single Photo to Drive ----
// Folder structure: PM SHRI School Photos / District / UDISE_SchoolName / ActivityName /
function uploadPhoto(base64Data, mimeType, fileName, district, udise, schoolName, activityName) {
  try {
    // Use the designated PM SHRI Photos folder
    const mainFolder = DriveApp.getFolderById(PHOTOS_FOLDER_ID);

    // Level 2: District
    const districtFolder = getOrCreateSubFolder(mainFolder, sanitizeName(district));

    // Level 3: UDISE_SchoolName
    const schoolFolderName = sanitizeName(udise + '_' + schoolName);
    const schoolFolder = getOrCreateSubFolder(districtFolder, schoolFolderName);

    // Level 4: Activity Name
    const actFolder = getOrCreateSubFolder(schoolFolder, sanitizeName(activityName));

    // Create file
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = actFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
      fileId: file.getId()
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---- Save Final Form Data to Responses Sheet ----
function saveFormData(formData) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(RESPONSES_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(RESPONSES_SHEET_NAME);
      const headers = [
        'Timestamp', 'UDISE Code', 'District', 'School Name', 'Principal Name', 'Mobile No.',
        'Act1 Name', 'Act1 Date', 'Act1 Boys', 'Act1 Girls', 'Act1 Teachers', 'Act1 Total', 'Act1 Photo Links',
        'Act2 Name', 'Act2 Date', 'Act2 Boys', 'Act2 Girls', 'Act2 Teachers', 'Act2 Total', 'Act2 Photo Links',
        'Act3 Name', 'Act3 Date', 'Act3 Boys', 'Act3 Girls', 'Act3 Teachers', 'Act3 Total', 'Act3 Photo Links'
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#1a73e8')
        .setFontColor('white')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    const row = [
      new Date(),
      formData.udise,
      formData.district,
      formData.schoolName,
      formData.principalName,
      formData.mobile
    ];

    for (let i = 1; i <= 3; i++) {
      const act = formData['activity' + i] || {};
      const boys = parseInt(act.boys) || 0;
      const girls = parseInt(act.girls) || 0;
      const teachers = parseInt(act.teachers) || 0;
      row.push(
        act.name || '',
        act.date || '',
        boys,
        girls,
        teachers,
        boys + girls,
        (act.photoUrls || []).join('\n')
      );
    }

    sheet.appendRow(row);

    // Auto-resize columns on first few submissions
    if (sheet.getLastRow() <= 5) {
      sheet.autoResizeColumns(1, row.length);
    }

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---- Helper: Get or Create Subfolder ----
function getOrCreateSubFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

// ---- Helper: Sanitize folder/file names ----
function sanitizeName(name) {
  return String(name).replace(/[\/\\:*?"<>|]/g, '_').trim().substring(0, 100);
}
