/* 소식지·행사 안내 수신 동의 (광고성 정보, 선택)
   marketingConsents/{uid}: { uid, email, sms, agreedAt, confirmedAt, updatedAt }
   - 동의·철회하면 처리 결과를 사이트 알림으로 바로 알림 (정보통신망법: 처리 결과 통지)
   - 동의한 날(또는 마지막 확인일)로부터 2년마다 수신 동의 여부를 다시 확인 */
import { db, fs, today } from './app.js';

export const MKT_RECONFIRM_DAYS = 730;
export const MKT_TEXT = '협회 소식지, 교육·행사 안내 등 광고성 정보를 이메일·문자로 받습니다. 동의하지 않아도 회원 서비스는 그대로 이용할 수 있고, 언제든지 마이페이지에서 바꿀 수 있습니다.';

const ms = t => (t && t.toMillis ? t.toMillis() : 0);
export async function loadConsent(uid) {
  try { const d = await fs.getDoc(fs.doc(db, 'marketingConsents', uid)); return d.exists() ? d.data() : null; }
  catch (e) { console.warn(e); return null; }
}
// 2년 확인 시점이 30일 안으로 다가왔거나 지났는지
export function needsReconfirm(c) {
  if (!c || !(c.email || c.sms)) return false;
  return Date.now() - ms(c.confirmedAt || c.agreedAt) > (MKT_RECONFIRM_DAYS - 30) * 86400000;
}
export const consentText = c => c && (c.email || c.sms)
  ? [c.email ? '이메일' : '', c.sms ? '문자' : ''].filter(Boolean).join('·') + ' 수신 동의' : '수신 거부';

// 저장 + 처리 결과 알림. 바뀐 게 없고 확인만 하면 confirmedAt만 갱신
export async function saveConsent(uid, next, prev) {
  const turnedOn = (next.email && !(prev && prev.email)) || (next.sms && !(prev && prev.sms));
  const data = { uid, email: !!next.email, sms: !!next.sms, updatedAt: fs.serverTimestamp(), confirmedAt: fs.serverTimestamp() };
  if (turnedOn) data.agreedAt = fs.serverTimestamp(); else if (prev && prev.agreedAt) data.agreedAt = prev.agreedAt;
  await fs.setDoc(fs.doc(db, 'marketingConsents', uid), data);
  const changed = !prev || !!prev.email !== data.email || !!prev.sms !== data.sms;
  const body = today() + ' 기준 · 이메일 ' + (data.email ? '수신 동의' : '수신 거부') + ', 문자 ' + (data.sms ? '수신 동의' : '수신 거부') +
    ' · 보내는 곳: 사단법인 대한수상안전협회';
  try {
    await fs.addDoc(fs.collection(db, 'notifications'), { uid, type: 'consent', title: changed ? '소식지 수신 설정이 변경되었습니다' : '소식지 수신 동의를 다시 확인했습니다',
      body, link: 'mypage.html#info', read: false, createdAt: fs.serverTimestamp() });
  } catch (e) { console.warn('처리 결과 알림 실패', e); }
  return data;
}
