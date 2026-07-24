const https = require('https');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'projects-general-fed41';
const FIREBASE_KEY = process.env.FIREBASE_KEY;
const ADMIN_KEY = process.env.PREMIUM_ADMIN_KEY || process.env.ADMIN_KEY || process.env.REVIEWS_ADMIN_KEY;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
}

function normalizePhone(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function maskPhone(phone) {
  const p = normalizePhone(phone);
  if (p.length <= 4) return p;
  const start = p.slice(0, 4);
  const end = p.slice(-4);
  return `${start}${'*'.repeat(Math.max(3, p.length - 8))}${end}`;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function nowBrazil() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd || todayYmd()).split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function addMonthsYmd(ymd, months) {
  const [y, m, d] = String(ymd || todayYmd()).split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCMonth(date.getUTCMonth() + Number(months || 1));
  return date.toISOString().slice(0, 10);
}

function isFutureOrToday(ymd) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(ymd || '')) && String(ymd) >= todayYmd();
}

function inferMonths(plan, months) {
  const n = Number(months);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  const p = String(plan || '').toLowerCase();
  if (p.includes('ano') || p.includes('12')) return 12;
  if (p.includes('6')) return 6;
  if (p.includes('3')) return 3;
  return 1;
}

function toFirestoreValue(value) {
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (value && typeof value === 'object') {
    const fields = {};
    Object.keys(value).forEach(k => { fields[k] = toFirestoreValue(value[k]); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value == null ? '' : value) };
}

function fromFirestoreValue(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) return fromFirestoreFields(v.mapValue.fields || {});
  return undefined;
}

function fromFirestoreFields(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(k => { out[k] = fromFirestoreValue(fields[k]); });
  return out;
}

function makeDocument(payload) {
  const fields = {};
  Object.keys(payload).forEach(k => { fields[k] = toFirestoreValue(payload[k]); });
  return { fields };
}

function httpJson(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      method,
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(options, resp => {
      let raw = '';
      resp.on('data', chunk => raw += chunk);
      resp.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch(e) {}
        if (resp.statusCode >= 200 && resp.statusCode < 300) resolve(json);
        else reject(new Error((json && (json.error?.message || json.error)) || `HTTP ${resp.statusCode}`));
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function docIdForPhone(phone) {
  return normalizePhone(phone);
}

async function listUsers() {
  const url = `${BASE_URL}/users?key=${FIREBASE_KEY}`;
  const data = await httpJson('GET', url);
  return (data.documents || []).map(doc => ({ id: String(doc.name || '').split('/').pop(), data: fromFirestoreFields(doc.fields || {}) }));
}

async function getUserByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  try {
    const url = `${BASE_URL}/users/${docIdForPhone(normalized)}?key=${FIREBASE_KEY}`;
    const doc = await httpJson('GET', url);
    if (doc && doc.fields) return { id: docIdForPhone(normalized), data: fromFirestoreFields(doc.fields) };
  } catch(e) {}
  const all = await listUsers();
  return all.find(u => normalizePhone(u.data.phone) === normalized) || null;
}

async function saveUser(phone, payload) {
  const id = docIdForPhone(phone);
  const url = `${BASE_URL}/users/${id}?key=${FIREBASE_KEY}`;
  const doc = makeDocument(payload);
  await httpJson('PATCH', url, doc);
  return { id, data: payload };
}

function isAdminRequest(req) {
  const key = req.headers['x-admin-key'] || req.body?.adminKey || req.query?.adminKey;
  return Boolean(ADMIN_KEY && key && key === ADMIN_KEY);
}

function getPlanAmount(plan, amount) {
  if (amount !== undefined && amount !== null && String(amount).trim()) return String(amount);
  const p = String(plan || '').toLowerCase();
  if (p.includes('ano') || p.includes('12')) return '400';
  if (p.includes('6')) return '200';
  if (p.includes('3')) return '100';
  return '35';
}


function cleanUserData(raw = {}) {
  const copy = { ...(raw || {}) };
  // Campos antigos/duplicados que não devem ser mantidos no documento canônico.
  delete copy.nome;
  delete copy.created_at;
  delete copy.pendingStatus;
  delete copy.expiration;
  delete copy.expiracao;
  delete copy.plano;
  return copy;
}


async function deleteUserByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return { deleted: false, found: false, id: '' };
  const user = await getUserByPhone(normalized);
  if (!user || !user.id) return { deleted: false, found: false, id: '' };
  const url = `${BASE_URL}/users/${user.id}?key=${FIREBASE_KEY}`;
  await httpJson('DELETE', url);
  return { deleted: true, found: true, id: user.id };
}


function normalizePendingRequest(data = {}) {
  const pr = data.pendingRequest && typeof data.pendingRequest === 'object' ? data.pendingRequest : null;
  if (pr && String(pr.status || '').toLowerCase() === 'pending_activation') {
    return {
      status: 'pending_activation',
      requestedPlan: pr.requestedPlan || '',
      requestedMonths: pr.requestedMonths || '',
      requestedAmount: pr.requestedAmount || '',
      lastRequestAt: pr.lastRequestAt || '',
      lastRequestAtBR: pr.lastRequestAtBR || '',
      name: pr.name || data.name || ''
    };
  }
  if (String(data.status || '').toLowerCase() === 'pending_activation') {
    return {
      status: 'pending_activation',
      requestedPlan: data.requestedPlan || '',
      requestedMonths: data.requestedMonths || '',
      requestedAmount: data.requestedAmount || '',
      lastRequestAt: data.lastRequestAt || '',
      lastRequestAtBR: data.lastRequestAtBR || data.requestedAtBR || '',
      name: data.name || ''
    };
  }
  return null;
}

function publicStatusFromUser(user) {
  if (!user) return { status: 'teste', plano: 'teste', tipo: 'evaluation', modo: 'TESTE' };
  const d = user.data || user;
  const expiration = d.project_expiration || d.expiration || '';
  const status = String(d.status || '').toLowerCase();
  const name = d.name || d.nome || 'Teste';
  const pendingRequest = normalizePendingRequest(d);

  const withPending = (payload) => pendingRequest ? { ...payload, pendingRequest } : payload;

  if (status === 'premium' && isFutureOrToday(expiration)) {
    return withPending({ nome: name, expiracao: expiration, status: 'premium', plano: 'premium', tipo: 'premium', modo: 'PREMIUM' });
  }
  if (status === 'premium' && expiration && !isFutureOrToday(expiration)) {
    return withPending({ nome: name, expiracao: expiration, status: 'expired', plano: 'premium', tipo: 'expired', modo: 'PREMIUM', expired: true });
  }
  if (status === 'expired') {
    return withPending({ nome: name, expiracao: expiration, status: 'expired', plano: 'premium', tipo: 'expired', modo: 'PREMIUM', expired: true });
  }
  if (status === 'pending_activation') {
    const pr = pendingRequest || {};
    return {
      nome: name,
      status: 'pending_activation',
      plano: 'premium',
      tipo: 'pending_activation',
      modo: 'TESTE',
      pending: true,
      requestedPlan: pr.requestedPlan || d.requestedPlan || '',
      requestedMonths: pr.requestedMonths || d.requestedMonths || '',
      requestedAmount: pr.requestedAmount || d.requestedAmount || '',
      lastRequestAt: pr.lastRequestAt || d.lastRequestAt || '',
      lastRequestAtBR: pr.lastRequestAtBR || d.lastRequestAtBR || d.requestedAtBR || ''
    };
  }
  if (status === 'cancelled') {
    return withPending({ nome: name, status: 'cancelled', plano: 'teste', tipo: 'cancelled', modo: 'TESTE' });
  }
  return withPending({ status: 'teste', plano: 'teste', tipo: 'evaluation', modo: 'TESTE' });
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch(e) { return {}; }
  }
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch(e) { resolve({}); }
    });
  });
}

module.exports = {
  setCors,
  normalizePhone,
  maskPhone,
  todayYmd,
  nowBrazil,
  addDaysYmd,
  addMonthsYmd,
  isFutureOrToday,
  inferMonths,
  getPlanAmount,
  getUserByPhone,
  saveUser,
  deleteUserByPhone,
  listUsers,
  isAdminRequest,
  publicStatusFromUser,
  normalizePendingRequest,
  cleanUserData,
  readBody
};
