/* 에뮬레이터 테스트 데이터 준비 (실제 Firebase에는 접속하지 않음)
   npm run emulators 실행 중에: node tools/seed-emulator.mjs
   아래 계정은 에뮬레이터 안에만 존재하는 테스트용 계정입니다. */
export const TEST_ADMIN = { email: 'admin@test.local', password: 'admin-test-1234', name: '테스트관리자' };
export const TEST_MEMBER = { email: 'member@test.local', password: 'member-test-1234', name: '테스트회원' };

const P = 'demo-kwasa';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const v = x => typeof x === 'number' ? { integerValue: String(x) } : typeof x === 'boolean' ? { booleanValue: x } : { stringValue: x };
const put = (path, obj) => fetch(`${FS}/${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, v(x)])) }) });

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('seed-emulator.mjs')) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=test`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_ADMIN.email, password: TEST_ADMIN.password, displayName: TEST_ADMIN.name, returnSecureToken: true }) });
  const { localId } = await r.json();
  await put(`users/${localId}`, { name: TEST_ADMIN.name, email: TEST_ADMIN.email, phone: '010-0000-0000', agreePrivacy: true, over14: true });
  await put(`admins/${localId}`, { role: 'admin' });
  await put('programs/test-course', { category: '교육', title: '테스트 생존수영 지도자 교육', date: '2026-11-01', place: '테스트 수영장', fee: 100000, open: true, order: 1, description: '에뮬레이터 테스트용 과정' });
  console.log('관리자 계정과 테스트 과정(100,000원)을 만들었습니다. 관리자 UID:', localId);
}
