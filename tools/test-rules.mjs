/* 보안 규칙 테스트 (에뮬레이터 전용)
   1) npm run emulators   2) node tools/test-rules.mjs
   실제 Firebase에는 접속하지 않습니다. 테스트 계정은 에뮬레이터 안에서만 만들어집니다. */
const P = 'demo-kwasa';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
let pass = 0, fail = 0;

const RUN = Date.now().toString(36);   // 여러 번 실행해도 계정이 겹치지 않게
async function signUp(email) {
  email = email.replace('@', '+' + RUN + '@');
  const r = await fetch(`${AUTH}/accounts:signUp?key=test`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test1234', returnSecureToken: true }) });
  const j = await r.json(); return { uid: j.localId, token: j.idToken };
}
// JS 값 → Firestore REST 값
function val(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
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
  // allow404: 허용됐지만 문서가 없음 (403이 아니면 규칙 통과)
  const s = await p, ok = want === 'allow' ? s === 200 : want === 'allow404' ? s === 404 : s === 403;
  ok ? pass++ : fail++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : `  (기대: ${want}, 결과: HTTP ${s})`));
}

const a = await signUp('rules-a@test.local'), b = await signUp('rules-b@test.local'), admin = await signUp('rules-admin@test.local');
await req('PATCH', `admins/${admin.uid}`, 'owner', { role: 'admin' });   // 'owner' = 에뮬레이터 관리자 권한(규칙 우회)

const app = (uid, extra = {}) => ({ uid, kind: 'join', tier: 'general', fee: 20000, receiptStatus: '대기', status: '접수',
  applicant: { name: 'A', birth: '1990-01-01', phone: '010', email: 'a@x' }, depositor: 'A', ...extra });

console.log('\n[멤버십 신청서]');
await expect('본인 신청서 제출', 'allow', req('PATCH', `membershipApplications/${RUN}a1`, a.token, app(a.uid)));
await expect('로그인 없이 제출', 'deny', req('PATCH', `membershipApplications/${RUN}x1`, null, app(a.uid)));
await expect('남의 uid로 제출', 'deny', req('PATCH', `membershipApplications/${RUN}a2`, a.token, app(b.uid)));
await expect('처음부터 "활성화" 상태로 제출', 'deny', req('PATCH', `membershipApplications/${RUN}a3`, a.token, app(a.uid, { status: '활성화' })));
await expect('회원번호를 직접 넣어 제출', 'deny', req('PATCH', `membershipApplications/${RUN}a4`, a.token, app(a.uid, { memberNo: 'KWSA-F-2026-9999' })));
await expect('증빙을 "발급" 상태로 제출', 'deny', req('PATCH', `membershipApplications/${RUN}a5`, a.token, app(a.uid, { receiptStatus: '발급' })));
await expect('잘못된 등급(vip)으로 제출', 'deny', req('PATCH', `membershipApplications/${RUN}a6`, a.token, app(a.uid, { tier: 'vip' })));
await expect('본인 신청서 읽기', 'allow', req('GET', `membershipApplications/${RUN}a1`, a.token));
await expect('남의 신청서 읽기', 'deny', req('GET', `membershipApplications/${RUN}a1`, b.token));
await expect('본인이 금액 바꾸기', 'deny', req('PATCH', `membershipApplications/${RUN}a1`, a.token, { fee: 0 }, ['fee']));
await expect('본인이 스스로 "활성화"로 바꾸기', 'deny', req('PATCH', `membershipApplications/${RUN}a1`, a.token, { status: '활성화' }, ['status']));
await expect('관리자가 신청서 읽기', 'allow', req('GET', `membershipApplications/${RUN}a1`, admin.token));
await expect('본인이 "접수" 신청 취소', 'allow', req('PATCH', `membershipApplications/${RUN}a1`, a.token, { status: '취소' }, ['status']));
await expect('취소한 신청을 다시 "접수"로', 'deny', req('PATCH', `membershipApplications/${RUN}a1`, a.token, { status: '접수' }, ['status']));

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

console.log('\n[온라인 학습]');
const c = await signUp('rules-c@test.local');   // 수강생
const future = new Date(Date.now() + 30 * 86400000), past = new Date(Date.now() - 86400000);
await req('PATCH', 'courses/cx', 'owner', { title: '테스트 과정', open: true, chapters: [{ id: 'ch1', title: '1장', type: 'text' }] });
await req('PATCH', 'courses/cx/chapters/ch1', 'owner', { body: '본문' });
await req('PATCH', 'courseExams/cx', 'owner', { questions: [{ id: 'q1', question: '?', options: ['a', 'b', 'c', 'd'], answer: 2 }] });
await req('PATCH', `examAttempts/${RUN}at1`, 'owner', { uid: c.uid, courseId: 'cx', status: 'started' });
const enr = `enrollments/${c.uid}_cx`;
await expect('누구나 과정 정보 읽기', 'allow', req('GET', 'courses/cx', null));
await expect('아직 없는 내 수강 기록 조회(수강 전 확인)', 'allow404', req('GET', enr, c.token));
await expect('아직 없는 남의 수강 기록 조회', 'deny', req('GET', `enrollments/${b.uid}_cx`, c.token));
await expect('수강 전 챕터 본문 읽기', 'deny', req('GET', 'courses/cx/chapters/ch1', c.token));
await expect('수강생이 스스로 수강 등록', 'deny', req('PATCH', enr, c.token, { uid: c.uid, courseId: 'cx', status: 'active', endAt: future, progress: {} }));
await req('PATCH', enr, 'owner', { uid: c.uid, courseId: 'cx', status: 'active', endDate: '2099-01-01', endAt: future, progress: {} });
await expect('수강 중 챕터 본문 읽기', 'allow', req('GET', 'courses/cx/chapters/ch1', c.token));
await expect('다른 회원이 챕터 본문 읽기', 'deny', req('GET', 'courses/cx/chapters/ch1', b.token));
await expect('수강생이 정답(문제 은행) 읽기', 'deny', req('GET', 'courseExams/cx', c.token));
await expect('수강생이 진도 기록', 'allow', req('PATCH', enr, c.token, { progress: { ch1: true } }, ['progress']));
await expect('수강생이 스스로 "수료" 처리', 'deny', req('PATCH', enr, c.token, { status: 'passed' }, ['status']));
await expect('수강생이 수강 기간 늘리기', 'deny', req('PATCH', enr, c.token, { endAt: new Date(Date.now() + 999 * 86400000) }, ['endAt']));
await expect('다른 회원이 남의 진도 수정', 'deny', req('PATCH', enr, b.token, { progress: { ch1: true } }, ['progress']));
await expect('수강생이 응시 기록 쓰기(점수 조작)', 'deny', req('PATCH', `examAttempts/${RUN}at1`, c.token, { score: 100, passed: true }, ['score', 'passed']));
await expect('본인 응시 기록 읽기', 'allow', req('GET', `examAttempts/${RUN}at1`, c.token));
await expect('남의 응시 기록 읽기', 'deny', req('GET', `examAttempts/${RUN}at1`, b.token));
await req('PATCH', enr, 'owner', { uid: c.uid, courseId: 'cx', status: 'active', endDate: '2000-01-01', endAt: past, progress: {} });
await expect('수강 기간이 끝난 뒤 챕터 읽기', 'deny', req('GET', 'courses/cx/chapters/ch1', c.token));
await expect('수강 기간이 끝난 뒤 진도 기록', 'deny', req('PATCH', enr, c.token, { progress: { ch1: true } }, ['progress']));

console.log('\n[교육 이수 결과]');
const compId = `completions/${RUN}comp1`;
await expect('수강생이 스스로 "이수" 기록', 'deny', req('PATCH', compId, c.token, { uid: c.uid, result: '이수', certNo: 'KWSA-ED-2026-9999' }));
await expect('관리자가 이수 기록', 'allow', req('PATCH', compId, admin.token, { uid: c.uid, result: '이수', score: 90, certNo: 'KWSA-ED-2026-0001' }));
await expect('본인 이수 기록 읽기', 'allow', req('GET', compId, c.token));
await expect('남의 이수 기록 읽기', 'deny', req('GET', compId, b.token));
await expect('수강생이 점수 고치기', 'deny', req('PATCH', compId, c.token, { score: 100 }, ['score']));
await expect('일반 회원이 이수번호 일련번호 바꾸기', 'deny', req('PATCH', 'counters/eduCert', c.token, { year: '2026', seq: 0 }));

console.log('\n[교육 신청서 증빙]');
const courseApp = (extra = {}) => ({ uid: c.uid, status: '접수완료', items: [], total: 0, ...extra });
await expect('증빙 "발급 대기"로 교육 신청', 'allow', req('PATCH', `applications/${RUN}ap1`, c.token, courseApp({ receiptStatus: '대기' })));
await expect('증빙을 "발급"으로 교육 신청', 'deny', req('PATCH', `applications/${RUN}ap2`, c.token, courseApp({ receiptStatus: '발급' })));
await expect('승인번호를 넣어 교육 신청', 'deny', req('PATCH', `applications/${RUN}ap3`, c.token, courseApp({ receiptNo: 'X' })));

console.log('\n[협회 자격]');
const qd = `qualifications/KWSA-CS-${RUN}`, vd = `qualVerify/${RUN}hash`;
await expect('회원이 스스로 자격 발급', 'deny', req('PATCH', qd, c.token, { uid: c.uid, typeId: 'clothed', status: 'active', expiresOn: '2099-01-01' }));
await expect('관리자가 자격 발급', 'allow', req('PATCH', qd, admin.token, { uid: c.uid, typeId: 'clothed', name: 'C', status: 'active', issuedOn: '2026-10-10', expiresOn: '2028-10-09' }));
await expect('본인 자격 읽기', 'allow', req('GET', qd, c.token));
await expect('남의 자격 읽기', 'deny', req('GET', qd, b.token));
await expect('로그인 없이 자격 원장 읽기', 'deny', req('GET', qd, null));
await expect('회원이 유효기간 늘리기', 'deny', req('PATCH', qd, c.token, { expiresOn: '2099-01-01' }, ['expiresOn']));
await expect('관리자가 공개 확인 문서 작성', 'allow', req('PATCH', vd, admin.token, { certNo: 'KWSA-CS-X', maskedName: 'C', status: 'active' }));
await expect('로그인 없이 자격 확인 조회', 'allow', req('GET', vd, null));
await expect('로그인 없이 없는 자격 조회', 'allow404', req('GET', `qualVerify/${RUN}none`, null));
await expect('자격 확인 목록 전체 조회', 'deny', req('GET', 'qualVerify', null));
await expect('회원이 공개 확인 문서 위조', 'deny', req('PATCH', `qualVerify/${RUN}fake`, c.token, { certNo: 'FAKE', status: 'active' }));
await expect('회원이 자격번호 일련번호 바꾸기', 'deny', req('PATCH', 'counters/qual_clothed', c.token, { year: '2026', seq: 0 }));

console.log(`\n결과: 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
