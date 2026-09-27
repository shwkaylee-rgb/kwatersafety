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

console.log('\n[알림 · 내 정보]');
const nd = `notifications/${RUN}n1`;
await expect('회원이 스스로 알림 만들기', 'deny', req('PATCH', `notifications/${RUN}nx`, c.token, { uid: c.uid, title: '가짜', read: false }));
await expect('관리자가 알림 보내기', 'allow', req('PATCH', nd, admin.token, { uid: c.uid, type: 'qual', title: '발급', read: false }));
await expect('본인 알림 읽기', 'allow', req('GET', nd, c.token));
await expect('남의 알림 읽기', 'deny', req('GET', nd, b.token));
await expect('본인이 읽음 표시', 'allow', req('PATCH', nd, c.token, { read: true }, ['read']));
await expect('본인이 알림 내용 바꾸기', 'deny', req('PATCH', nd, c.token, { title: '바꿈' }, ['title']));
await expect('남이 내 알림 삭제', 'deny', req('DELETE', nd, b.token));
await expect('본인 알림 삭제(탈퇴 시)', 'allow', req('DELETE', nd, c.token));
await expect('관리자가 전체 공지 보내기', 'allow', req('PATCH', `broadcasts/${RUN}b1`, admin.token, { target: 'all', title: '공지' }));
await expect('회원이 전체 공지 보내기', 'deny', req('PATCH', `broadcasts/${RUN}b2`, c.token, { target: 'all', title: '가짜 공지' }));
await expect('로그인 회원이 공지 읽기', 'allow', req('GET', `broadcasts/${RUN}b1`, c.token));
await expect('로그인 없이 공지 읽기', 'deny', req('GET', `broadcasts/${RUN}b1`, null));
await expect('본인 알림 읽음 기록 저장', 'allow', req('PATCH', `users/${c.uid}/state/inbox`, c.token, { broadcastReadAt: new Date() }));
await expect('남의 알림 읽음 기록 저장', 'deny', req('PATCH', `users/${c.uid}/state/inbox`, b.token, { broadcastReadAt: new Date() }));
await expect('내 정보에 생년월일 저장', 'allow', req('PATCH', `users/${c.uid}`, c.token, { name: 'C', phone: '010', email: 'c@x', birth: '1990-01-01' }));
await expect('내 정보에 허용 안 된 항목 저장', 'deny', req('PATCH', `users/${c.uid}`, c.token, { name: 'C', address: '서울' }));

console.log('\n[사전 설문 · 수신 동의]');
await req('PATCH', `applications/${RUN}sva`, 'owner', { uid: c.uid, status: '승인', items: [] });
await req('PATCH', `applications/${RUN}svb`, 'owner', { uid: b.uid, status: '승인', items: [] });
const sv = (appId, extra = {}) => ({ uid: c.uid, applicationId: appId, programId: 'p1', consentSensitive: true, answers: { swim: { value: '25m 이상' } }, ...extra });
await expect('본인 신청서의 문진표 제출', 'allow', req('PATCH', `surveys/${RUN}sva_p1`, c.token, sv(`${RUN}sva`)));
await expect('민감정보 동의 없이 제출', 'deny', req('PATCH', `surveys/${RUN}sva_p2`, c.token, sv(`${RUN}sva`, { programId: 'p2', consentSensitive: false })));
await expect('남의 신청서로 문진표 제출', 'deny', req('PATCH', `surveys/${RUN}svb_p1`, c.token, sv(`${RUN}svb`)));
await expect('문서 번호와 신청서가 다른 제출', 'deny', req('PATCH', `surveys/${RUN}svx_p1`, c.token, sv(`${RUN}sva`)));
await expect('본인 문진표 읽기', 'allow', req('GET', `surveys/${RUN}sva_p1`, c.token));
await expect('남의 문진표 읽기', 'deny', req('GET', `surveys/${RUN}sva_p1`, b.token));
await expect('관리자가 문진표 읽기', 'allow', req('GET', `surveys/${RUN}sva_p1`, admin.token));
await expect('본인이 문진표 수정', 'allow', req('PATCH', `surveys/${RUN}sva_p1`, c.token, sv(`${RUN}sva`, { answers: { swim: { value: '50m 이상 자유롭게' } } })));
await expect('본인이 문진표 삭제', 'deny', req('DELETE', `surveys/${RUN}sva_p1`, c.token));
await expect('관리자가 문진표 삭제(보관기간 경과)', 'allow', req('DELETE', `surveys/${RUN}sva_p1`, admin.token));
await expect('본인 수신 동의 저장', 'allow', req('PATCH', `marketingConsents/${c.uid}`, c.token, { uid: c.uid, email: true, sms: false, updatedAt: new Date(), confirmedAt: new Date(), agreedAt: new Date() }));
await expect('남의 수신 동의 바꾸기', 'deny', req('PATCH', `marketingConsents/${c.uid}`, b.token, { uid: c.uid, email: false, sms: false }));
await expect('수신 동의에 다른 항목 넣기', 'deny', req('PATCH', `marketingConsents/${c.uid}`, c.token, { uid: c.uid, email: true, sms: true, phone: '010' }));
await expect('관리자가 수신 동의 명단 읽기', 'allow', req('GET', `marketingConsents/${c.uid}`, admin.token));
await expect('다른 회원이 수신 동의 읽기', 'deny', req('GET', `marketingConsents/${c.uid}`, b.token));
await expect('본인이 수신 설정 처리 결과 알림 만들기', 'allow', req('PATCH', `notifications/${RUN}nc`, c.token, { uid: c.uid, type: 'consent', title: '수신 설정 변경', read: false }));
await expect('본인이 다른 종류 알림 만들기', 'deny', req('PATCH', `notifications/${RUN}nd`, c.token, { uid: c.uid, type: 'qual', title: '가짜 자격', read: false }));

console.log('\n[자료실 · 제휴 할인]');
await expect('관리자가 자료 등록', 'allow', req('PATCH', `resources/${RUN}r1`, admin.token, { title: '교안', level: 'full', path: 'resources/x.pdf' }));
await expect('회원이 자료 등록', 'deny', req('PATCH', `resources/${RUN}r2`, c.token, { title: '가짜', level: 'all' }));
await expect('로그인 회원이 자료 목록 읽기', 'allow', req('GET', `resources/${RUN}r1`, c.token));
await expect('로그인 없이 자료 목록 읽기', 'deny', req('GET', `resources/${RUN}r1`, null));
await expect('관리자가 할인 코드 등록', 'allow', req('PATCH', `partnerCodes/${RUN}p1`, admin.token, { code: 'KWSA15' }));
await expect('회원이 할인 코드 직접 읽기', 'deny', req('GET', `partnerCodes/${RUN}p1`, c.token));
await expect('회원이 제휴 할인 등록', 'deny', req('PATCH', `partners/${RUN}p2`, c.token, { name: '가짜' }));
await expect('회원이 안내 발송 기록 쓰기', 'deny', req('PATCH', `reminderLog/${RUN}x`, c.token, { at: new Date() }));

console.log('\n[생존수영 인증]');
const ev = await signUp('rules-ev@test.local');
await req('PATCH', `swimGroups/${RUN}g1`, 'owner', { school: 'OO초', regOpen: true, status: 'open', evaluatorUids: [ev.uid], items: ['물적응'] });
await req('PATCH', `swimGroups/${RUN}g2`, 'owner', { school: 'XX초', regOpen: false, status: 'open', evaluatorUids: [] });
const stu = (extra = {}) => ({ uid: c.uid, groupId: `${RUN}g1`, name: '아이', birth: '2016-03-03', grade: '3학년', registrant: 'guardian', consentAt: new Date(), status: 'registered', ...extra });
await expect('로그인 없이 수업 정보 보기(등록 링크)', 'allow', req('GET', `swimGroups/${RUN}g1`, null));
await expect('회원이 수업 만들기', 'deny', req('PATCH', `swimGroups/${RUN}g3`, c.token, { school: '가짜', regOpen: true, status: 'open' }));
await expect('보호자가 자녀 등록', 'allow', req('PATCH', `swimStudents/${RUN}s1`, c.token, stu()));
await expect('등록 마감된 수업에 등록', 'deny', req('PATCH', `swimStudents/${RUN}s2`, c.token, stu({ groupId: `${RUN}g2` })));
await expect('등록하면서 결과·인증번호 넣기', 'deny', req('PATCH', `swimStudents/${RUN}s3`, c.token, stu({ certNo: 'KWSA-SC-2026-999999' })));
await expect('보호자가 스스로 "이수" 기록', 'deny', req('PATCH', `swimStudents/${RUN}s1`, c.token, { results: { 물적응: '이수' }, status: 'evaluated' }, ['results', 'status']));
await expect('보호자가 학년 고치기(평가 전)', 'allow', req('PATCH', `swimStudents/${RUN}s1`, c.token, { grade: '3학년 2반' }, ['grade']));
await expect('배정된 강사가 학생 읽기', 'allow', req('GET', `swimStudents/${RUN}s1`, ev.token));
await expect('배정 안 된 회원이 학생 읽기', 'deny', req('GET', `swimStudents/${RUN}s1`, b.token));
await expect('배정된 강사가 평가 기록', 'allow', req('PATCH', `swimStudents/${RUN}s1`, ev.token, { results: { 물적응: '이수' }, status: 'evaluated', evaluatedBy: ev.uid }, ['results', 'status', 'evaluatedBy']));
await expect('강사가 스스로 "발급" 처리', 'deny', req('PATCH', `swimStudents/${RUN}s1`, ev.token, { status: 'issued' }, ['status']));
await expect('강사가 인증번호 넣기', 'deny', req('PATCH', `swimStudents/${RUN}s1`, ev.token, { certNo: 'X' }, ['certNo']));
await expect('다른 회원이 평가 기록', 'deny', req('PATCH', `swimStudents/${RUN}s1`, b.token, { results: { 물적응: '미이수' } }, ['results']));
await expect('평가 끝난 뒤 보호자가 이름 고치기', 'deny', req('PATCH', `swimStudents/${RUN}s1`, c.token, { name: '바꿈' }, ['name']));
await expect('보호자 연락처 저장', 'allow', req('PATCH', `swimContacts/${RUN}s1`, c.token, { uid: c.uid, guardianName: '보호자', phone: '010' }));
await expect('강사가 보호자 연락처 읽기', 'deny', req('GET', `swimContacts/${RUN}s1`, ev.token));
await expect('남의 학생에 연락처 붙이기', 'deny', req('PATCH', `swimContacts/${RUN}s1`, b.token, { uid: b.uid, phone: '010' }));
await expect('회원이 스스로 평가 강사 되기', 'deny', req('PATCH', `evaluators/${c.uid}`, c.token, { name: 'C' }));
await expect('관리자가 평가 항목 설정', 'allow', req('PATCH', 'settings/swimItems', admin.token, { items: ['물적응'] }));
await expect('회원이 평가 항목 바꾸기', 'deny', req('PATCH', 'settings/swimItems', c.token, { items: [] }));

console.log('\n[관리자 활동 기록]');
// 서버 시각(at)은 REST로 넣을 수 없어 transform 쓰기로 보냄
async function addLog(token, id, data) {
  const r = await fetch(`${FS.replace(/\/documents$/, '/documents:commit')}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify({ writes: [{ update: { name: `projects/${P}/databases/(default)/documents/adminLogs/${id}`, fields: fields(data) },
      currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }] }) });
  return r.status;
}
const log = uid => ({ uid, name: '관리자', action: '테스트', target: '', detail: '' });
await expect('관리자가 활동 기록 남기기', 'allow', addLog(admin.token, `${RUN}l1`, log(admin.uid)));
await expect('관리자가 남의 이름으로 기록', 'deny', addLog(admin.token, `${RUN}l2`, log(c.uid)));
await expect('관리자가 시각을 직접 넣어 기록', 'deny', req('PATCH', `adminLogs/${RUN}l3`, admin.token, { ...log(admin.uid), at: new Date('2020-01-01') }));
await expect('회원이 활동 기록 남기기', 'deny', addLog(c.token, `${RUN}l4`, log(c.uid)));
await expect('관리자가 활동 기록 읽기', 'allow', req('GET', `adminLogs/${RUN}l1`, admin.token));
await expect('회원이 활동 기록 읽기', 'deny', req('GET', `adminLogs/${RUN}l1`, c.token));
await expect('관리자가 활동 기록 고치기', 'deny', req('PATCH', `adminLogs/${RUN}l1`, admin.token, { detail: '고침' }, ['detail']));
await expect('관리자가 활동 기록 지우기', 'deny', req('DELETE', `adminLogs/${RUN}l1`, admin.token));

console.log(`\n결과: 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
