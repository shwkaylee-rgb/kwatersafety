/* 관리자 활동 기록
   adminLogs/{id}: { uid, name, action, target, detail, at }  — 누가, 언제, 무엇을, 누구(무엇)에게
   보안 규칙상 추가만 되고 고치거나 지울 수 없습니다. 기록이 실패해도 원래 처리는 그대로 둡니다. */
import { db, fs, state, displayName } from './app.js';

export async function logAdmin(action, target = '', detail = '') {
  try {
    await fs.addDoc(fs.collection(db, 'adminLogs'), {
      uid: state.user.uid, name: displayName(), action,
      target: String(target || '').slice(0, 200), detail: String(detail || '').slice(0, 500), at: fs.serverTimestamp()
    });
  } catch (e) { console.warn('활동 기록을 남기지 못했습니다.', e); }
}
