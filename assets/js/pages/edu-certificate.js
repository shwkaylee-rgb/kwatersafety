import { enabled, db, fs, state, requireLogin, disabledNotice, esc, qs } from '../app.js';

const el = document.getElementById('cert');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  let c = null;
  try {
    // 내 이수 기록 중에서 찾음 (다른 사람의 기록 번호를 넣어도 보이지 않음)
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'completions'), fs.where('uid', '==', state.user.uid)));
    const d = snap.docs.find(x => x.id === qs('id'));
    c = d ? d.data() : null;
  } catch (e) { el.innerHTML = '<p class="board-empty">이수 정보를 불러오지 못했습니다.</p>'; return; }
  if (!c || c.result !== '이수') { el.innerHTML = '<p class="board-empty">이수한 교육이 아닙니다. <a href="mypage.html">마이페이지로</a></p>'; return; }
  const [y, m, d] = c.completedOn.split('-');
  el.innerHTML =
    '<div class="course-cert">' +
      '<p class="cc-no">제 ' + esc(c.certNo) + ' 호</p>' +
      '<h2>이 수 증</h2>' +
      '<dl><dt>성명</dt><dd>' + esc(c.name) + '</dd>' +
      (c.birth ? '<dt>생년월일</dt><dd>' + esc(c.birth) + '</dd>' : '') +
      '<dt>교육명</dt><dd>' + esc(c.programTitle) + '</dd>' +
      (c.programDate ? '<dt>교육 일정</dt><dd>' + esc(c.programDate) + '</dd>' : '') +
      (c.score != null ? '<dt>평가 점수</dt><dd>' + c.score + '점</dd>' : '') + '</dl>' +
      '<p class="cc-text">위 사람은 사단법인 대한수상안전협회가 실시한 위 교육 과정을<br>성실히 이수하였으므로 이 증서를 드립니다.</p>' +
      '<p class="cc-date">' + y + '년 ' + Number(m) + '월 ' + Number(d) + '일</p>' +
      '<p class="cc-issuer"><img src="assets/img/logo-color.png" alt="">사단법인 대한수상안전협회장</p>' +
    '</div>' +
    '<p class="center btn-row no-print"><button type="button" class="btn btn-primary" id="print">인쇄 / PDF로 저장</button><a class="btn btn-outline" href="mypage.html">마이페이지로</a></p>';
  document.getElementById('print').addEventListener('click', () => window.print());
}
init();
