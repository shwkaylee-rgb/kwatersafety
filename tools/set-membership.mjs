/* 에뮬레이터 테스트용: 회원의 멤버십을 원하는 상태로 설정 (실제 Firebase에는 접속하지 않음)
   node tools/set-membership.mjs <uid> <tier> <endDate> [suspended] */
const [uid, tier, endDate, suspended] = process.argv.slice(2);
const FS = 'http://127.0.0.1:8080/v1/projects/demo-kwasa/databases/(default)/documents';
const s = v => ({ stringValue: v });
const r = await fetch(`${FS}/memberships/${uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ fields: { tier: s(tier), memberNo: s('KWSA-' + (tier === 'full' ? 'F' : 'G') + '-2026-0001'), startDate: s('2025-09-01'), endDate: s(endDate),
    suspended: { booleanValue: suspended === 'true' }, name: s('테스트회원'), email: s('member@test.local') } }) });
console.log(r.status === 200 ? `설정: ${tier} 만료 ${endDate}${suspended === 'true' ? ' 정지' : ''}` : '실패 ' + r.status);
