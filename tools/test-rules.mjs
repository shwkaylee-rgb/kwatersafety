/* 보안 규칙 테스트 (에뮬레이터 전용)
   1) npm run emulators   2) node tools/test-rules.mjs
   실제 Firebase에는 접속하지 않습니다. 테스트 계정은 에뮬레이터 안에서만 만들어집니다. */
const P = 'demo-kwasa';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
let pass = 0, fail = 0;

async function signUp(email) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=test`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test1234', returnSecureToken: true }) });
  const j = await r.json(); return { uid: j.localId, token: j.idToken };
}
// JS 값 → Firestore REST 값
function val(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
}
const fields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));
async function req(method, path, token, body, mask) {
  const q = mask ? '?' + mask.map(m => 'updateMask.fieldPaths=' + m).join('&') : '';
  const r = await fetch(`${FS}/${path}${q}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify({ fields: fields(body) }) : undefined });
  return r.status;
}
async function expect(name, want, p) {
  const s = await p, ok = want === 'allow' ? s === 200 : s === 403;
  ok ? pass++ : fail++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : `  (기대: ${want}, 결과: HTTP ${s})`));
}

const a = await signUp('rules-a@test.local'), b = await signUp('rules-b@test.local'), admin = await signUp('rules-admin@test.local');
await req('PATCH', `admins/${admin.uid}`, 'owner', { role: 'admin' });   // 'owner' = 에뮬레이터 관리자 권한(규칙 우회)

const app = (uid, extra = {}) => ({ uid, kind: 'join', tier: 'general', fee: 20000, receiptStatus: '대기', status: '접수',
  applicant: { name: 'A', birth: '1990-01-01', phone: '010', email: 'a@x' }, depositor: 'A', ...extra });

console.log('\n[멤버십 신청서]');
await expect('본인 신청서 제출', 'allow', req('PATCH', 'membershipApplications/a1', a.token, app(a.uid)));
await expect('로그인 없이 제출', 'deny', req('PATCH', 'membershipApplications/x1', null, app(a.uid)));
await expect('남의 uid로 제출', 'deny', req('PATCH', 'membershipApplications/a2', a.token, app(b.uid)));
await expect('처음부터 "활성화" 상태로 제출', 'deny', req('PATCH', 'membershipApplications/a3', a.token, app(a.uid, { status: '활성화' })));
await expect('회원번호를 직접 넣어 제출', 'deny', req('PATCH', 'membershipApplications/a4', a.token, app(a.uid, { memberNo: 'KWSA-F-2026-9999' })));
await expect('증빙을 "발급" 상태로 제출', 'deny', req('PATCH', 'membershipApplications/a5', a.token, app(a.uid, { receiptStatus: '발급' })));
await expect('잘못된 등급(vip)으로 제출', 'deny', req('PATCH', 'membershipApplications/a6', a.token, app(a.uid, { tier: 'vip' })));
await expect('본인 신청서 읽기', 'allow', req('GET', 'membershipApplications/a1', a.token));
await expect('남의 신청서 읽기', 'deny', req('GET', 'membershipApplications/a1', b.token));
await expect('본인이 금액 바꾸기', 'deny', req('PATCH', 'membershipApplications/a1', a.token, { fee: 0 }, ['fee']));
await expect('본인이 스스로 "활성화"로 바꾸기', 'deny', req('PATCH', 'membershipApplications/a1', a.token, { status: '활성화' }, ['status']));
await expect('관리자가 신청서 읽기', 'allow', req('GET', 'membershipApplications/a1', admin.token));
await expect('본인이 "접수" 신청 취소', 'allow', req('PATCH', 'membershipApplications/a1', a.token, { status: '취소' }, ['status']));
await expect('취소한 신청을 다시 "접수"로', 'deny', req('PATCH', 'membershipApplications/a1', a.token, { status: '접수' }, ['status']));

console.log('\n[멤버십(회원 자격)]');
const ms = { tier: 'full', memberNo: 'KWSA-F-2026-0001', startDate: '2026-01-01', endDate: '2099-12-31', suspended: false };
await expect('본인이 스스로 정회원 만들기', 'deny', req('PATCH', `memberships/${a.uid}`, a.token, ms));
await expect('관리자가 멤버십 쓰기', 'allow', req('PATCH', `memberships/${a.uid}`, admin.token, ms));
await expect('본인 멤버십 읽기', 'allow', req('GET', `memberships/${a.uid}`, a.token));
await expect('남의 멤버십 읽기', 'deny', req('GET', `memberships/${a.uid}`, b.token));
await expect('본인이 만료일 늘리기', 'deny', req('PATCH', `memberships/${a.uid}`, a.token, { endDate: '2199-01-01' }, ['endDate']));
await expect('본인이 멤버십 삭제', 'deny', req('DELETE', `memberships/${a.uid}`, a.token));

console.log('\n[회원번호 일련번호]');
await expect('일반 회원이 일련번호 읽기', 'deny', req('GET', 'counters/membership', a.token));
await expect('일반 회원이 일련번호 바꾸기', 'deny', req('PATCH', 'counters/membership', a.token, { year: '2026', seq: 0 }));
await expect('관리자가 일련번호 쓰기', 'allow', req('PATCH', 'counters/membership', admin.token, { year: '2026', seq: 0 }));

console.log('\n[회원 정보·관리자]');
await expect('본인 회원정보 저장 (만 14세 확인 포함)', 'allow', req('PATCH', `users/${a.uid}`, a.token, { name: 'A', phone: '010', email: 'a@x', agreePrivacy: true, over14: true }));
await expect('회원정보에 허용 안 된 칸 추가', 'deny', req('PATCH', `users/${a.uid}`, a.token, { name: 'A', role: 'admin' }));
await expect('스스로 관리자 되기', 'deny', req('PATCH', `admins/${a.uid}`, a.token, { role: 'admin' }));
await expect('본인 탈퇴 (회원정보 삭제)', 'allow', req('DELETE', `users/${a.uid}`, a.token));

console.log(`\n결과: 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
