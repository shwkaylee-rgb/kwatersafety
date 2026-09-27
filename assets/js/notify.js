/* 사이트 알림
   notifications/{id}: { uid, type, title, body, link, read, createdAt }  — 회원 한 명에게 가는 알림 (관리자 처리 시 자동 생성)
   broadcasts/{id}: { title, body, link, target: 'all'|'paid'|'full', createdAt }  — 관리자 전체 공지
   users/{uid}/state/inbox: { broadcastReadAt }  — 전체 공지를 어디까지 읽었는지
   알림은 1년 보관 후 관리자 화면에서 정리합니다. */
import { db, fs } from './app.js';
import { hasBenefits } from './membership.js';

export const NOTICE_KEEP_DAYS = 365;
export const TARGET_NAMES = { all: '모든 회원', paid: '일반회원·정회원', full: '정회원' };

// 관리자 처리에 딸린 알림. 알림이 실패해도 원래 처리는 그대로 두도록 오류를 삼킴
export async function notify(uid, type, title, body = '', link = '') {
  if (!uid) return;
  try {
    await fs.addDoc(fs.collection(db, 'notifications'), { uid, type, title, body, link, read: false, createdAt: fs.serverTimestamp() });
  } catch (e) { console.warn('알림을 보내지 못했습니다.', e); }
}

const ms = t => (t && t.toMillis ? t.toMillis() : 0);
const forMe = (b, membership) => b.target === 'all' || !b.target ||
  (b.target === 'paid' && hasBenefits(membership)) || (b.target === 'full' && hasBenefits(membership) && membership.tier === 'full');

// 내 알림함: 개인 알림 + 나에게 해당하는 전체 공지, 최신순
export async function loadInbox(uid, membership) {
  const [nSnap, bSnap, st] = await Promise.all([
    fs.getDocs(fs.query(fs.collection(db, 'notifications'), fs.where('uid', '==', uid))),
    fs.getDocs(fs.collection(db, 'broadcasts')),
    fs.getDoc(fs.doc(db, 'users', uid, 'state', 'inbox'))
  ]);
  const readAt = st.exists() ? ms(st.data().broadcastReadAt) : 0;
  const items = nSnap.docs.map(d => ({ id: d.id, kind: 'personal', ...d.data() }))
    .concat(bSnap.docs.map(d => ({ id: d.id, kind: 'broadcast', ...d.data() })).filter(b => forMe(b, membership)).map(b => ({ ...b, read: ms(b.createdAt) <= readAt })))
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  return { items, unread: items.filter(i => !i.read).length };
}

export async function markAllRead(uid, items) {
  const batch = fs.writeBatch(db);
  items.filter(i => i.kind === 'personal' && !i.read).forEach(i => batch.update(fs.doc(db, 'notifications', i.id), { read: true }));
  batch.set(fs.doc(db, 'users', uid, 'state', 'inbox'), { broadcastReadAt: fs.serverTimestamp() }, { merge: true });
  await batch.commit();
  items.forEach(i => { i.read = true; });
}
