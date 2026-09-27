/* 관리자 > 대시보드 탭: 처리 대기, 이번 달 현황, 곧 만료, 최근 활동을 한 화면에. 숫자를 누르면 해당 탭으로 이동 */
import { db, fs, toast, esc, fmtDate } from '../app.js';
import { todayYmd, addDays, memberStatus, daysLeft } from '../membership.js';
import { qualStatus } from '../qual.js';
import { qualPendingCount } from './admin-qual.js';

const EXPIRE_DAYS = 30;

export async function tabDashboard(container, go) {
  container.innerHTML = '<p class="board-empty">불러오는 중…</p>';
  const today = todayYmd(), month = today.slice(0, 8) + '01', soon = addDays(today, EXPIRE_DAYS);
  const col = name => fs.collection(db, name);
  const count = q => fs.getCountFromServer(q).then(s => s.data().count);
  // 한 칸이 실패해도 나머지는 보이도록 칸마다 따로 처리
  const safe = p => p.catch(e => { console.warn(e); return null; });

  const [apps, msApps, qualPend, swimOpen, qna, newUsers, eduDone, qualIssued, swimIssued, msSoon, qualSoon, logs] = await Promise.all([
    safe(count(fs.query(col('applications'), fs.where('status', '==', '접수완료')))),
    safe(count(fs.query(col('membershipApplications'), fs.where('status', '==', '접수')))),
    safe(qualPendingCount()),
    safe(count(fs.query(col('swimGroups'), fs.where('status', '==', 'open')))),
    safe(count(fs.query(col('inquiries'), fs.where('status', '==', '접수')))),
    safe(count(fs.query(col('users'), fs.where('createdAt', '>=', new Date(month + 'T00:00:00+09:00'))))),
    safe(count(fs.query(col('completions'), fs.where('completedOn', '>=', month)))),
    safe(count(fs.query(col('qualifications'), fs.where('issuedOn', '>=', month)))),
    safe(count(fs.query(col('swimStudents'), fs.where('issuedOn', '>=', month)))),
    safe(fs.getDocs(fs.query(col('memberships'), fs.where('endDate', '>=', today), fs.where('endDate', '<=', soon)))
      .then(s => s.docs.map(d => d.data()).filter(m => memberStatus(m) === 'active' && daysLeft(m) <= EXPIRE_DAYS).length)),
    safe(fs.getDocs(fs.query(col('qualifications'), fs.where('expiresOn', '>=', today), fs.where('expiresOn', '<=', soon)))
      .then(s => s.docs.map(d => d.data()).filter(q => ['valid', 'soon'].includes(qualStatus(q))).length)),
    safe(fs.getDocs(fs.query(col('adminLogs'), fs.orderBy('at', 'desc'), fs.limit(10))).then(s => s.docs.map(d => d.data())))
  ]);

  const num = n => n == null ? '<span class="muted">–</span>' : n.toLocaleString('ko-KR');
  const card = (tab, label, n, unit, hint, todo) => '<button type="button" class="dash-card' + (todo && n ? ' is-todo' : '') + '" data-go="' + tab + '">' +
    '<span>' + label + '</span><b>' + num(n) + (n == null ? '' : unit) + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</button>';
  container.innerHTML =
    '<h3 class="list-title">처리 대기</h3>' +
    '<div class="dash-cards">' +
      card('apps', '교육·자격 신청 접수', apps, '건', '승인·반려 필요', true) +
      card('membership', '멤버십 입금 확인', msApps, '건', '입금 확인 후 활성화', true) +
      card('qual', '자격 발급·갱신', qualPend, '건', '이수자 자격 처리', true) +
      card('swim', '평가 중인 생존수영 수업', swimOpen, '개', '평가 마감 전', true) +
      card('inquiry', '답변 대기 문의', qna, '건', '1:1 문의', true) +
    '</div>' +
    '<h3 class="list-title">이번 달 (' + month.slice(0, 7) + ')</h3>' +
    '<div class="dash-cards">' +
      card('members', '신규 회원', newUsers, '명') +
      card('edu', '교육 이수', eduDone, '명') +
      card('qual', '자격 발급', qualIssued, '건') +
      card('swim', '생존수영 인증서 발급', swimIssued, '장') +
    '</div>' +
    '<h3 class="list-title">' + EXPIRE_DAYS + '일 안에 만료</h3>' +
    '<div class="dash-cards">' +
      card('membership', '멤버십', msSoon, '명', soon + '까지') +
      card('qual', '자격', qualSoon, '건', soon + '까지') +
    '</div>' +
    '<div class="dash-recent"><div class="dash-recent-head"><h3>최근 활동</h3><button type="button" class="link-btn" data-go="logs">전체 보기</button></div>' +
      (logs && logs.length ? '<div class="table-scroll"><table class="board-table"><tbody>' + logs.map(l =>
        '<tr><td class="col-date">' + fmtDate(l.at, true) + '</td><td>' + esc(l.name) + '</td><td class="nowrap">' + esc(l.action) + '</td><td class="col-title">' + esc(l.target) + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p class="board-empty">' + (logs ? '아직 기록이 없습니다.' : '활동 기록을 불러오지 못했습니다.') + '</p>') +
    '</div>' +
    '<p class="form-help">숫자를 누르면 해당 탭으로 이동합니다. <b>–</b>는 불러오지 못한 항목입니다.</p>';
  container.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  if ([apps, msApps, qualPend, swimOpen, qna].some(n => n == null)) toast('일부 숫자를 불러오지 못했습니다.');
}
