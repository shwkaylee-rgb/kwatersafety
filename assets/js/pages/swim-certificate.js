/* 생존수영 능력 인증서
   swim-certificate.html?id=학생ID  — 등록한 보호자(또는 본인)·관리자
   swim-certificate.html?group=수업ID — 관리자: 수업의 발급된 인증서를 한 번에 인쇄 (한 장에 한 명) */
import { enabled, db, fs, state, requireLogin, disabledNotice, esc, qs } from '../app.js';
import { swimCertHTML, groupTitle } from '../swim.js';

const el = document.getElementById('cert');
const buttons = back => '<p class="center btn-row no-print"><button type="button" class="btn btn-primary" id="print">인쇄 / PDF로 저장</button><a class="btn btn-outline" href="' + back + '">돌아가기</a></p>';

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  const gid = qs('group');
  try {
    if (gid) {
      if (!state.isAdmin) { el.innerHTML = '<p class="board-empty">관리자만 볼 수 있습니다.</p>'; return; }
      const [g, snap] = await Promise.all([fs.getDoc(fs.doc(db, 'swimGroups', gid)), fs.getDocs(fs.query(fs.collection(db, 'swimStudents'), fs.where('groupId', '==', gid)))]);
      const grp = g.data(), list = snap.docs.map(d => d.data()).filter(s => s.status === 'issued').sort((a, b) => String(a.grade + a.name).localeCompare(String(b.grade + b.name), 'ko'));
      if (!list.length) { el.innerHTML = '<p class="board-empty">발급된 인증서가 없습니다.</p>'; return; }
      el.innerHTML = '<p class="center no-print">' + esc(groupTitle(grp)) + ' · 인증서 ' + list.length + '장</p>' + buttons('admin.html') +
        list.map(s => '<div class="cert-page">' + swimCertHTML(s, grp) + '</div>').join('');
    } else {
      const d = await fs.getDoc(fs.doc(db, 'swimStudents', qs('id') || '-'));
      const s = d.exists() ? d.data() : null;
      if (!s || s.status !== 'issued') { el.innerHTML = '<p class="board-empty">발급된 인증서가 아닙니다. <a href="mypage.html#swim">마이페이지로</a></p>'; return; }
      const g = (await fs.getDoc(fs.doc(db, 'swimGroups', s.groupId))).data();
      el.innerHTML = swimCertHTML(s, g) + buttons('mypage.html#swim');
    }
    document.getElementById('print').addEventListener('click', () => window.print());
  } catch (e) { el.innerHTML = '<p class="board-empty">인증서를 볼 수 없습니다. <a href="mypage.html#swim">마이페이지로</a></p>'; }
}
init();
