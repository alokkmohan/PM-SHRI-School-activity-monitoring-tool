// ================================================================
// PM SHRI School Activity Monitoring — Cloudflare Worker
// Replaces Google Apps Script backend
//
// Env secrets to set in Cloudflare dashboard:
//   SA_EMAIL          — service account email
//   SA_PRIVATE_KEY    — private key from service account JSON (full PEM)
//   SHEET_ID          — Google Sheet ID
//   PHOTOS_FOLDER_ID  — Google Drive root folder ID
//   ADMIN_PASSWORD    — admin panel password
// ================================================================

const SCHOOLS_SHEET   = 'Sheet1';
const RESPONSES_SHEET = 'Responses';
const DATA_START_ROW  = 4;

let _token       = null;
let _tokenExpiry = 0;

// ================================================================
// Main Handler
// ================================================================
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const url    = new URL(request.url);
      const action = url.searchParams.get('action');
      let result;

      if (request.method === 'GET') {
        if (action === 'getSchool') {
          result = await getSchoolData(url.searchParams.get('udise') || '', env);
        } else if (action === 'getAdminData') {
          if (url.searchParams.get('pwd') !== env.ADMIN_PASSWORD) {
            result = { success: false, message: 'Unauthorized' };
          } else {
            result = await getAdminData(env);
          }
        } else {
          result = { success: false, message: 'Unknown action' };
        }
      } else if (request.method === 'POST') {
        const body = await request.json();
        if (body.action === 'uploadPhoto') {
          result = await uploadPhoto(body, env);
        } else if (body.action === 'saveActivity') {
          result = await saveActivity(body, env);
        } else {
          result = { success: false, message: 'Unknown action' };
        }
      } else {
        result = { success: false, message: 'Method not allowed' };
      }

      return new Response(JSON.stringify(result), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: err.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ================================================================
// Google Service Account — JWT Auth
// ================================================================
async function getAccessToken(env) {
  const now = Date.now();
  if (_token && now < _tokenExpiry - 60000) return _token;

  const iat  = Math.floor(now / 1000);
  const exp  = iat + 3600;
  const scope = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ].join(' ');

  const jwt = await makeJWT(
    { alg: 'RS256', typ: 'JWT' },
    { iss: env.SA_EMAIL, sub: env.SA_EMAIL, scope, aud: 'https://oauth2.googleapis.com/token', iat, exp },
    env.SA_PRIVATE_KEY
  );

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Auth failed: ' + JSON.stringify(data));

  _token       = data.access_token;
  _tokenExpiry = now + 3600000;
  return _token;
}

async function makeJWT(header, payload, pemKey) {
  // Strip everything except valid base64 chars — handles any newline/quote format
  const pem     = pemKey.replace(/[^A-Za-z0-9+/=]/g, '');
  const keyData = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const enc  = new TextEncoder();
  const h    = b64u(JSON.stringify(header));
  const p    = b64u(JSON.stringify(payload));
  const sig  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${h}.${p}`));
  const s    = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${h}.${p}.${s}`;
}

// ================================================================
// Google Sheets Helpers
// ================================================================
async function sheetsGet(range, env) {
  const token = await getAccessToken(env);
  const url   = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${encodeURIComponent(range)}`;
  const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function sheetsAppend(range, values, env) {
  const token = await getAccessToken(env);
  const url   = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res   = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  return res.json();
}

// ================================================================
// UDISE Lookup
// ================================================================
const normUdise = v => String(v).trim().replace(/\.0$/, '').replace(/^0+/, '') || '0';

async function getSchoolData(udiseCode, env) {
  const data = await sheetsGet(`${SCHOOLS_SHEET}!A${DATA_START_ROW}:F`, env);
  if (!data.values) return { success: false, message: 'No school data found.' };

  const target = normUdise(udiseCode);
  for (const row of data.values) {
    if (normUdise(row[2]) === target) {
      const udise = String(row[2]).trim().replace(/\.0$/, '').padStart(11, '0');
      const schoolInfo = {
        slNo: row[0], district: String(row[1]).trim(), udise,
        schoolName: String(row[3]).trim(), principalName: String(row[4]).trim(),
        mobile: String(row[5] || '').trim().replace(/\.0$/, ''),
      };
      const submissions = await getPreviousSubmissions(udise, env);
      return { success: true, data: schoolInfo, submissions };
    }
  }
  return { success: false, message: 'UDISE Code not found. Please enter the correct 11-digit code.' };
}

async function getPreviousSubmissions(udise, env) {
  const data = await sheetsGet(`${RESPONSES_SHEET}!A2:P`, env);
  if (!data.values) return [];
  const norm = normUdise(udise);
  return data.values
    .filter(r => normUdise(r[3]) === norm && r[7])
    .map(r => ({
      timestamp:   r[0]  || '', activityNum: r[6]  || '', name: r[7] || '',
      fromDate:    r[8]  || '', toDate:      r[9]  || '',
      boys:        r[10] || 0,  girls:       r[11] || 0, teachers: r[12] || 0,
      total:       r[13] || 0,
      photoCount:  String(r[14] || '').split('\n').filter(x => x.trim()).length,
      folderUrl:   r[15] || '',
    }));
}

// ================================================================
// Admin Data
// ================================================================
async function getAdminData(env) {
  const [schoolRes, submRes] = await Promise.all([
    sheetsGet(`${SCHOOLS_SHEET}!A${DATA_START_ROW}:F`, env),
    sheetsGet(`${RESPONSES_SHEET}!A2:P`, env),
  ]);

  const schools = (schoolRes.values || [])
    .map(r => ({
      slNo: r[0], district: String(r[1]).trim(),
      udise: String(r[2] || '').trim().replace(/\.0$/, '').padStart(11, '0'),
      schoolName: String(r[3]).trim(), principalName: String(r[4]).trim(),
      mobile: String(r[5] || '').trim().replace(/\.0$/, ''),
    }))
    .filter(s => s.schoolName);

  const submByUdise = {};
  (submRes.values || []).filter(r => r[7]).forEach(r => {
    const key = normUdise(r[3]);
    if (!submByUdise[key]) submByUdise[key] = [];
    submByUdise[key].push({
      activityNum: r[6], activityName: r[7],
      fromDate: r[8] || '', toDate: r[9] || '',
      boys: r[10] || 0, girls: r[11] || 0, teachers: r[12] || 0,
      timestamp: r[0] || '',
    });
  });

  const rows = schools.map(s => {
    const subs = submByUdise[normUdise(s.udise)] || [];
    return { ...s, activityCount: subs.length, activities: subs };
  });
  const submitted = rows.filter(r => r.activityCount > 0).length;
  return { success: true, data: rows, total: rows.length, submitted, pending: rows.length - submitted };
}

// ================================================================
// Save Activity to Sheets
// ================================================================
async function saveActivity(formData, env) {
  const boys     = parseInt(formData.boys)     || 0;
  const girls    = parseInt(formData.girls)    || 0;
  const teachers = parseInt(formData.teachers) || 0;

  const row = [
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    formData.district, formData.schoolName, formData.udise,
    formData.principalName, formData.mobile,
    formData.activityNum, formData.activityName,
    formData.activityFromDate, formData.activityToDate,
    boys, girls, teachers, boys + girls,
    (formData.photoUrls || []).join('\n'), '',
  ];

  await sheetsAppend(`${RESPONSES_SHEET}!A:P`, [row], env);
  return { success: true };
}

// ================================================================
// Google Drive — Upload Photo / PDF
// ================================================================
async function uploadPhoto(body, env) {
  const token = await getAccessToken(env);
  const { base64Data, mimeType, fileName, district, udise, schoolName, activityName } = body;

  const distId = await getOrCreateFolder(sanitize(district),                    env.PHOTOS_FOLDER_ID, token);
  const schId  = await getOrCreateFolder(sanitize(udise + '_' + schoolName),    distId,               token);
  const actId  = await getOrCreateFolder(sanitize(activityName),                schId,                token);

  const fileId = await uploadFileToDrive(base64Data, mimeType, fileName, actId, token);
  await makePublic(fileId, token);

  return { success: true, url: `https://drive.google.com/file/d/${fileId}/view`, fileId };
}

async function getOrCreateFolder(name, parentId, token) {
  const q   = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.files && data.files.length > 0) return data.files[0].id;

  const cr  = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const folder = await cr.json();
  if (!folder.id) throw new Error('Folder creation failed: ' + JSON.stringify(folder));
  return folder.id;
}

async function uploadFileToDrive(base64Data, mimeType, fileName, folderId, token) {
  const boundary = 'bound_' + Date.now();
  const meta     = JSON.stringify({ name: fileName, parents: [folderId] });
  const enc      = new TextEncoder();

  const parts = [
    enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    enc.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
    enc.encode(base64Data),
    enc.encode(`\r\n--${boundary}--`),
  ];

  let len = 0;
  for (const p of parts) len += p.length;
  const body = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { body.set(p, off); off += p.length; }

  const res  = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const file = await res.json();
  if (!file.id) throw new Error('Drive upload failed: ' + JSON.stringify(file));
  return file.id;
}

async function makePublic(fileId, token) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
}

function sanitize(s) {
  return String(s).replace(/[/\\:*?"<>|']/g, '_').trim().substring(0, 80);
}
