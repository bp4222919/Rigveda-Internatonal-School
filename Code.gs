/**
 * ================================================================
 *  RIGVEDA INTERNATIONAL SCHOOL — Google Apps Script Backend v2
 * ================================================================
 *  SETUP:
 *  1. script.google.com → New Project → paste this file
 *  2. Set SPREADSHEET_ID below  (from Sheet URL → .../d/YOUR_ID/edit)
 *  3. Deploy → New Deployment → Web App
 *     • Execute as: Me  |  Access: Anyone
 *  4. Copy Web App URL → paste in Script.js → WEB_APP_URL
 * ================================================================
 */

// ================================================================
// CONFIGURATION
// ================================================================
const SPREADSHEET_ID = "14JryILNxfMFLZhnXhaFBULKPwpiyGzC4anosfO8S8GI";

const SHEET = {
  USERS      : "Users",
  CLASSES    : "Classes",
  STUDENTS   : "Students",
  FIELD_DEFS : "FieldDefs"
};

// Column indices (1-based)
const U  = { USERNAME:1, PASSWORD:2, ROLE:3, ACLASS:4, ASECTION:5 };
const C  = { CLASS:1, SECTION:2 };
const S  = {
  ID:1, ADM_DATE:2, ADM_NO:3, NAME:4, GENDER:5, DOB:6,
  AADHAR:7, CATEGORY:8, BLOOD:9, HEIGHT:10, WEIGHT:11,
  FNAME:12, FAADHAR:13, MNAME:14, MAADHAR:15,
  PHONE1:16, PHONE2:17, ADDRESS:18, PREV_SCHOOL:19,
  CLASS:20, SECTION:21,
  CUSTOM_JSON:22   // all custom-field values stored as JSON in one cell
};
const FD = { ID:1, NAME:2, TYPE:3, OPTIONS:4, REQUIRED:5, ORDER:6 };

const STUDENT_HEADERS  = [
  "StudentID","AdmissionDate","AdmissionNo","StudentName","Gender","DateOfBirth",
  "AadharNo","Category","BloodGroup","Height_cm","Weight_kg",
  "FatherName","FatherAadhar","MotherName","MotherAadhar",
  "Phone1","Phone2","Address","PreviousSchool","Class","Section","CustomFields"
];
const USER_HEADERS     = ["Username","Password","Role","AssignedClass","AssignedSection"];
const CLASS_HEADERS    = ["Class","Section"];
const FIELDDEF_HEADERS = ["FieldID","Name","Type","Options","Required","Order"];

// ================================================================
// CORE HELPERS
// ================================================================
let _ss = null;
function getSS() {
  if (!_ss) _ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return _ss;
}

function getSheet(name) {
  const ss    = getSS();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    let h;
    switch (name) {
      case SHEET.STUDENTS  : h = STUDENT_HEADERS;   break;
      case SHEET.USERS     : h = USER_HEADERS;       break;
      case SHEET.CLASSES   : h = CLASS_HEADERS;      break;
      case SHEET.FIELD_DEFS: h = FIELDDEF_HEADERS;   break;
    }
    if (h) {
      sheet.appendRow(h);
      sheet.getRange(1,1,1,h.length)
           .setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
    if (name === SHEET.USERS) sheet.appendRow(["admin","admin123","Admin","",""]);
  }
  return sheet;
}

function jsonOk(data)  { return jsonOut({ status:"success", ...data }); }
function jsonErr(msg)  { return jsonOut({ status:"error",   message: msg }); }
function jsonOut(obj)  {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeStr(v) { return String(v == null ? "" : v).trim(); }
function parseJ(s, fb) { try { return JSON.parse(s); } catch(e) { return fb; } }

function readRows(sheet, cols) {
  const last = sheet.getLastRow();
  if (last <= 1) return [];
  return sheet.getRange(2, 1, last-1, cols).getValues();
}

function nextStudentId() {
  const sheet = getSheet(SHEET.STUDENTS);
  const last  = sheet.getLastRow();
  const year  = new Date().getFullYear();
  if (last <= 1) return `SCH-${year}-00001`;
  const ids = sheet.getRange(2, S.ID, last-1, 1).getValues().flat()
    .map(String).filter(id => id.startsWith(`SCH-${year}-`))
    .map(id => parseInt(id.split("-")[2]) || 0);
  const max = ids.length ? Math.max(...ids) : 0;
  return `SCH-${year}-${String(max+1).padStart(5,"0")}`;
}

function newFieldId() {
  return "fld_" + Date.now() + "_" + Math.random().toString(36).slice(2,5);
}

// ================================================================
// ROW → OBJECT
// ================================================================
function rowToStudent(row, rowIndex) {
  return {
    rowIndex,
    studentId    : safeStr(row[S.ID-1]),
    admissionDate: safeStr(row[S.ADM_DATE-1]),
    admissionNo  : safeStr(row[S.ADM_NO-1]),
    name         : safeStr(row[S.NAME-1]),
    gender       : safeStr(row[S.GENDER-1]),
    dob          : safeStr(row[S.DOB-1]),
    aadhar       : safeStr(row[S.AADHAR-1]),
    category     : safeStr(row[S.CATEGORY-1]),
    bloodGroup   : safeStr(row[S.BLOOD-1]),
    height       : safeStr(row[S.HEIGHT-1]),
    weight       : safeStr(row[S.WEIGHT-1]),
    fatherName   : safeStr(row[S.FNAME-1]),
    fatherAadhar : safeStr(row[S.FAADHAR-1]),
    motherName   : safeStr(row[S.MNAME-1]),
    motherAadhar : safeStr(row[S.MAADHAR-1]),
    phone1       : safeStr(row[S.PHONE1-1]),
    phone2       : safeStr(row[S.PHONE2-1]),
    address      : safeStr(row[S.ADDRESS-1]),
    prevSchool   : safeStr(row[S.PREV_SCHOOL-1]),
    class        : safeStr(row[S.CLASS-1]),
    section      : safeStr(row[S.SECTION-1]),
    customData   : parseJ(safeStr(row[S.CUSTOM_JSON-1]), {})
  };
}

function rowToUser(row, rowIndex) {
  return {
    rowIndex, username: safeStr(row[0]), password: safeStr(row[1]),
    role: safeStr(row[2]), assignedClass: safeStr(row[3]), assignedSection: safeStr(row[4])
  };
}

function rowToFieldDef(row, rowIndex) {
  return {
    rowIndex, id: safeStr(row[0]), name: safeStr(row[1]), type: safeStr(row[2]),
    options: safeStr(row[3]), required: safeStr(row[4]) === "true", order: parseInt(row[5]) || 0
  };
}

// ================================================================
// ROUTER
// ================================================================
function doGet(e) {
  try {
    const a = (e.parameter && e.parameter.action) || "";
    switch(a) {
      case "login"        : return handleLogin(e);
      case "getStudents"  : return handleGetStudents(e);
      case "getClasses"   : return handleGetClasses(e);
      case "getUsers"     : return handleGetUsers(e);
      case "getStats"     : return handleGetStats(e);
      case "getFieldDefs" : return handleGetFieldDefs(e);
      default             : return jsonErr("Unknown action: " + a);
    }
  } catch(err) { Logger.log(err.stack); return jsonErr(err.message); }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || "{}");
    switch(body.action) {
      case "addStudent"        : return handleAddStudent(body);
      case "updateStudent"     : return handleUpdateStudent(body);
      case "deleteStudent"     : return handleDeleteStudent(body);
      case "addClassSection"   : return handleAddClassSection(body);
      case "deleteClassSection": return handleDeleteClassSection(body);
      case "createUser"        : return handleCreateUser(body);
      case "updateUser"        : return handleUpdateUser(body);
      case "deleteUser"        : return handleDeleteUser(body);
      case "addFieldDef"       : return handleAddFieldDef(body);
      case "updateFieldDef"    : return handleUpdateFieldDef(body);
      case "deleteFieldDef"    : return handleDeleteFieldDef(body);
      case "reorderFieldDefs"  : return handleReorderFieldDefs(body);
      default                  : return jsonErr("Unknown action: " + body.action);
    }
  } catch(err) { Logger.log(err.stack); return jsonErr(err.message); }
}

// ================================================================
// GET HANDLERS
// ================================================================
function handleLogin(e) {
  const u = safeStr(e.parameter.username).toLowerCase();
  const p = safeStr(e.parameter.password);
  if (!u || !p) return jsonErr("Username and password required.");
  const sheet = getSheet(SHEET.USERS);
  const rows  = readRows(sheet, 5);
  for (let i = 0; i < rows.length; i++) {
    if (safeStr(rows[i][0]).toLowerCase() === u && safeStr(rows[i][1]) === p) {
      return jsonOk({ message:"Login successful", user:{
        username:safeStr(rows[i][0]), role:safeStr(rows[i][2]),
        assignedClass:safeStr(rows[i][3]), assignedSection:safeStr(rows[i][4]), rowIndex:i+2
      }});
    }
  }
  return jsonErr("Invalid username or password.");
}

function handleGetStudents(e) {
  const role = safeStr(e.parameter.role);
  const aCls = safeStr(e.parameter.assignedClass);
  const aSec = safeStr(e.parameter.assignedSection);
  const sheet = getSheet(SHEET.STUDENTS);
  const last  = sheet.getLastRow();
  if (last <= 1) return jsonOk({ students:[] });
  const cols = Math.max(S.CUSTOM_JSON, sheet.getLastColumn());
  let students = sheet.getRange(2,1,last-1,cols).getValues()
    .map((r,i) => rowToStudent(r, i+2)).filter(s => s.name !== "");
  if (role === "ClassIncharge")
    students = students.filter(s => s.class===aCls && s.section===aSec);
  return jsonOk({ students });
}

function handleGetClasses(e) {
  const sheet = getSheet(SHEET.CLASSES);
  const classes = readRows(sheet, 2)
    .map((r,i) => ({ rowIndex:i+2, class:safeStr(r[0]), section:safeStr(r[1]) }))
    .filter(c => c.class !== "");
  return jsonOk({ classes });
}

function handleGetUsers(e) {
  const sheet = getSheet(SHEET.USERS);
  const users = readRows(sheet, 5)
    .map((r,i) => rowToUser(r, i+2)).filter(u => u.username !== "");
  return jsonOk({ users });
}

function handleGetStats(e) {
  const role = safeStr(e.parameter.role);
  const aCls = safeStr(e.parameter.assignedClass);
  const aSec = safeStr(e.parameter.assignedSection);
  const sSh = getSheet(SHEET.STUDENTS);
  const cSh = getSheet(SHEET.CLASSES);
  const uSh = getSheet(SHEET.USERS);
  const sLast = sSh.getLastRow();
  let students = [];
  if (sLast > 1) {
    students = sSh.getRange(2,1,sLast-1,21).getValues()
      .map((r,i) => ({ rowIndex:i+2, name:safeStr(r[S.NAME-1]), class:safeStr(r[S.CLASS-1]), section:safeStr(r[S.SECTION-1]), admissionDate:safeStr(r[S.ADM_DATE-1]) }))
      .filter(s => s.name !== "");
  }
  if (role === "ClassIncharge") students = students.filter(s => s.class===aCls && s.section===aSec);
  const today = new Date().toISOString().slice(0,10);
  const bd = {};
  students.forEach(s => { const k=`${s.class} — ${s.section}`; bd[k]=(bd[k]||0)+1; });
  return jsonOk({ stats:{
    totalStudents:students.length, totalClasses:Math.max(0,cSh.getLastRow()-1),
    totalUsers:Math.max(0,uSh.getLastRow()-1),
    todayAdmissions:students.filter(s=>s.admissionDate===today).length, classBreakdown:bd
  }});
}

function handleGetFieldDefs(e) {
  const sheet = getSheet(SHEET.FIELD_DEFS);
  const defs  = readRows(sheet, 6)
    .map((r,i) => rowToFieldDef(r, i+2)).filter(f => f.name !== "")
    .sort((a,b) => a.order - b.order);
  return jsonOk({ fieldDefs:defs });
}

// ================================================================
// POST HANDLERS — Students
// ================================================================
function handleAddStudent(body) {
  const sheet  = getSheet(SHEET.STUDENTS);
  const last   = sheet.getLastRow();
  const admNo  = safeStr(body.admissionNo);
  if (admNo && last > 1) {
    const existing = sheet.getRange(2,S.ADM_NO,last-1,1).getValues().flat().map(String);
    if (existing.includes(admNo)) return jsonErr(`Admission No "${admNo}" already exists.`);
  }
  const id  = nextStudentId();
  const row = buildStudentRow(id, body);
  sheet.appendRow(row);
  Logger.log("Added: " + body.name + " " + id);
  return jsonOk({ message:"Student added successfully.", studentId:id });
}

function handleUpdateStudent(body) {
  const ri = parseInt(body.rowIndex);
  if (!ri || ri < 2) return jsonErr("Invalid row index.");
  const sheet = getSheet(SHEET.STUDENTS);
  if (ri > sheet.getLastRow()) return jsonErr("Row not found.");
  const existingId = sheet.getRange(ri, S.ID, 1,1).getValue();
  const row = buildStudentRow(existingId, body);
  sheet.getRange(ri, 1, 1, row.length).setValues([row]);
  return jsonOk({ message:"Student updated." });
}

function buildStudentRow(id, b) {
  return [
    id, safeStr(b.admissionDate), safeStr(b.admissionNo), safeStr(b.name),
    safeStr(b.gender), safeStr(b.dob), safeStr(b.aadhar), safeStr(b.category),
    safeStr(b.bloodGroup), safeStr(b.height), safeStr(b.weight),
    safeStr(b.fatherName), safeStr(b.fatherAadhar), safeStr(b.motherName),
    safeStr(b.motherAadhar), safeStr(b.phone1), safeStr(b.phone2),
    safeStr(b.address), safeStr(b.prevSchool), safeStr(b.class), safeStr(b.section),
    JSON.stringify(b.customData || {})
  ];
}

function handleDeleteStudent(body) {
  const ri = parseInt(body.rowIndex);
  if (!ri || ri < 2) return jsonErr("Invalid row index.");
  const sheet = getSheet(SHEET.STUDENTS);
  if (ri > sheet.getLastRow()) return jsonErr("Row not found.");
  sheet.deleteRow(ri);
  return jsonOk({ message:"Student deleted." });
}

// ================================================================
// POST HANDLERS — Classes
// ================================================================
function handleAddClassSection(body) {
  const cls = safeStr(body.class);
  const sec = safeStr(body.section);
  if (!cls || !sec) return jsonErr("Class and Section are required.");
  const sheet = getSheet(SHEET.CLASSES);
  const last  = sheet.getLastRow();
  if (last > 1) {
    const rows = sheet.getRange(2,1,last-1,2).getValues();
    if (rows.some(r => safeStr(r[0]).toLowerCase()===cls.toLowerCase() && safeStr(r[1]).toLowerCase()===sec.toLowerCase()))
      return jsonErr(`${cls} — ${sec} already exists.`);
  }
  sheet.appendRow([cls, sec]);
  return jsonOk({ message:`${cls} — ${sec} added.` });
}

function handleDeleteClassSection(body) {
  const ri = parseInt(body.rowIndex);
  if (!ri || ri < 2) return jsonErr("Invalid row index.");
  getSheet(SHEET.CLASSES).deleteRow(ri);
  return jsonOk({ message:"Class removed." });
}

// ================================================================
// POST HANDLERS — Users
// ================================================================
function handleCreateUser(body) {
  const username = safeStr(body.username).toLowerCase();
  const password = safeStr(body.password);
  const role     = safeStr(body.role);
  if (!username || !password || !role) return jsonErr("Username, password, and role are required.");
  if (!["Admin","ClassIncharge"].includes(role)) return jsonErr("Invalid role.");
  if (role==="ClassIncharge" && (!body.assignedClass || !body.assignedSection))
    return jsonErr("ClassIncharge requires assigned class and section.");
  const sheet = getSheet(SHEET.USERS);
  const last  = sheet.getLastRow();
  if (last > 1) {
    const ex = sheet.getRange(2,1,last-1,1).getValues().flat().map(v=>String(v).toLowerCase());
    if (ex.includes(username)) return jsonErr(`Username "${username}" already taken.`);
  }
  sheet.appendRow([username, password, role,
    role==="ClassIncharge"?safeStr(body.assignedClass):"",
    role==="ClassIncharge"?safeStr(body.assignedSection):""]);
  return jsonOk({ message:`User "${username}" created.` });
}

function handleUpdateUser(body) {
  const ri  = parseInt(body.rowIndex);
  if (!ri || ri < 2) return jsonErr("Invalid row index.");
  const newU = safeStr(body.username).toLowerCase();
  const newP = safeStr(body.password);
  const role = safeStr(body.role);
  if (!newU || !newP || !role) return jsonErr("Username, password, and role required.");
  const sheet = getSheet(SHEET.USERS);
  const last  = sheet.getLastRow();
  if (last > 1) {
    const rows = sheet.getRange(2,1,last-1,1).getValues();
    for (let i=0;i<rows.length;i++) {
      if ((i+2)===ri) continue;
      if (String(rows[i][0]).toLowerCase()===newU) return jsonErr(`Username "${newU}" is already taken.`);
    }
  }
  sheet.getRange(ri, 1,1,5).setValues([[newU, newP, role, safeStr(body.assignedClass), safeStr(body.assignedSection)]]);
  return jsonOk({ message:"User updated.", newUsername:newU });
}

function handleDeleteUser(body) {
  const ri = parseInt(body.rowIndex);
  if (!ri || ri < 2) return jsonErr("Invalid row index.");
  getSheet(SHEET.USERS).deleteRow(ri);
  return jsonOk({ message:"User deleted." });
}

// ================================================================
// POST HANDLERS — Field Definitions
// ================================================================
function handleAddFieldDef(body) {
  const name = safeStr(body.name);
  const type = safeStr(body.type) || "text";
  if (!name) return jsonErr("Field name required.");
  const valid = ["text","number","date","dropdown","textarea","checkbox","email","phone"];
  if (!valid.includes(type)) return jsonErr("Invalid field type.");
  const sheet = getSheet(SHEET.FIELD_DEFS);
  const last  = sheet.getLastRow();
  if (last > 1) {
    const names = sheet.getRange(2,FD.NAME,last-1,1).getValues().flat().map(v=>String(v).toLowerCase());
    if (names.includes(name.toLowerCase())) return jsonErr(`Field "${name}" already exists.`);
  }
  let maxOrd = 0;
  if (last > 1) {
    const ords = sheet.getRange(2,FD.ORDER,last-1,1).getValues().flat().map(Number);
    maxOrd = Math.max(0,...ords);
  }
  const id = newFieldId();
  sheet.appendRow([id, name, type, safeStr(body.options), body.required?"true":"false", maxOrd+1]);
  return jsonOk({ message:`Field "${name}" added.`, id });
}

function handleUpdateFieldDef(body) {
  const ri = parseInt(body.rowIndex);
  if (!ri || ri < 2) return jsonErr("Invalid row index.");
  const sheet = getSheet(SHEET.FIELD_DEFS);
  const id    = sheet.getRange(ri,FD.ID,1,1).getValue();
  sheet.getRange(ri,1,1,6).setValues([[
    id, safeStr(body.name), safeStr(body.type)||"text",
    safeStr(body.options), body.required?"true":"false", parseInt(body.order)||0
  ]]);
  return jsonOk({ message:"Field updated." });
}

function handleDeleteFieldDef(body) {
  const ri = parseInt(body.rowIndex);
  if (!ri || ri < 2) return jsonErr("Invalid row index.");
  getSheet(SHEET.FIELD_DEFS).deleteRow(ri);
  return jsonOk({ message:"Field deleted." });
}

function handleReorderFieldDefs(body) {
  const sheet  = getSheet(SHEET.FIELD_DEFS);
  const orders = body.order || [];
  orders.forEach(item => {
    const ri = parseInt(item.rowIndex);
    if (ri >= 2) sheet.getRange(ri, FD.ORDER,1,1).setValue(parseInt(item.order)||0);
  });
  return jsonOk({ message:"Order saved." });
}
