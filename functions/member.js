/* 회원 서비스 서버 함수 (서울 리전)
   - getResourceFile: 자료실 파일 받기. 받을 때마다 등급을 확인하고 파일 내용을 직접 돌려줌 (파일 주소가 새어 나가도 받을 수 없음)
   - getPartnerCodes: 제휴 할인 코드 보기. 등급에 맞는 코드만 돌려줌
   - mailOnNotification: 사이트 알림(notifications)이 생기면 같은 내용을 메일로 보냄
   - dailyReminders: 매일 아침 9시(한국 시간) 만료 안내·사전 설문 미제출·소식지 수신 2년 확인 알림을 만듦 (→ 메일도 자동 발송)
   메일은 구글 워크스페이스 계정(MAIL_FROM)으로 보내며, 앱 비밀번호는 비밀값 SMTP_PASS 에 넣습니다.
     npx firebase functions:secrets:set SMTP_PASS --project kwatersafety */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret, defineString } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const SMTP_PASS = defineSecret('SMTP_PASS');
const MAIL_FROM = defineString('MAIL_FROM', { default: 'support@kwatersafety.com' });
const SITE = 'https://kwasa.or.kr/';
const GRACE_DAYS = 30;            // assets/js/membership-config.js 의 graceDays 와 같게
const MKT_RECONFIRM_DAYS = 730;   // 소식지 수신 동의 2년 확인
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const db = () => getFirestore();

/* ---------- 날짜 (한국 시간) ---------- */
function kstYmd(d = new Date()) { return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
function addDays(ymd, n) { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
const firstDate = s => ((String(s || '').match(/\d{4}-\d{2}-\d{2}/) || [])[0]) || '';

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

/* ---------- 메일 ---------- */
let transport = null;
function mailer() {
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: MAIL_FROM.value(), pass: SMTP_PASS.value() } });
  }
  return transport;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const absLink = l => !l ? '' : /^https:\/\//.test(l) ? l : /^[a-z0-9-]+\.html/i.test(l) ? SITE + l : '';
function mailHtml(n) {
  const link = absLink(n.link);
  return '<div style="max-width:560px;margin:0 auto;font-family:\'Malgun Gothic\',sans-serif;color:#222;line-height:1.7">' +
    '<div style="background:#1f5fb0;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700">사단법인 대한수상안전협회</div>' +
    '<div style="border:1px solid #e5e8eb;border-top:0;padding:24px;border-radius:0 0 10px 10px">' +
      '<h2 style="font-size:19px;margin:0 0 12px">' + esc(n.title) + '</h2>' +
      (n.body ? '<p style="margin:0 0 18px;white-space:pre-line">' + esc(n.body) + '</p>' : '') +
      (link ? '<p><a href="' + esc(link) + '" style="display:inline-block;background:#3182f6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">바로 가기</a></p>' : '') +
      '<p style="margin-top:24px;font-size:12px;color:#888">이 메일은 발신 전용입니다. 문의: 010-3483-9209 · support@kwatersafety.com<br>' +
      '회원 서비스 이용에 관한 안내 메일로, 소식지 수신 동의와 관계없이 보내 드립니다. 받은 알림은 <a href="' + SITE + 'mypage.html#inbox">마이페이지 알림함</a>에서도 볼 수 있습니다.</p>' +
    '</div></div>';
}

exports.mailOnNotification = onDocumentCreated({ document: 'notifications/{id}', secrets: [SMTP_PASS] }, async event => {
  const snap = event.data;
  if (!snap) return;
  const n = snap.data();
  if (n.mailedAt || n.noMail) return;
  const user = (await db().doc('users/' + n.uid).get()).data();
  if (!user || !user.email) { await snap.ref.update({ mailError: '받는 사람 이메일 없음' }); return; }
  try {
    await mailer().sendMail({
      from: { name: '대한수상안전협회', address: MAIL_FROM.value() }, to: user.email,
      subject: '[대한수상안전협회] ' + n.title, html: mailHtml(n),
      text: n.title + '\n\n' + (n.body || '') + (absLink(n.link) ? '\n\n' + absLink(n.link) : '')
    });
    await snap.ref.update({ mailedAt: FieldValue.serverTimestamp() });
  } catch (e) {
    console.error('메일 발송 실패', e);
    await snap.ref.update({ mailError: String(e.message || e).slice(0, 300) });
  }
});

/* ---------- 매일 아침 안내 ---------- */
// 같은 안내를 두 번 보내지 않도록 reminderLog/{키} 에 기록
async function once(key, fn) {
  const ref = db().doc('reminderLog/' + key.replace(/\//g, '_'));
  if ((await ref.get()).exists) return false;
  await fn();
  await ref.set({ at: FieldValue.serverTimestamp() });
  return true;
}
const addNote = (uid, type, title, body, link) => db().collection('notifications').add({ uid, type, title, body, link, read: false, createdAt: FieldValue.serverTimestamp() });

async function runReminders(today = kstYmd()) {
  const sent = { membership: 0, qual: 0, online: 0, survey: 0, consent: 0 };
  const [ms, qs, es, ps, as, ss, mk] = await Promise.all(['memberships', 'qualifications', 'enrollments', 'programs', 'applications', 'surveys', 'marketingConsents']
    .map(c => db().collection(c).get()));

  // 멤버십: 만료 30일 전
  for (const d of ms.docs) {
    const m = d.data();
    if (!m.endDate || m.suspended) continue;
    const left = daysBetween(today, m.endDate);
    if (left < 0 || left > 30) continue;
    if (await once(`ms_${d.id}_${m.endDate}`, () => addNote(d.id, 'reminder', '멤버십이 ' + left + '일 뒤 만료됩니다',
      '회원번호 ' + (m.memberNo || '') + ' · 만료일 ' + m.endDate + '\n만료 후 ' + GRACE_DAYS + '일 안에 갱신하면 기간이 이어집니다.', 'membership-apply.html'))) sent.membership++;
  }
  // 자격: 만료 90일 전
  for (const d of qs.docs) {
    const q = d.data();
    if (!q.uid || q.status !== 'active' || !q.expiresOn) continue;
    const left = daysBetween(today, q.expiresOn);
    if (left < 0 || left > 90) continue;
    const title = q.typeName + (q.grade ? ' ' + q.grade : '');
    if (await once(`qual_${d.id}_${q.expiresOn}`, () => addNote(q.uid, 'reminder', '「' + title + '」 자격이 ' + left + '일 뒤 만료됩니다',
      '자격번호 ' + d.id + ' · 유효기간 ' + q.expiresOn + '까지\n갱신교육을 이수하면 유효기간이 2년 연장됩니다.', 'programs.html'))) sent.qual++;
  }
  // 온라인 수강: 기간 7일 전
  for (const d of es.docs) {
    const e = d.data();
    if (e.status !== 'active' || !e.endDate) continue;
    const left = daysBetween(today, e.endDate);
    if (left < 0 || left > 7) continue;
    if (await once(`enr_${d.id}_${e.endDate}`, () => addNote(e.uid, 'reminder', '「' + (e.courseTitle || '온라인 과정') + '」 수강 기간이 ' + left + '일 남았습니다',
      e.endDate + '까지 학습과 평가를 마쳐 주세요.', 'learn.html?course=' + encodeURIComponent(e.courseId)))) sent.online++;
  }
  // 사전 설문: 교육 3일 전까지 미제출
  const progs = Object.fromEntries(ps.docs.map(d => [d.id, d.data()]));
  const submitted = new Set(ss.docs.map(d => d.id));
  for (const d of as.docs) {
    const a = d.data();
    if (a.status !== '승인') continue;
    for (const i of a.items || []) {
      const p = progs[i.programId], start = p && firstDate(p.date);
      if (!p || !p.surveyOn || !start || submitted.has(d.id + '_' + i.programId)) continue;
      const left = daysBetween(today, start);
      if (left < 0 || left > 3) continue;
      if (await once(`sv_${d.id}_${i.programId}`, () => addNote(a.uid, 'reminder', '「' + i.title + '」 사전 설문을 제출해 주세요',
        '교육 시작 전에 건강 문진표를 제출해야 합니다.' + (a.applicant && a.applicant.guardianName ? ' (참가자 ' + a.applicant.name + ')' : ''),
        'survey.html?app=' + encodeURIComponent(d.id) + '&program=' + encodeURIComponent(i.programId)))) sent.survey++;
    }
  }
  // 소식지 수신 동의 2년 확인 (정보통신망법 시행령 제62조의3: 보내는 곳, 동의 날짜·사실, 유지·철회 방법 통지)
  for (const d of mk.docs) {
    const c = d.data();
    if (!(c.email || c.sms)) continue;
    const base = c.confirmedAt || c.agreedAt;
    if (!base || Date.now() - base.toMillis() < MKT_RECONFIRM_DAYS * 86400000) continue;
    const agreed = kstYmd((c.agreedAt || base).toDate());
    await addNote(d.id, 'consent', '소식지 수신 동의 확인 안내',
      '보내는 곳: 사단법인 대한수상안전협회\n회원님은 ' + agreed + '에 협회 소식지·행사 안내를 ' + [c.email ? '이메일' : '', c.sms ? '문자' : ''].filter(Boolean).join('·') +
      '로 받는 데 동의하셨습니다.\n계속 받으시려면 따로 하실 일은 없습니다. 받지 않으려면 마이페이지 > 내 정보 > 소식지·행사 안내 수신에서 해제해 주세요.', 'mypage.html#info');
    await d.ref.update({ confirmedAt: FieldValue.serverTimestamp() });   // 통지한 날부터 다시 2년
    sent.consent++;
  }
  return sent;
}

exports.dailyReminders = onSchedule({ schedule: 'every day 09:00', timeZone: 'Asia/Seoul' }, async () => {
  const sent = await runReminders();
  console.log('오늘 안내', JSON.stringify(sent));
});

// 관리자가 [지금 확인] 버튼으로 바로 실행 (테스트·누락 보충용)
exports.runRemindersNow = onCall(async req => {
  if (!req.auth || !(await isAdmin(req.auth.uid))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  return await runReminders();
});
