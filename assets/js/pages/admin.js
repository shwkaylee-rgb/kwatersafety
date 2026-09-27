import { enabled, db, fs, state, requireLogin, disabledNotice, toast, errMsg, esc, fmtDate, won, BOARD_TITLES, displayName } from '../app.js';
import { tabMembership } from './admin-membership.js';
import { TIER_NAMES, memberStatus, STATUS_NAMES, todayYmd } from '../membership.js';
import { tabOnline } from './admin-online.js';
import { tabEdu } from './admin-edu.js';
import { tabQual } from './admin-qual.js';
import { tabNotice } from './admin-notice.js';
import { tabLibrary } from './admin-library.js';
import { tabSwim } from './admin-swim.js';
import { notify } from '../notify.js';
import { EXTRA_TYPES } from '../survey.js';
import { needsReconfirm, consentText } from '../marketing.js';
import { QUALS, QUAL_GRADES } from '../qual.js';
import { enrollmentId, newAccessPeriod, completionValid } from '../course.js';
import { logAdmin } from '../admin-log.js';
import { tabLogs } from './admin-logs.js';
import { tabInquiry } from './admin-inquiry.js';
import { tabDashboard } from './admin-dashboard.js';

const el = document.getElementById('admin');
const STATUSES = ['접수완료', '승인', '반려', '취소'];

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  if (!state.isAdmin) {
    el.innerHTML = '<div class="notice-box">관리자 권한이 없습니다.<br><small>계정 ID(UID): <code>' + esc(state.user.uid) + '</code><br>' +
      'Firebase 콘솔 &gt; Firestore 에서 <b>admins</b> 컬렉션에 위 UID로 문서를 만들면 관리자가 됩니다.</small></div>';
    return;
  }
  const tabs = { dash: () => tabDashboard(tab(), openTab), apps: tabApps, membership: () => tabMembership(tab()), programs: tabPrograms, online: () => tabOnline(tab()), edu: () => tabEdu(tab()), qual: () => tabQual(tab()), swim: () => tabSwim(tab()), members: tabMembers, notice: () => tabNotice(tab()), library: () => tabLibrary(tab()), posts: tabPosts, logs: () => tabLogs(tab()), inquiry: () => tabInquiry(tab()) };
  const title = id => MENU.flatMap(g => g.items).find(([k]) => k === id)[1];

  // 마이페이지와 같은 왼쪽 메뉴 (휴대폰에서는 [메뉴] 버튼으로 펼침). 주소 끝 #아이디 로 바로 열 수 있음 (예: admin.html#qual)
  el.innerHTML =
    '<div class="my-layout">' +
      '<button type="button" class="my-menu-btn" id="my-menu-btn" aria-expanded="false" aria-controls="my-nav">' +
        '<span class="my-bars" aria-hidden="true"></span><b id="my-current">대시보드</b><span class="my-menu-label">메뉴</span></button>' +
      '<nav class="my-nav" id="my-nav" aria-label="관리자 메뉴">' +
        '<p class="my-hello"><b>관리자</b> · ' + esc(displayName()) + '</p>' +
        MENU.map(g => (g.title ? '<p class="my-nav-group">' + g.title + '</p>' : '') + '<ul>' +
          g.items.map(([id, t]) => '<li><a href="#' + id + '" data-go="' + id + '">' + t + (id === 'inquiry' ? '<b class="notice-count" data-qna-count hidden></b>' : '') + '</a></li>').join('') +
          '</ul>').join('') +
      '</nav>' +
      '<div class="my-main"><h2 class="my-sec-title" id="tab-title"></h2><div id="tab"></div></div>' +
    '</div>';

  const btn = document.getElementById('my-menu-btn'), nav = document.getElementById('my-nav');
  const setMenu = open => { nav.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
  btn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  document.addEventListener('click', e => { if (!nav.contains(e.target) && !btn.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  function show(id) {
    if (!tabs[id]) id = 'dash';
    el.querySelectorAll('[data-go]').forEach(a => {
      const on = a.getAttribute('data-go') === id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.getElementById('my-current').textContent = document.getElementById('tab-title').textContent = title(id);
    tabs[id]();
  }
  // 대시보드 숫자 등에서 다른 메뉴로 이동할 때도 주소를 바꿔 뒤로 가기가 되게 함
  function openTab(id) {
    history.pushState(null, '', '#' + id);
    show(id); setMenu(false);
    const top = el.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo(0, top);
  }
  nav.addEventListener('click', e => {
    const a = e.target.closest('a[data-go]');
    if (!a) return;
    e.preventDefault();
    openTab(a.getAttribute('data-go'));
  });
  window.addEventListener('popstate', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
  refreshQnaCount();
  document.addEventListener('qna-changed', refreshQnaCount);
}

const MENU = [
  { items: [['dash', '대시보드']] },
  { title: '회원·신청', items: [['apps', '신청 관리'], ['membership', '멤버십'], ['members', '회원 목록'], ['inquiry', '1:1 문의']] },
  { title: '교육·자격', items: [['programs', '교육·자격 과정'], ['edu', '교육 이수'], ['qual', '자격증'], ['swim', '생존수영 인증'], ['online', '온라인 학습']] },
  { title: '사이트 운영', items: [['posts', '게시판'], ['notice', '알림·메일·팝업'], ['library', '자료실·제휴']] },
  { title: '기록', items: [['logs', '활동 기록']] }
];

// [1:1 문의] 옆에 답변 대기 건수
async function refreshQnaCount() {
  try {
    const n = (await fs.getCountFromServer(fs.query(fs.collection(db, 'inquiries'), fs.where('status', '==', '접수')))).data().count;
    document.querySelectorAll('[data-qna-count]').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
  } catch (e) { console.warn(e); }
}
const tab = () => document.getElementById('tab');

/* ---------- 신청 관리 ---------- */
async function tabApps() {
  tab().innerHTML = '<p class="board-empty">불러오는 중…</p>';
  let apps, enrs;
  try {
    const [snap, eSnap] = await Promise.all([fs.getDocs(fs.collection(db, 'applications')), fs.getDocs(fs.collection(db, 'enrollments'))]);
    // 일부 항목이 빠진 신청서가 있어도 목록 전체가 멈추지 않게 기본값을 채움
    apps = snap.docs.map(d => ({ id: d.id, items: [], ...d.data() })).map(x => ({ ...x, applicant: x.applicant || {} })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    enrs = Object.fromEntries(eSnap.docs.map(d => [d.id, d.data()]));
  } catch (e) { tab().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  // 사전요건(온라인 학습 수료) 확인 표시
  const prereq = (a, i) => !i.requiresCourse ? '' : completionValid(enrs[enrollmentId(a.uid, i.requiresCourse)])
    ? ' <span class="mstatus mstatus-ok">사전요건 수료 ✓</span>' : ' <span class="mstatus mstatus-no">사전요건 미수료</span>';
  const receiptLine = a => !a.receipt || a.receipt.type === 'none' ? '' : '<p class="form-help">증빙: ' + (a.receipt.type === 'cash' ? '현금영수증 · ' + esc(a.receipt.phone) : '계산서 · ' + esc(a.receipt.bizName) + ' (' + esc(a.receipt.bizNo) + ')') + ' · ' + esc(a.receiptStatus || '') + '</p>';

  let filter = '전체';
  function draw() {
    const list = filter === '전체' ? apps : apps.filter(a => a.status === filter);
    tab().innerHTML =
      '<div class="admin-toolbar"><div class="chips">' + ['전체'].concat(STATUSES).map(s =>
        '<button type="button" class="chip' + (s === filter ? ' is-active' : '') + '" data-filter="' + s + '">' + s + ' ' +
        (s === '전체' ? apps.length : apps.filter(a => a.status === s).length) + '</button>').join('') + '</div>' +
      '<div class="btn-row"><button type="button" class="btn btn-outline btn-sm" id="csv">엑셀(CSV) 내려받기</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="purge">보관기간(3년) 지난 신청서 삭제</button></div></div>' +
      (list.length ? list.map(a =>
        '<article class="app-card admin">' +
          '<header><span class="status status-' + esc(a.status) + '">' + esc(a.status) + '</span><small>' + fmtDate(a.createdAt, true) + '</small></header>' +
          '<p class="applicant"><b>' + esc(a.applicant.name) + '</b> · ' + esc(a.applicant.birth) + ' · ' +
            '<a href="tel:' + esc(a.applicant.phone) + '">' + esc(a.applicant.phone) + '</a> · ' + esc(a.applicant.email) + '</p>' +
          (a.applicant.guardianName ? '<p class="applicant guardian-line">보호자 신청: ' + esc(a.applicant.guardianName) + ' (' + esc(a.applicant.relation) + ')</p>' : '') +
          '<ul>' + a.items.map(i => '<li>[' + esc(i.category) + '] ' + esc(i.title) + (i.date ? ' <small>' + esc(i.date) + '</small>' : '') + prereq(a, i) + '<span>' + won(i.fee) + '</span></li>').join('') + '</ul>' +
          receiptLine(a) +
          (a.memo ? '<p class="memo">신청자 메모: ' + esc(a.memo) + '</p>' : '') +
          (a.discount ? '<p class="form-help">교육비 ' + won(a.subtotal) + ' · ' + TIER_NAMES[a.memberTier] + ' 할인 ' + Math.round(a.discountRate * 100) + '% (' + esc(a.memberNo) + ') −' + a.discount.toLocaleString('ko-KR') + '원</p>' : '') +
          '<footer class="admin-app-foot"><b>합계 ' + won(a.total) + '</b>' +
            '<select data-status="' + a.id + '">' + STATUSES.map(s => '<option' + (s === a.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
            '<input data-memo="' + a.id + '" placeholder="신청자에게 보일 안내 (예: 입금 계좌)" value="' + esc(a.adminMemo || '') + '">' +
            '<button type="button" class="btn btn-primary btn-sm" data-save="' + a.id + '">저장</button>' +
          '</footer>' +
        '</article>').join('') : '<p class="board-empty">신청 내역이 없습니다.</p>');

    tab().querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.getAttribute('data-filter'); draw(); }));
    tab().querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', async () => {
      const id = b.getAttribute('data-save');
      const status = tab().querySelector('[data-status="' + id + '"]').value;
      const adminMemo = tab().querySelector('[data-memo="' + id + '"]').value.trim();
      try {
        const a = apps.find(x => x.id === id);
        const changes = await saveApplication(a, status, adminMemo);
        Object.assign(a, changes);
        toast(changes.opened ? '저장했습니다. 온라인 과정 ' + changes.opened + '개의 수강을 열었습니다.' : '저장했습니다.'); draw();
      } catch (e) { toast(e.message && !e.code ? e.message : errMsg(e)); }
    }));
    document.getElementById('csv').addEventListener('click', () => downloadCSV(list));
    document.getElementById('purge').addEventListener('click', async () => {
      const limit = new Date(); limit.setFullYear(limit.getFullYear() - 3);
      const old = apps.filter(a => a.createdAt?.toDate && a.createdAt.toDate() < limit);
      if (!old.length) { toast('보관기간이 지난 신청서가 없습니다.'); return; }
      if (!confirm('신청일로부터 3년이 지난 신청서 ' + old.length + '건을 영구 삭제할까요? 되돌릴 수 없습니다.')) return;
      try {
        for (let i = 0; i < old.length; i += 400) {
          const batch = fs.writeBatch(db);
          old.slice(i, i + 400).forEach(a => batch.delete(fs.doc(db, 'applications', a.id)));
          await batch.commit();
        }
        apps = apps.filter(a => !old.includes(a));
        logAdmin('신청서 일괄 삭제', '보관기간(3년) 지난 신청서', old.length + '건');
        toast(old.length + '건을 삭제했습니다.'); draw();
      } catch (e) { toast(errMsg(e)); }
    });
  }
  draw();
}

// 신청 상태 저장. 승인 시 온라인 과정 수강을 열고, 승인 취소 시 닫음. 증빙 상태도 맞춤
async function saveApplication(a, status, adminMemo) {
  const today = todayYmd(), batch = fs.writeBatch(db);
  const upd = { status, adminMemo };
  const online = a.items.filter(i => i.type === 'online' && i.courseId);
  let opened = 0;
  if (status === '승인' && a.status !== '승인') {
    upd.approvedOn = today;
    for (const i of online) {
      const cSnap = await fs.getDoc(fs.doc(db, 'courses', i.courseId));
      if (!cSnap.exists()) throw new Error('"' + i.title + '" 온라인 과정을 찾을 수 없습니다.');
      const eRef = fs.doc(db, 'enrollments', enrollmentId(a.uid, i.courseId));
      const old = await fs.getDoc(eRef);
      if (old.exists() && completionValid(old.data())) continue;   // 이미 수료해서 인정 기간 안이면 그대로 둠
      const p = newAccessPeriod(cSnap.data(), today);
      batch.set(eRef, {
        uid: a.uid, courseId: i.courseId, courseTitle: cSnap.data().title, name: a.applicant.name, email: a.applicant.email,
        status: 'active', startDate: p.startDate, endDate: p.endDate, endAt: p.endAt, progress: {}, applicationId: a.id, createdAt: fs.serverTimestamp()
      });
      opened++;
    }
  }
  if (a.status === '승인' && (status === '취소' || status === '반려')) {
    for (const i of online) {
      const eRef = fs.doc(db, 'enrollments', enrollmentId(a.uid, i.courseId));
      const old = await fs.getDoc(eRef);
      if (old.exists() && old.data().applicationId === a.id && old.data().status === 'active') batch.update(eRef, { status: 'cancelled' });
    }
  }
  if ((status === '취소' || status === '반려') && a.receiptStatus) {
    upd.receiptStatus = a.receiptStatus === '발급' ? '취소필요' : a.receiptStatus === '대기' ? 'none' : a.receiptStatus;
  }
  batch.update(fs.doc(db, 'applications', a.id), upd);
  await batch.commit();
  if (status !== a.status) logAdmin('신청 상태 변경', a.applicant.name + ' · ' + a.items.map(i => i.title).join(', '), a.status + ' → ' + status + (opened ? ' (온라인 수강 ' + opened + '개 열림)' : ''));
  // 회원에게 알림 (승인·반려로 바뀔 때)
  if (status !== a.status && (status === '승인' || status === '반려')) {
    const names = a.items.map(i => i.title).join(', ');
    await notify(a.uid, 'app', '교육·자격 신청이 ' + (status === '승인' ? '승인' : '반려') + '되었습니다',
      names + (adminMemo ? '\n협회 안내: ' + adminMemo : '') + (opened ? '\n온라인 과정 수강이 열렸습니다.' : ''), 'mypage.html#apps');
  }
  return { ...upd, opened };
}

function downloadCSV(apps) {
  const rows = [['신청일시', '상태', '참가자 이름', '생년월일', '보호자', '관계', '휴대폰', '이메일', '구분', '과정명', '일정', '비용', '신청자 메모', '협회 안내']];
  apps.forEach(a => a.items.forEach(i => rows.push([
    fmtDate(a.createdAt, true), a.status, a.applicant.name, a.applicant.birth, a.applicant.guardianName || '', a.applicant.relation || '',
    a.applicant.phone, a.applicant.email,
    i.category, i.title, i.date, i.fee, a.memo || '', a.adminMemo || ''
  ])));
  const csv = '﻿' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = '신청내역_' + fmtDate(new Date()) + '.csv';
  a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- 교육·자격 과정 ---------- */
async function tabPrograms() {
  tab().innerHTML = '<p class="board-empty">불러오는 중…</p>';
  let programs, courses;
  try {
    const [snap, cSnap] = await Promise.all([fs.getDocs(fs.collection(db, 'programs')), fs.getDocs(fs.collection(db, 'courses'))]);
    // 온라인 과정은 [온라인 학습] 탭에서 관리하므로 여기서는 대면 과정만
    programs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.type !== 'online').sort((a, b) => (a.order || 0) - (b.order || 0));
    courses = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { tab().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }

  function form(p) {
    p = p || { category: '교육', title: '', date: '', place: '', capacity: '', deadline: '', fee: 0, description: '', open: true, order: 0 };
    return '<form class="form-card wide" id="pf" data-id="' + (p.id || '') + '"><h2>' + (p.id ? '과정 수정' : '새 과정 등록') + '</h2>' +
      '<div class="form-row"><label>구분<select name="category">' + ['교육', '자격시험', '이수교육', '행사'].map(c => '<option' + (c === p.category ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>' +
      '<label>과정명<input name="title" required value="' + esc(p.title) + '"></label></div>' +
      '<div class="form-row"><label>일정<input name="date" placeholder="예: 2026-10-10 ~ 10-12" value="' + esc(p.date) + '"></label>' +
      '<label>장소<input name="place" value="' + esc(p.place) + '"></label></div>' +
      '<div class="form-row"><label>정원<input type="number" name="capacity" min="0" value="' + esc(p.capacity) + '"></label>' +
      '<label>접수 마감<input name="deadline" placeholder="예: 2026-10-01" value="' + esc(p.deadline) + '"></label></div>' +
      '<div class="form-row"><label>비용(원, 무료는 0)<input type="number" name="fee" min="0" step="1000" value="' + esc(p.fee) + '"></label>' +
      '<label>정렬 순서 <small>(작을수록 앞)</small><input type="number" name="order" value="' + esc(p.order || 0) + '"></label></div>' +
      '<label>설명<textarea name="description" rows="5">' + esc(p.description) + '</textarea></label>' +
      '<label>사전요건 온라인 과정 <small>(선택하면 이 과정을 수료한 회원만 신청 가능)</small><select name="requiresCourse"><option value="">없음</option>' +
        courses.map(c => '<option value="' + c.id + '"' + (c.id === p.requiresCourse ? ' selected' : '') + '>' + esc(c.title) + '</option>').join('') + '</select></label>' +
      '<div class="form-row"><label>자격 연계 <small>(이수자에게 자격을 발급하거나 갱신하는 과정)</small><select name="qualType"><option value="">없음</option>' +
        Object.entries(QUALS).map(([k, v]) => '<option value="' + k + '"' + (k === p.qualType ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') + '</select></label>' +
      '<label>등급<select name="qualGrade">' + QUAL_GRADES.map(g => '<option' + (g === p.qualGrade ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></label>' +
      '<label>연계 방식<select name="qualAction"><option value="new">신규 발급 (자격 과정)</option><option value="renew"' + (p.qualAction === 'renew' ? ' selected' : '') + '>갱신 (갱신교육)</option></select></label></div>' +
      '<fieldset class="sv-admin"><legend>사전 설문 (건강 문진표)</legend>' +
        '<label class="check"><input type="checkbox" name="surveyOn"' + (p.surveyOn ? ' checked' : '') + '> 교육 전에 사전 설문을 받습니다 (협회 표준 문진표 + 아래 추가 문항)</label>' +
        '<label>교육 종료일 <small>(문진표는 이 날로부터 1년 뒤 파기합니다)</small><input type="date" name="endDate" value="' + esc(p.endDate || '') + '"></label>' +
        '<div id="sv-extra" class="sv-extra"></div><button type="button" class="btn btn-outline btn-sm" id="sv-add">+ 추가 문항</button></fieldset>' +
      '<label class="check"><input type="checkbox" name="open"' + (p.open ? ' checked' : '') + '> 모집 중 (체크 해제하면 신청 페이지에서 숨김)</label>' +
      '<div class="btn-row">' + (p.id ? '<button type="button" class="btn btn-outline" id="pf-cancel">취소</button>' : '') +
      '<button class="btn btn-primary" type="submit">' + (p.id ? '수정 완료' : '등록') + '</button></div></form>';
  }

  function draw(editing) {
    tab().innerHTML =
      '<table class="board-table"><thead><tr><th>구분</th><th>과정명</th><th class="col-date">일정</th><th>비용</th><th>상태</th><th></th></tr></thead><tbody>' +
      (programs.length ? programs.map(p => '<tr><td>' + esc(p.category) + '</td><td class="col-title">' + esc(p.title) + '</td><td class="col-date">' + esc(p.date) + '</td>' +
        '<td>' + won(p.fee) + '</td><td>' + (p.open ? '<span class="status status-승인">모집 중</span>' : '<span class="status status-취소">마감</span>') + '</td>' +
        '<td class="nowrap">' + (p.requiresCourse ? '<small class="guardian-line">온라인 선수</small><br>' : '') + (QUALS[p.qualType] ? '<small class="guardian-line">' + esc(QUALS[p.qualType].name + (p.qualGrade ? ' ' + p.qualGrade : '')) + (p.qualAction === 'renew' ? ' 갱신' : ' 자격') + '</small><br>' : '') + '<button type="button" class="link-btn" data-edit="' + p.id + '">수정</button> <button type="button" class="link-btn" data-remove="' + p.id + '">삭제</button></td></tr>').join('')
        : '<tr><td colspan="6">등록된 과정이 없습니다.</td></tr>') +
      '</tbody></table>' + form(editing);

    tab().querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
      draw(programs.find(p => p.id === b.getAttribute('data-edit')));
      document.getElementById('pf').scrollIntoView({ behavior: 'smooth' });
    }));
    tab().querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('이 과정을 삭제할까요? (이미 접수된 신청 내역은 남습니다)')) return;
      const p = programs.find(x => x.id === b.getAttribute('data-remove'));
      try { await fs.deleteDoc(fs.doc(db, 'programs', p.id)); logAdmin('과정 삭제', p.title, p.date || ''); toast('삭제했습니다.'); tabPrograms(); }
      catch (e) { toast(errMsg(e)); }
    }));
    const cancel = document.getElementById('pf-cancel');
    if (cancel) cancel.addEventListener('click', () => draw());

    const f = document.getElementById('pf');
    // 과정별 추가 문항 편집
    const extraBox = document.getElementById('sv-extra');
    const addExtra = (q = { label: '', type: 'text', options: [], required: false }) => {
      const row = document.createElement('div'); row.className = 'sv-extra-row';
      row.innerHTML = '<input data-x="label" maxlength="100" placeholder="문항 (예: 수영장 이용 경험)" value="' + esc(q.label) + '">' +
        '<select data-x="type">' + Object.entries(EXTRA_TYPES).map(([k, v]) => '<option value="' + k + '"' + (k === q.type ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>' +
        '<input data-x="options" placeholder="보기를 쉼표로 (예: 있음, 없음)" value="' + esc((q.options || []).join(', ')) + '">' +
        '<label class="check"><input type="checkbox" data-x="required"' + (q.required ? ' checked' : '') + '> 필수</label>' +
        '<button type="button" class="link-btn" data-x="del">삭제</button>';
      const sync = () => { row.querySelector('[data-x=options]').hidden = !['radio', 'check'].includes(row.querySelector('[data-x=type]').value); };
      row.querySelector('[data-x=type]').addEventListener('change', sync); sync();
      row.querySelector('[data-x=del]').addEventListener('click', () => row.remove());
      extraBox.appendChild(row);
    };
    ((editing && editing.surveyExtra) || []).forEach(addExtra);
    document.getElementById('sv-add').addEventListener('click', () => addExtra());
    const readExtra = () => [...extraBox.querySelectorAll('.sv-extra-row')].map(r => {
      const type = r.querySelector('[data-x=type]').value;
      return { label: r.querySelector('[data-x=label]').value.trim(), type, required: r.querySelector('[data-x=required]').checked,
        options: ['radio', 'check'].includes(type) ? r.querySelector('[data-x=options]').value.split(',').map(x => x.trim()).filter(Boolean) : [] };
    }).filter(q => q.label);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const data = {
        category: f.category.value, title: f.title.value.trim(), date: f.date.value.trim(), place: f.place.value.trim(),
        capacity: f.capacity.value ? Number(f.capacity.value) : '', deadline: f.deadline.value.trim(),
        fee: Number(f.fee.value) || 0, order: Number(f.order.value) || 0, description: f.description.value, open: f.open.checked,
        requiresCourse: f.requiresCourse.value, qualType: f.qualType.value, qualGrade: f.qualType.value ? f.qualGrade.value : '', qualAction: f.qualType.value ? f.qualAction.value : '',
        requiresCourseTitle: f.requiresCourse.value ? courses.find(c => c.id === f.requiresCourse.value).title : '',
        surveyOn: f.surveyOn.checked, endDate: f.endDate.value, surveyExtra: readExtra()
      };
      try {
        const id = f.getAttribute('data-id');
        if (id) await fs.updateDoc(fs.doc(db, 'programs', id), data);
        else await fs.addDoc(fs.collection(db, 'programs'), { ...data, createdAt: fs.serverTimestamp() });
        logAdmin(id ? '과정 수정' : '과정 등록', data.title, data.date);
        toast('저장했습니다.'); tabPrograms();
      } catch (err) { toast(errMsg(err)); }
    });
  }
  draw();
}

/* ---------- 회원 목록 ---------- */
async function tabMembers() {
  tab().innerHTML = '<p class="board-empty">불러오는 중…</p>';
  try {
    const [snap, msSnap, mkSnap] = await Promise.all([fs.getDocs(fs.collection(db, 'users')), fs.getDocs(fs.collection(db, 'memberships')), fs.getDocs(fs.collection(db, 'marketingConsents'))]);
    const ms = Object.fromEntries(msSnap.docs.map(d => [d.id, d.data()]));
    const mk = Object.fromEntries(mkSnap.docs.map(d => [d.id, d.data()]));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const tierText = m => m ? TIER_NAMES[m.tier] + ' <small>(' + STATUS_NAMES[memberStatus(m)] + ')</small>' : '<span class="muted">–</span>';
    const optIn = users.filter(u => mk[u.id] && (mk[u.id].email || mk[u.id].sms)), again = optIn.filter(u => needsReconfirm(mk[u.id]));
    tab().innerHTML = '<div class="admin-toolbar"><p class="board-count">전체 회원 <b>' + users.length + '</b>명 · 소식지 수신 동의 <b>' + optIn.length + '</b>명' +
        (again.length ? ' · <span class="warn">2년 재확인 필요 ' + again.length + '명</span>' : '') + ' <small>(멤버십 관리는 [멤버십] 탭)</small></p>' +
        '<button type="button" class="btn btn-outline btn-sm" id="mk-csv">수신 동의 명단 CSV</button></div>' +
      '<p class="form-help">소식지·행사 안내는 수신에 동의한 회원에게만 보내세요. 광고성 메일·문자는 제목이나 첫머리에 (광고)와 보내는 곳을 적고, 수신 거부 방법을 안내해야 합니다. 동의 후 2년이 되면 회원 대시보드에 재확인 안내가 뜹니다.</p>' +
      '<div class="table-scroll"><table class="board-table"><thead><tr><th>이름</th><th>이메일</th><th>휴대폰</th><th>멤버십</th><th>소식지</th><th class="col-date">가입일</th></tr></thead><tbody>' +
      users.map(u => '<tr><td>' + esc(u.name) + '</td><td class="col-title">' + esc(u.email) + '</td><td>' + esc(u.phone) + '</td><td>' + tierText(ms[u.id]) + '</td><td>' + consentText(mk[u.id]) + (needsReconfirm(mk[u.id]) ? ' <small class="warn">재확인</small>' : '') + '</td><td class="col-date">' + fmtDate(u.createdAt) + '</td></tr>').join('') +
      '</tbody></table></div>';
    document.getElementById('mk-csv').addEventListener('click', () => {
      const rows = [['이름', '이메일', '휴대폰', '이메일 수신', '문자 수신', '동의일', '마지막 확인일']].concat(optIn.map(u => { const c = mk[u.id];
        return [u.name, c.email ? u.email : '', c.sms ? u.phone : '', c.email ? 'Y' : 'N', c.sms ? 'Y' : 'N', fmtDate(c.agreedAt), fmtDate(c.confirmedAt)]; }));
      const csv = '\ufeff' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = '소식지수신동의_' + fmtDate(new Date()) + '.csv'; a.click(); URL.revokeObjectURL(a.href);
    });
  } catch (e) { tab().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; }
}

/* ---------- 게시판 ---------- */
async function tabPosts() {
  tab().innerHTML =
    '<div class="notice-box left"><h3>글쓰기</h3><p>' + Object.entries(BOARD_TITLES).map(([k, v]) =>
      '<a class="btn btn-outline btn-sm" href="write.html?board=' + k + '">' + v + ' 글쓰기</a>').join(' ') + '</p>' +
    '<p><small>글 수정·삭제는 각 게시물 화면 아래의 버튼을 이용하세요.</small></p></div>' +
    '<div class="notice-box left"><h3>기존 게시글 가져오기</h3>' +
    '<p>posts.js 에 들어 있는 기존 공지·소식 글을 Firebase 게시판으로 옮깁니다. 처음 한 번만 누르면 되며, 이미 가져온 글은 다시 가져오지 않습니다.</p>' +
    '<button type="button" class="btn btn-primary btn-sm" id="import">기존 게시글 가져오기</button></div>';

  document.getElementById('import').addEventListener('click', async () => {
    const boards = window.BOARDS || {};
    try {
      const existing = await fs.getDocs(fs.collection(db, 'posts'));
      const done = new Set(existing.docs.map(d => d.data().staticKey).filter(Boolean));
      const batch = fs.writeBatch(db);
      let n = 0;
      Object.keys(boards).forEach(board => boards[board].posts.forEach(p => {
        const key = board + '-' + p.id;
        if (done.has(key)) return;
        const body = p.body.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
        batch.set(fs.doc(fs.collection(db, 'posts')), {
          board, title: p.title, body, author: p.author, date: p.date, staticKey: key,
          authorUid: state.user.uid, createdAt: fs.serverTimestamp()
        });
        n++;
      }));
      if (!n) { toast('새로 가져올 글이 없습니다.'); return; }
      await batch.commit();
      logAdmin('기존 게시글 가져오기', '', n + '건');
      toast(n + '개의 글을 가져왔습니다.');
    } catch (e) { toast(errMsg(e)); }
  });
}

init();
