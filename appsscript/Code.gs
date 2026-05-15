// ============================================================
// PM SHRI School Activity Monitoring - Google Apps Script
// Samagra Shiksha | Secondary Education Department, Govt. of UP
// ============================================================

const SHEET_ID        = '1Xru8dZVrxCQO2e71oKhLr_ISVPJHGKBZlznK1zSxZj8';
const SCHOOLS_SHEET   = 'Sheet1';
const RESPONSES_SHEET = 'Responses';
const DATA_START_ROW  = 4;
const PHOTOS_FOLDER_ID = '1LJAqwfPqcCBO77GLFzL0SrZqhum5PptJ';

// ---- Serve Web App ----
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('PM SHRI School Activity Monitoring Tool')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---- Normalize UDISE (strip leading zeros and .0) ----
function normUdise(v) {
  return String(v).trim().replace(/\.0$/, '').replace(/^0+/, '') || '0';
}

// ---- Lookup School + Previous Submissions ----
function getSchoolData(udiseCode) {
  try {
    const ss      = SpreadsheetApp.openById(SHEET_ID);
    const sheet   = ss.getSheetByName(SCHOOLS_SHEET);
    const lastRow = sheet.getLastRow();

    if (lastRow < DATA_START_ROW) {
      return { success: false, message: 'No data found in the sheet.' };
    }

    const data      = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 6).getValues();
    const udiseNorm = normUdise(udiseCode);

    for (let i = 0; i < data.length; i++) {
      if (normUdise(data[i][2]) === udiseNorm) {
        const displayUdise = String(data[i][2]).trim().replace(/\.0$/, '').padStart(11, '0');
        const schoolInfo = {
          slNo:          data[i][0],
          district:      String(data[i][1]).trim(),
          udise:         displayUdise,
          schoolName:    String(data[i][3]).trim(),
          principalName: String(data[i][4]).trim(),
          mobile:        String(data[i][5]).trim().replace(/\.0$/, '')
        };
        const submissions = getPreviousSubmissions(displayUdise);
        return { success: true, data: schoolInfo, submissions: submissions };
      }
    }
    return { success: false, message: 'UDISE Code not found. Please enter the correct 11-digit code.' };
  } catch (err) {
    return { success: false, message: 'Server error: ' + err.message };
  }
}

// ---- Fetch Previous Submissions for this School ----
function getPreviousSubmissions(udise) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(RESPONSES_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const lastRow = sheet.getLastRow();
    // Columns: Timestamp(0)|District(1)|School(2)|UDISE(3)|Principal(4)|Mobile(5)|
    //          ActNo(6)|ActName(7)|FromDate(8)|ToDate(9)|Boys(10)|Girls(11)|
    //          Teachers(12)|Total(13)|PhotoLinks(14)|FolderLink(15)
    const data   = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
    const norm   = normUdise;
    const udiseN = norm(udise);

    return data
      .filter(row => norm(row[3]) === udiseN && row[7])
      .map(row => ({
        timestamp:   row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm') : '',
        activityNum: row[6],
        name:        row[7],
        fromDate:    row[8] ? Utilities.formatDate(new Date(row[8]), 'Asia/Kolkata', 'dd-MMM-yyyy') : '',
        toDate:      row[9] ? Utilities.formatDate(new Date(row[9]), 'Asia/Kolkata', 'dd-MMM-yyyy') : '',
        boys:        row[10],
        girls:       row[11],
        teachers:    row[12],
        total:       row[13],
        photoCount:  String(row[14]).split('\n').filter(x => x.trim()).length,
        folderUrl:   row[15] || ''
      }));
  } catch (e) {
    return [];
  }
}

// ---- Upload Single Photo to Drive ----
// Folder: PM SHRI Photos / District / UDISE_SchoolName / ActivityName /
function uploadPhoto(base64Data, mimeType, fileName, district, udise, schoolName, activityName) {
  try {
    const mainFolder     = DriveApp.getFolderById(PHOTOS_FOLDER_ID);
    const districtFolder = getOrCreateSubFolder(mainFolder, sanitize(district));
    const schoolFolder   = getOrCreateSubFolder(districtFolder, sanitize(udise + '_' + schoolName));
    const actFolder      = getOrCreateSubFolder(schoolFolder, sanitize(activityName));

    const bytes = Utilities.base64Decode(base64Data);
    const blob  = Utilities.newBlob(bytes, mimeType, fileName);
    const file  = actFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      url:    'https://drive.google.com/file/d/' + file.getId() + '/view',
      fileId: file.getId()
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---- Save One Activity Submission ----
// Sheet columns:
// Timestamp | District | School Name | UDISE Code | Principal Name | Mobile No. |
// Activity No. | Activity Name | Activity From Date | Activity To Date |
// Boys | Girls | Teachers | Total Students | Photo Links | Photos Folder Link
function saveActivityData(formData) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(RESPONSES_SHEET);

    if (!sheet) {
      sheet = ss.insertSheet(RESPONSES_SHEET);
      const headers = [
        'Timestamp', 'District', 'School Name', 'UDISE Code', 'Principal Name', 'Mobile No.',
        'Activity No.', 'Activity Name', 'Activity From Date', 'Activity To Date',
        'Boys', 'Girls', 'Teachers', 'Total Students',
        'Photo Links', 'Photos Folder Link'
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    const boys     = parseInt(formData.boys)     || 0;
    const girls    = parseInt(formData.girls)    || 0;
    const teachers = parseInt(formData.teachers) || 0;

    // Get the activity folder URL in Drive
    let folderUrl = '';
    try {
      const main = DriveApp.getFolderById(PHOTOS_FOLDER_ID);
      const dist = getOrCreateSubFolder(main, sanitize(formData.district));
      const sch  = getOrCreateSubFolder(dist, sanitize(formData.udise + '_' + formData.schoolName));
      const act  = getOrCreateSubFolder(sch,  sanitize(formData.activityName));
      folderUrl  = 'https://drive.google.com/drive/folders/' + act.getId();
    } catch (e) { /* non-fatal */ }

    sheet.appendRow([
      new Date(),
      formData.district,
      formData.schoolName,
      formData.udise,
      formData.principalName,
      formData.mobile,
      formData.activityNum,
      formData.activityName,
      formData.activityFromDate,
      formData.activityToDate,
      boys, girls, teachers,
      boys + girls,
      (formData.photoUrls || []).join('\n'),
      folderUrl
    ]);

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---- Helpers ----
function getOrCreateSubFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function sanitize(s) {
  return String(s).replace(/[\/\\:*?"<>|]/g, '_').trim().substring(0, 80);
}
