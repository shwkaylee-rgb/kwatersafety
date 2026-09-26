import { enabled, db, fs, state, requireLogin, disabledNotice, esc, qs } from '../app.js';
import { enrollmentId, completionValid } from '../course.js';

const el = document.getElementById('cert');
const courseId = qs('course') || '';

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  let e, c;
  try {
    const [eSnap, cSnap] = await Promise.all([fs.getDoc(fs.doc(db, 'enrollments', enrollmentId(state.user.uid, courseId))), fs.getDoc(fs.doc(db, 'courses', courseId))]);
    e = eSnap.exists() ? eSnap.data() : null; c = cSnap.exists() ? cSnap.data() : null;
  } catch (err) { el.innerHTML = '<p class="board-empty">수료 정보를 불러오지 못했습니다.</p>'; return; }
  if (!e || e.status !== 'passed') { el.innerHTML = '<p class="board-empty">수료한 과정이 아닙니다. <a href="online.html">온라인 학습 목록</a></p>'; return; }
  const [y, m, d] = e.passedOn.split('-');
  el.innerHTML =
    '<div class="course-cert">' +
      '<p class="cc-no">제 ' + esc(e.certNo) + ' 호</p>' +
      '<h2>수 료 증</h2>' +
      '<dl><dt>성명</dt><dd>' + esc(e.name || (state.profile && state.profile.name) || '') + '</dd>' +
      '<dt>과정명</dt><dd>' + esc((c && c.title) || e.courseTitle) + ' (온라인)</dd>' +
      '<dt>평가 점수</dt><dd>' + e.score + '점</dd>' +
      (e.validUntil ? '<dt>인정 기간</dt><dd>' + esc(e.validUntil) + '까지</dd>' : '') + '</dl>' +
      '<p class="cc-text">위 사람은 사단법인 대한수상안전협회가 운영하는 위 온라인 과정을<br>성실히 이수하고 평가에 합격하였으므로 이 증서를 드립니다.</p>' +
      '<p class="cc-date">' + y + '년 ' + Number(m) + '월 ' + Number(d) + '일</p>' +
      '<p class="cc-issuer"><img src="assets/img/logo-color.png" alt="">사단법인 대한수상안전협회장</p>' +
      (!completionValid(e) ? '<p class="mc-warn no-print">수료 인정 기간이 지났습니다. 사전요건으로 쓰려면 다시 수강해 주세요.</p>' : '') +
    '</div>' +
    '<p class="center btn-row no-print"><button type="button" class="btn btn-primary" id="print">인쇄 / PDF로 저장</button><a class="btn btn-outline" href="mypage.html">마이페이지로</a></p>';
  document.getElementById('print').addEventListener('click', () => window.print());
}
init();
