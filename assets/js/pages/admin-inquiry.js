/* 관리자 > 문의 탭: 회원 1:1 문의에 답변. 답변하면 회원에게 알림과 메일이 갑니다.
   inquiries/{id}: { uid, name, email, category, title, body, status: '접수'|'답변완료', answer, answeredAt, answeredBy, createdAt } */
import { db, fs, state, toast, errMsg, esc, fmtDate, textToHTML } from '../app.js';
import { notify } from '../notify.js';
import { logAdmin } from '../admin-log.js';

export const INQUIRY_KEEP_YEARS = 3;
let box, filter = '접수';

export async function tabInquiry(container) {
  box = container;
  box.innerHTML = '<p class="board-empty">불러오는 중…</p>';
  let list;
  try {
    const snap = await fs.getDocs(fs.collection(db, 'inquiries'));
    list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  } catch (e) { box.innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }

  function draw() {
    const shown = filter === '전체' ? list : list.filter(q => q.status === filter);
    box.innerHTML =
      '<div class="admin-toolbar"><div class="chips">' + ['접수', '답변완료', '전체'].map(s =>
        '<button type="button" class="chip' + (s === filter ? ' is-active' : '') + '" data-filter="' + s + '">' + (s === '접수' ? '답변 대기' : s) + ' ' +
        (s === '전체' ? list.length : list.filter(q => q.status === s).length) + '</button>').join('') + '</div>' +
        '<button type="button" class="btn btn-outline btn-sm" id="iq-purge">보관기간(' + INQUIRY_KEEP_YEARS + '년) 지난 문의 삭제</button></div>' +
      '<p class="form-help">답변을 저장하면 회원 알림함과 이메일로 답변 내용이 갑니다. 저장한 답변을 고쳐 다시 저장하면 수정 알림이 한 번 더 갑니다.</p>' +
      (shown.length ? shown.map(q =>
        '<article class="app-card admin">' +
          '<header><span class="status status-' + (q.status === '접수' ? '접수완료' : '승인') + '">' + (q.status === '접수' ? '답변 대기' : '답변 완료') + '</span>' +
            '<b>[' + esc(q.category) + '] ' + esc(q.title) + '</b><small>' + fmtDate(q.createdAt, true) + '</small></header>' +
          '<p class="applicant"><b>' + esc(q.name) + '</b> · ' + esc(q.email) + '</p>' +
          '<div class="post-body">' + textToHTML(q.body) + '</div>' +
          (q.answeredAt ? '<p class="form-help">답변 ' + fmtDate(q.answeredAt, true) + '</p>' : '') +
          '<label>답변<textarea rows="4" maxlength="3000" data-answer="' + q.id + '">' + esc(q.answer || '') + '</textarea></label>' +
          '<footer class="admin-app-foot"><button type="button" class="link-btn" data-del="' + q.id + '">삭제</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-save="' + q.id + '">' + (q.answer ? '답변 수정' : '답변 보내기') + '</button></footer>' +
        '</article>').join('') : '<p class="board-empty">해당하는 문의가 없습니다.</p>');

    box.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; draw(); }));
    box.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', async () => {
      const q = list.find(x => x.id === b.dataset.save), answer = box.querySelector('[data-answer="' + q.id + '"]').value.trim();
      if (!answer) { toast('답변 내용을 입력해 주세요.'); return; }
      const again = !!q.answer;
      b.disabled = true;
      try {
        await fs.updateDoc(fs.doc(db, 'inquiries', q.id), { status: '답변완료', answer, answeredAt: fs.serverTimestamp(), answeredBy: state.user.uid });
        await notify(q.uid, 'inquiry', '문의에 ' + (again ? '대한 답변이 수정되었습니다' : '답변드립니다') + ': ' + q.title, answer, 'mypage.html#qna');
        logAdmin(again ? '문의 답변 수정' : '문의 답변', q.name + ' · ' + q.title, answer.slice(0, 100));
        Object.assign(q, { status: '답변완료', answer, answeredAt: new Date() });
        toast('답변을 보냈습니다.'); draw();
        document.dispatchEvent(new Event('qna-changed'));
      } catch (e) { toast(errMsg(e)); b.disabled = false; }
    }));
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const q = list.find(x => x.id === b.dataset.del);
      if (!confirm('「' + q.title + '」 문의를 삭제할까요? 회원 화면에서도 사라집니다.')) return;
      try { await fs.deleteDoc(fs.doc(db, 'inquiries', q.id)); logAdmin('문의 삭제', q.name + ' · ' + q.title); list = list.filter(x => x !== q); toast('삭제했습니다.'); draw(); document.dispatchEvent(new Event('qna-changed')); }
      catch (e) { toast(errMsg(e)); }
    }));
    document.getElementById('iq-purge').addEventListener('click', async () => {
      const limit = new Date(); limit.setFullYear(limit.getFullYear() - INQUIRY_KEEP_YEARS);
      const old = list.filter(q => q.createdAt?.toDate && q.createdAt.toDate() < limit);
      if (!old.length) { toast('보관기간이 지난 문의가 없습니다.'); return; }
      if (!confirm('접수일로부터 ' + INQUIRY_KEEP_YEARS + '년이 지난 문의 ' + old.length + '건을 영구 삭제할까요?')) return;
      try {
        for (let i = 0; i < old.length; i += 400) {
          const batch = fs.writeBatch(db);
          old.slice(i, i + 400).forEach(q => batch.delete(fs.doc(db, 'inquiries', q.id)));
          await batch.commit();
        }
        logAdmin('문의 일괄 삭제', '보관기간(' + INQUIRY_KEEP_YEARS + '년) 지난 문의', old.length + '건');
        list = list.filter(q => !old.includes(q));
        toast(old.length + '건을 삭제했습니다.'); draw();
      } catch (e) { toast(errMsg(e)); }
    });
  }
  draw();
}
