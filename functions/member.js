/* 회원 서비스 서버 함수 (서울 리전)
   - getResourceFile: 자료실 파일 받기. 받을 때마다 등급을 확인하고 파일 내용을 직접 돌려줌 (파일 주소가 새어 나가도 받을 수 없음)
   - getPartnerCodes: 제휴 할인 코드 보기. 등급에 맞는 코드만 돌려줌
   알림 메일·매일 안내는 functions-mail/ (따로 배포) 에 있습니다. */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const GRACE_DAYS = 30;            // assets/js/membership-config.js 의 graceDays 와 같게
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const db = () => getFirestore();

/* ---------- 날짜 (한국 시간) ---------- */
function kstYmd(d = new Date()) { return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
function addDays(ymd, n) { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }

/* ---------- 등급 확인 (화면의 hasBenefits 와 같은 기준: 활성 또는 만료 후 유예 기간) ---------- */
async function memberLevel(uid) {
  const m = (await db().doc('memberships/' + uid).get()).data();
  if (!m || !m.endDate || m.suspended) return 'all';
  if (kstYmd() > addDays(m.endDate, GRACE_DAYS)) return 'all';
  return m.tier === 'full' ? 'full' : 'paid';
}
const RANK = { all: 0, paid: 1, full: 2 };
const allowed = (need, have) => RANK[have] >= RANK[need || 'all'];
async function isAdmin(uid) { return (await db().doc('admins/' + uid).get()).exists; }

exports.getResourceFile = onCall({ memory: '512MiB' }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const id = String((req.data || {}).id || '');
  const snap = await db().doc('resources/' + id).get();
  if (!id || !snap.exists) throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');
  const r = snap.data();
  const admin = await isAdmin(req.auth.uid);
  if (!admin && r.open === false) throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');
  if (!admin && !allowed(r.level, await memberLevel(req.auth.uid))) {
    throw new HttpsError('permission-denied', r.level === 'full' ? '정회원만 받을 수 있는 자료입니다.' : '일반회원 이상만 받을 수 있는 자료입니다.');
  }
  // 올릴 때 기록한 저장소(버킷)에서 읽음
  const file = (r.bucket ? getStorage().bucket(r.bucket) : getStorage().bucket()).file(r.path);
  const [meta] = await file.getMetadata().catch(() => [null]);
  if (!meta) throw new HttpsError('not-found', '파일이 없습니다. 협회에 문의해 주세요.');
  if (Number(meta.size) > MAX_FILE_BYTES) throw new HttpsError('failed-precondition', '파일이 너무 큽니다. 협회에 문의해 주세요.');
  const [buf] = await file.download();
  await snap.ref.update({ downloads: FieldValue.increment(1) }).catch(() => {});
  return { name: r.fileName, type: r.contentType || 'application/octet-stream', data: buf.toString('base64') };
});

exports.getPartnerCodes = onCall(async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const have = (await isAdmin(req.auth.uid)) ? 'full' : await memberLevel(req.auth.uid);
  const today = kstYmd();
  const [offers, codes] = await Promise.all([db().collection('partners').get(), db().collection('partnerCodes').get()]);
  const codeOf = Object.fromEntries(codes.docs.map(d => [d.id, d.data()]));
  const out = {};
  offers.docs.forEach(d => {
    const o = d.data();
    if (o.open === false || (o.validUntil && o.validUntil < today) || !allowed(o.level, have)) return;
    if (codeOf[d.id]) out[d.id] = { code: codeOf[d.id].code || '', howTo: codeOf[d.id].howTo || '' };
  });
  return { level: have, codes: out };
});
