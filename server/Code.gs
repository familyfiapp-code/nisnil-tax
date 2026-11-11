/**
 * Nisnil Income Tax – server (Google Apps Script web app)
 * Owner account: familyfi.app@gmail.com. All data and documents live in that account's Google Drive,
 * in the folder "Nisnil Tax". Nothing secret is in this file.
 *
 * Setup (once): paste this file into a new Apps Script project under familyfi.app@gmail.com,
 * run setup() once and allow access, then Deploy > New deployment > Web app,
 * Execute as: Me, Who has access: Anyone. Copy the /exec URL into tax/config.js (TAX_API).
 */
var CLIENT_ID = '936218734453-udv7omdsocaokqe9ljjokgce25o4fgh4.apps.googleusercontent.com';
var OWNER = 'familyfi.app@gmail.com';
var ROOT_NAME = 'Nisnil Tax';
var MAX_FILE = 10 * 1024 * 1024;
var CLIENT_FIELDS = ['salary','savingsInt','fdInt','hpInterest','ltcg112A','stcg111A','d80C','d80D','tds','phone','notes','filledBy'];

var FEES_2026 = { 'ITR-1': 999, 'ITR-2': 1999, 'ITR-3': 2999, 'ITR-4': 1499 };

/** Public: GET ?fn=fees returns the current ITR fees for the nisnil.co.in/itr page. Nothing private is returned. */
function doGet(e) {
  if (e && e.parameter && e.parameter.fn === 'fees') {
    var db = read_();
    return out_({ ok: true, data: { fees: db.settings.fees, ay: db.settings.ay } });
  }
  return out_({ ok: true, data: 'Nisnil Income Tax server is running.' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'Bad request.' }); }
  try {
    var email = who_(req.token);
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      var db = read_();
      var me = roleOf_(db, email);
      var a = req.args || [], res;
      switch (req.fn) {
        case 'load': res = view_(db, me); break;
        case 'register': res = register_(db, me, a[0] || {}); break;
        case 'sync': res = sync_(db, me, a[0] || {}); break;
        case 'upload': res = upload_(db, me, a[0] || {}); break;
        case 'getFile': res = getFile_(db, me, a[0] || {}); break;
        default: throw err_('Unknown action.');
      }
      return out_({ ok: true, data: res });
    } finally { lock.releaseLock(); }
  } catch (x) {
    return out_({ ok: false, error: (x && x.message) || String(x), code: x && x.code });
  }
}

/* ---------- identity ---------- */
function who_(tok) {
  if (!tok) throw err_('Please sign in.', 'AUTH');
  var cache = CacheService.getScriptCache();
  var key = 't_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, tok)).slice(0, 40);
  var hit = cache.get(key);
  if (hit) return hit;
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(tok), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw err_('Your sign-in expired. Please sign in again.', 'AUTH');
  var j = JSON.parse(r.getContentText());
  if (j.aud !== CLIENT_ID && j.azp !== CLIENT_ID) throw err_('This sign-in is not for Nisnil.', 'AUTH');
  if (!j.email || String(j.email_verified) !== 'true') throw err_('Google did not confirm this email.', 'AUTH');
  var em = String(j.email).toLowerCase();
  cache.put(key, em, 300);
  return em;
}
function roleOf_(db, email) {
  if (email === OWNER) return { role: 'owner', email: email, name: 'Owner' };
  var t = (db.team || []).filter(function (x) { return String(x.email).toLowerCase() === email; })[0];
  if (t && t.active) return { role: 'employee', email: email, name: t.name };
  if (t && !t.active) return { role: 'blocked', email: email, name: t.name };
  return { role: 'client', email: email, name: email };
}

/* ---------- storage ---------- */
function rootFolder_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('ROOT_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var it = DriveApp.getFoldersByName(ROOT_NAME);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
  p.setProperty('ROOT_ID', f.getId());
  return f;
}
function sub_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function dataFile_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('DATA_ID');
  if (id) { try { return DriveApp.getFileById(id); } catch (x) {} }
  var root = rootFolder_(), it = root.getFilesByName('nisnil-tax-data.json');
  var f = it.hasNext() ? it.next() : root.createFile('nisnil-tax-data.json', JSON.stringify(blank_()), 'application/json');
  p.setProperty('DATA_ID', f.getId());
  return f;
}
function read_() {
  var db = JSON.parse(dataFile_().getBlob().getDataAsString() || '{}');
  var b = blank_();
  ['settings','team','clients','log'].forEach(function (k) { if (!db[k]) db[k] = b[k]; });
  if (!db.settings.feesV2) { db.settings.fees = Object.assign({}, FEES_2026); db.settings.feesV2 = true; dataFile_().setContent(JSON.stringify(db)); }
  return db;
}
function write_(db) {
  db.log = (db.log || []).slice(0, 1000);
  var f = dataFile_();
  f.setContent(JSON.stringify(db));
  var p = PropertiesService.getScriptProperties(), today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  if (p.getProperty('LAST_BACKUP') !== today) {
    f.makeCopy('backup-' + today + '.json', sub_(rootFolder_(), 'Backups'));
    p.setProperty('LAST_BACKUP', today);
  }
}
function blank_() {
  return {
    settings: { fees: Object.assign({}, FEES_2026), feesV2: true, ay: 'AY 2027-28', master: OWNER, vault: null, qr: null, qrNote: '', upi: '' },
    team: [], clients: [], log: []
  };
}
function now_() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM, hh:mm a'); }
function log_(db, me, x) { db.log.unshift({ t: now_(), who: me.role === 'client' ? 'Client · ' + me.email : me.name, x: String(x).slice(0, 300) }); }
function newClient_(db, f) {
  var base = { age: 'below60', salary: 0, exemptAllow: 0, profTax: 0, hpType: 'none', rent: 0, municipal: 0, hpInterest: 0, savingsInt: 0, fdInt: 0, dividend: 0, otherInc: 0, biz: 0, stcg111A: 0, ltcg112A: 0, ltcgOther: 0, stcgOther: 0, d80C: 0, d80CCD1B: 0, d80D: 0, d80G: 0, dOther: 0, d80CCD2: 0, tds: 0, tcs: 0, advTax: 0, saTax: 0, name: '', pan: '', email: '', phone: '', itr: 'ITR-1', notes: '' };
  var ff = Object.assign(base, f || {});
  return { id: Utilities.getUuid().slice(0, 8), f: ff, docs: [], prefill: false, comp: null, sent: false, approval: 'none', reason: '', pay: { state: 'unpaid', method: '', utr: '' }, fee: db.settings.fees[ff.itr] || 0, feeReq: null, credit: false, filed: null, everified: false, delivered: false, cred: null, payLink: '', itrv: null, created: now_() };
}

/* ---------- views ---------- */
function view_(db, me) {
  if (me.role === 'owner') return { me: me, db: db };
  if (me.role === 'employee') return { me: me, db: { settings: db.settings, team: [], clients: db.clients, log: [] } };
  if (me.role === 'blocked') return { me: me, db: null };
  var mine = db.clients.filter(function (c) { return String(c.f.email).toLowerCase() === me.email; }).map(function (c) {
    var x = JSON.parse(JSON.stringify(c)); delete x.cred; delete x.assigned; return x;
  });
  var s = db.settings;
  return { me: me, db: { settings: { fees: s.fees, ay: s.ay, qr: s.qr, upi: s.upi, qrNote: s.qrNote, master: s.master }, team: [], clients: mine, log: [] } };
}

function register_(db, me, p) {
  if (me.role !== 'client') throw err_('Only customers can start a return here.');
  var mine = db.clients.filter(function (c) { return String(c.f.email).toLowerCase() === me.email; });
  if (!mine.length) {
    var c = newClient_(db, { name: String(p.name || '').slice(0, 80) || me.email, phone: String(p.phone || '').slice(0, 20), email: me.email });
    db.clients.unshift(c);
    log_(db, me, 'New online customer started a return');
    write_(db);
  }
  return view_(db, me);
}

/* ---------- sync with permission rules ---------- */
function sync_(db, me, p) {
  if (me.role === 'blocked') throw err_('Your access is switched off. Ask the owner.');
  var byId = {}; db.clients.forEach(function (c, i) { byId[c.id] = i; });
  (p.clients || []).forEach(function (n) {
    if (!n || !n.id || !n.f) return;
    var i = byId[n.id], old = i === undefined ? null : db.clients[i];
    if (me.role === 'client') {
      if (!old || String(old.f.email).toLowerCase() !== me.email) throw err_('You can only update your own return.');
      db.clients[i] = clientUpdate_(old, n);
      return;
    }
    if (me.role === 'employee') n = employeeCheck_(db, old, n);
    if (old) { n.docs = old.docs; n.itrv = old.itrv; n.folderId = old.folderId; } else { n.docs = []; n.itrv = null; n.folderId = null; }
    n.f.email = String(n.f.email || '').toLowerCase();
    if (i === undefined) { db.clients.unshift(n); byId[n.id] = 0; db.clients.forEach(function (c, k) { byId[c.id] = k; }); }
    else db.clients[i] = n;
  });
  if ((p.deleted || []).length) {
    if (me.role !== 'owner') throw err_('Only the owner can delete clients.');
    db.clients = db.clients.filter(function (c) { return p.deleted.indexOf(c.id) < 0; });
  }
  if (p.settings) {
    if (me.role === 'owner') db.settings = Object.assign(db.settings, p.settings, { master: db.settings.master });
    else if (me.role === 'employee') ['qr','upi','qrNote'].forEach(function (k) { if (k in p.settings) db.settings[k] = p.settings[k]; });
    else throw err_('Not allowed.');
    if (!p.settings.vault && db.settings.vault && me.role !== 'owner') { /* keep */ }
  }
  if (p.team) {
    if (me.role !== 'owner') throw err_('Only the owner can change team access.');
    db.team = p.team.map(function (t) { return { name: String(t.name).slice(0, 60), email: String(t.email).toLowerCase(), active: !!t.active }; });
  }
  (p.notes || []).slice(0, 20).forEach(function (x) { log_(db, me, x); });
  write_(db);
  return view_(db, roleOf_(db, me.email));
}
function employeeCheck_(db, old, n) {
  var fee = db.settings.fees[n.f.itr] || 0;
  if (!old) { n.pay = { state: 'unpaid', method: '', utr: '' }; n.feeReq = null; n.credit = false; n.fee = fee; n.payLink = ''; return n; }
  if (n.pay && n.pay.state === 'paid' && old.pay.state !== 'paid') throw err_('Only the owner can confirm a payment.');
  var a = old.feeReq, b = n.feeReq;
  if (b && b.state !== 'pending' && !(a && a.state === b.state && a.type === b.type && a.amount === b.amount)) throw err_('Only the owner can approve a fee change.');
  if (n.credit && !old.credit) throw err_('Only the owner can allow pay-after-filing.');
  if (n.fee !== old.fee && n.fee !== fee) throw err_('Only the owner can change a fee.');
  n.payLink = old.payLink || '';
  return n;
}
function clientUpdate_(old, n) {
  var c = JSON.parse(JSON.stringify(old)), changed = false;
  var norm = function (k, x) { return (k === 'phone' || k === 'notes' || k === 'filledBy') ? String(x == null ? '' : x).slice(0, 500) : Math.max(0, Number(x) || 0); };
  CLIENT_FIELDS.forEach(function (k) {
    if (!(k in n.f)) return;
    var v = norm(k, n.f[k]);
    if (norm(k, c.f[k]) !== v) { c.f[k] = v; if (k !== 'filledBy') changed = true; }
  });
  if (changed && c.comp && c.approval !== 'approved') { c.comp = null; c.sent = false; }
  if (old.sent && old.approval === 'none' && (n.approval === 'approved' || n.approval === 'rejected')) { c.approval = n.approval; c.reason = String(n.reason || '').slice(0, 300); }
  if (old.delivered && n.driveSaved && typeof n.driveSaved === 'object') c.driveSaved = { d: String(n.driveSaved.d || '').slice(0, 40), link: /^https:\/\/drive\.google\.com\//.test(String(n.driveSaved.link || '')) ? String(n.driveSaved.link).slice(0, 300) : '' };
  if (old.pay.state !== 'paid' && n.pay && n.pay.state === 'verifying' && n.pay.utr) c.pay = { state: 'verifying', method: String(n.pay.method || 'UPI QR').slice(0, 30), utr: String(n.pay.utr).slice(0, 40) };
  return c;
}

/* ---------- files ---------- */
function clientFolder_(db, c, kind) {
  var base = null;
  if (c.folderId) { try { base = DriveApp.getFolderById(c.folderId); } catch (x) {} }
  if (!base) {
    var ay = sub_(rootFolder_(), db.settings.ay || 'AY');
    base = sub_(ay, String(c.f.name || 'Client').replace(/[^\w\- ]/g, '').slice(0, 40) + ' (' + c.id + ')');
    c.folderId = base.getId();
  }
  return sub_(base, kind === 'itrv' ? '04_Filed' : '01_Docs');
}
function upload_(db, me, p) {
  var c = db.clients.filter(function (x) { return x.id === p.id; })[0];
  if (!c) throw err_('Client not found.');
  if (me.role === 'blocked') throw err_('Not allowed.');
  if (me.role === 'client' && (String(c.f.email).toLowerCase() !== me.email || p.kind === 'itrv')) throw err_('Not allowed.');
  var bytes = Utilities.base64Decode(String(p.b64 || ''));
  if (!bytes.length) throw err_('Empty file.');
  if (bytes.length > MAX_FILE) throw err_('File is over 10 MB.');
  var name = String(p.name || 'file').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 120);
  var file = clientFolder_(db, c, p.kind).createFile(Utilities.newBlob(bytes, String(p.mime || 'application/octet-stream'), name));
  if (p.kind === 'itrv') { c.itrv = { n: name, fid: file.getId(), d: now_() }; log_(db, me, 'Attached ITR-V for ' + c.f.name); }
  else { c.docs.push({ n: name, d: now_(), fid: file.getId(), by: me.role === 'client' ? 'Client' : me.name }); log_(db, me, 'Uploaded ' + name + ' for ' + c.f.name); }
  write_(db);
  return view_(db, me);
}
function getFile_(db, me, p) {
  var c = db.clients.filter(function (x) { return x.id === p.id; })[0];
  if (!c) throw err_('Client not found.');
  var ok = (c.docs || []).some(function (d) { return d.fid === p.fid; }) || (c.itrv && c.itrv.fid === p.fid);
  if (!ok) throw err_('File not found.');
  if (me.role === 'blocked' || (me.role === 'client' && String(c.f.email).toLowerCase() !== me.email)) throw err_('Not allowed.');
  var blob = DriveApp.getFileById(p.fid).getBlob();
  return { name: blob.getName(), mime: blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()) };
}

/* ---------- helpers ---------- */
function err_(m, code) { var e = new Error(m); if (code) e.code = code; return e; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run once from the editor to create the Drive folder and data file and grant permissions. */
function setup() {
  var f = dataFile_();
  UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=x', { muteHttpExceptions: true });
  Logger.log('Ready. Data file: ' + f.getUrl());
}
