import { enabled, auth, db, fa, fs, state, requireLogin, disabledNotice, toast, errMsg, esc, fmtDate, won, qs, logout, textToHTML, refreshNoticeCount, callFn } from '../app.js';
import { loadInbox, markAllRead } from '../notify.js';
import { loadConsent, saveConsent, needsReconfirm, consentText, MKT_TEXT } from '../marketing.js';
import { surveyId } from '../survey.js';
import { STUDENT_STATUS, groupTitle } from '../swim.js';
import { LEVEL_NAMES, myLevel, canAccess, fileSize, downloadResource } from '../library.js';
import { TIER_NAMES, KIND_NAMES, memberStatus, availableKinds, daysLeft, MEMBERSHIP as M } from '../membership.js';
import { benefitsTable, statusBadge, appStatusBadge } from '../membership-ui.js';
import { qualStatus, qualTitle, qualValid, QUAL_STATUS_NAMES } from '../qual.js';
import { daysBetween, todayYmd } from '../membership.js';
import { enrollmentStatus, completionValid, progressPercent, ENR_STATUS_NAMES } from '../course.js';

const el = document.getElementById('mypage');
// 왼쪽 메뉴 (휴대폰에서는 [메뉴] 버튼을 누르면 펼쳐짐). 주소 끝 #아이디 로 바로 열 수 있음 (예: mypage.html#qual)
const SECTIONS = [
  ['dashboard', '대시보드'], ['inbox', '알림'], ['info', '내 정보'], ['ms', '멤버십'], ['qual', '자격증'],
  ['edu', '내 교육'], ['swim', '생존수영 인증'], ['survey', '사전 설문'], ['ol', '온라인 학습'], ['apps', '신청 내역'], ['pay', '결제·증빙'], ['library', '자료실'], ['partner', '제휴 할인']
];
const TYPE_NAMES = { app: '신청', membership: '멤버십', edu: '교육', qual: '자격', online: '온라인', consent: '수신 설정', swim: '생존수영', reminder: '안내' };
let inbox = { items: [], unread: 0 }, inboxP = null;

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  if (qs('welcome')) toast('가입을 환영합니다!');
  const u = state.user, p = state.profile || {};
  const sec = (id, title, body) => '<section class="my-sec" data-sec="' + id + '" hidden><h2 class="my-sec-title">' + title + '</h2>' + body + '</section>';
  const loading = id => '<div id="' + id + '"><p class="board-empty">불러오는 중…</p></div>';

  el.innerHTML =
    '<div class="my-layout">' +
      '<button type="button" class="my-menu-btn" id="my-menu-btn" aria-expanded="false" aria-controls="my-nav">' +
        '<span class="my-bars" aria-hidden="true"></span><b id="my-current">대시보드</b><span class="my-menu-label">메뉴</span></button>' +
      '<nav class="my-nav" id="my-nav" aria-label="마이페이지 메뉴">' +
        '<p class="my-hello"><b>' + esc(p.name || u.email) + '</b>님</p><ul>' +
        SECTIONS.map(([id, t]) => '<li><a href="#' + id + '" data-go="' + id + '">' + t +
          (id === 'inbox' ? '<b class="notice-count" data-inbox-count hidden></b>' : '') + '</a></li>').join('') +
        '</ul><button type="button" class="link-btn my-logout" id="logout">로그아웃</button></nav>' +
      '<div class="my-main">' +
        sec('dashboard', '대시보드', loading('dash')) +
        sec('inbox', '알림', loading('inbox-list')) +
        sec('info', '내 정보', infoForm(u, p) + '<div id="mkt" class="my-info mkt-box"><p class="board-empty">불러오는 중…</p></div>') +
        sec('ms', '멤버십', loading('ms')) +
        sec('qual', '자격증', loading('qual')) +
        sec('edu', '내 교육', loading('edu')) +
        sec('swim', '생존수영 능력 인증', loading('swim-list')) +
        sec('survey', '사전 설문 (건강 문진표)', loading('survey-list')) +
        sec('ol', '온라인 학습', loading('ol')) +
        sec('apps', '교육·자격 신청 내역', loading('apps')) +
        sec('pay', '결제·증빙 내역', loading('pay-list')) +
        sec('library', '회원 자료실', loading('lib-list')) +
        sec('partner', '제휴 할인', loading('partner-list')) +
      '</div>' +
    '</div>';

  // 메뉴: 화면 안의 #링크는 모두 여기서 처리 (페이지 이동 없이 칸만 바꿈)
  const btn = document.getElementById('my-menu-btn'), nav = document.getElementById('my-nav');
  const setMenu = open => { nav.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
  btn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  document.addEventListener('click', e => { if (!nav.contains(e.target) && !btn.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  el.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    history.pushState(null, '', '#' + id);
    show(id); setMenu(false);
    const top = el.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo(0, top);
  });
  window.addEventListener('popstate', () => show(location.hash.slice(1)));

  initInfo(u);
  document.getElementById('logout').addEventListener('click', logout);
  initWithdraw(u);

  inboxP = loadInbox(u.uid, state.membership).then(r => { inbox = r; setInboxBadge(); renderInbox(); return r; })
    .catch(e => { console.error(e); document.getElementById('inbox-list').innerHTML = '<p class="board-empty">알림을 불러오지 못했습니다.</p>'; return inbox; });
  loadDash();
  loadMembership();
  loadOnline();
  loadEdu();
  loadQual();
  loadApps();
  loadSurveys();
  loadPay();
  loadMkt();
  loadLibrary();
  loadSwim();
  loadPartners();
  show(location.hash.slice(1) || (qs('withdraw') ? 'info' : 'dashboard'));
}

function show(id) {
  if (!SECTIONS.some(s => s[0] === id)) id = 'dashboard';
  el.querySelectorAll('[data-sec]').forEach(s => { s.hidden = s.getAttribute('data-sec') !== id; });
  el.querySelectorAll('[data-go]').forEach(a => {
    const on = a.getAttribute('data-go') === id;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.getElementById('my-current').textContent = SECTIONS.find(s => s[0] === id)[1];
  if (id === 'inbox') openInbox();
}

/* ---------- 알림 ---------- */
const safeLink = l => /^(https:\/\/|[a-z0-9-]+\.html|#)/i.test(l || '') ? l : '';
const noticeItem = n => '<li class="nt-item' + (n.read ? '' : ' unread') + '">' +
  '<span class="nt-tag' + (n.kind === 'broadcast' ? ' nt-bc' : '') + '">' + (n.kind === 'broadcast' ? '공지' : TYPE_NAMES[n.type] || '안내') + '</span>' +
  '<div class="nt-body"><b>' + esc(n.title) + '</b>' + (n.body ? '<p>' + textToHTML(n.body) + '</p>' : '') + '<small>' + fmtDate(n.createdAt, true) + '</small></div>' +
  (safeLink(n.link) ? '<a class="link-btn" href="' + esc(safeLink(n.link)) + '"' + (/^https:/.test(n.link) ? ' target="_blank" rel="noopener"' : '') + '>바로가기</a>' : '') + '</li>';

function setInboxBadge() {
  document.querySelectorAll('[data-inbox-count]').forEach(b => { b.textContent = inbox.unread > 99 ? '99+' : inbox.unread; b.hidden = !inbox.unread; });
}
function renderInbox() {
  const box = document.getElementById('inbox-list');
  box.innerHTML = '<p class="form-help">알림은 1년 동안 보관됩니다.</p>' +
    (inbox.items.length ? '<ul class="nt-list">' + inbox.items.map(noticeItem).join('') + '</ul>' : '<p class="board-empty">받은 알림이 없습니다.</p>');
}
// 알림 칸을 열면 모두 읽음으로 표시 (이번 화면에서는 새 알림 표시를 그대로 둠)
async function openInbox() {
  await inboxP;
  if (!inbox.unread) return;
  try {
    await markAllRead(state.user.uid, inbox.items);
    inbox.unread = 0; setInboxBadge(); refreshNoticeCount();
  } catch (e) { console.error(e); }
}

/* ---------- 사전 설문 ---------- */
// 승인·접수된 신청 중 사전 설문을 받는 과정 목록 (제출 여부 포함)
let surveyTodoP = null;
function surveyTodo() {
  return surveyTodoP ||= (async () => {
    const uid = state.user.uid;
    const [aSnap, sSnap] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'applications'), fs.where('uid', '==', uid))),
      fs.getDocs(fs.query(fs.collection(db, 'surveys'), fs.where('uid', '==', uid)))
    ]);
    const done = Object.fromEntries(sSnap.docs.map(d => [d.id, d.data()]));
    const rows = [], progs = {};
    for (const d of aSnap.docs) {
      const a = d.data();
      if (a.status !== '승인' && a.status !== '접수완료') continue;
      for (const i of a.items || []) {
        if (i.type === 'online') continue;
        if (!(i.programId in progs)) {
          try { const p = await fs.getDoc(fs.doc(db, 'programs', i.programId)); progs[i.programId] = p.exists() ? p.data() : null; } catch (e) { progs[i.programId] = null; }
        }
        const p = progs[i.programId];
        if (!p || !p.surveyOn) continue;
        const sv = done[surveyId(d.id, i.programId)], ended = !!(p.endDate && p.endDate < todayYmd());
        if (ended && !sv) continue;   // 끝난 교육은 미제출이면 목록에서 뺌
        rows.push({ appId: d.id, item: i, who: a.applicant && a.applicant.guardianName ? a.applicant.name : '', done: !!sv, submittedAt: sv && sv.submittedAt, ended });
      }
    }
    return rows;
  })().catch(e => { console.error(e); return []; });
}
const surveyLink = r => 'survey.html?app=' + encodeURIComponent(r.appId) + '&program=' + encodeURIComponent(r.item.programId);
async function loadSurveys() {
  const box = document.getElementById('survey-list'), rows = await surveyTodo();
  box.innerHTML = '<p class="form-help">안전한 수상 교육을 위해 일부 과정은 교육 전에 건강 문진표를 받습니다. 지도자와 협회 담당자만 보며, 교육 종료 후 1년 뒤 파기합니다.</p>' +
    (rows.length ? '<div class="table-scroll"><table class="board-table"><thead><tr><th>과정명</th><th class="col-date">일정</th><th>상태</th><th></th></tr></thead><tbody>' +
      rows.map(r => '<tr><td class="col-title">' + esc(r.item.title) + (r.who ? '<br><small>참가자 ' + esc(r.who) + '</small>' : '') + '</td><td class="col-date">' + esc(r.item.date || '') + '</td>' +
        '<td>' + (r.done ? '<span class="mstatus mstatus-ok">제출함</span><br><small>' + fmtDate(r.submittedAt) + '</small>' : '<span class="mstatus mstatus-wait">미제출</span>') + '</td>' +
        '<td class="nowrap">' + (r.ended ? '<span class="muted">교육 종료</span>' : '<a class="btn btn-' + (r.done ? 'outline' : 'primary') + ' btn-sm" href="' + surveyLink(r) + '">' + (r.done ? '수정' : '작성하기') + '</a>') + '</td></tr>').join('') +
      '</tbody></table></div>' : '<p class="board-empty">제출할 사전 설문이 없습니다.</p>');
}

/* ---------- 결제·증빙 내역 ---------- */
const RECEIPT_TEXT = { none: '필요 없음', '대기': '발급 대기', '발급': '발급 완료', '취소필요': '취소 처리 중', '취소': '발급 취소' };
async function loadPay() {
  const box = document.getElementById('pay-list'), uid = state.user.uid;
  try {
    const [mSnap, aSnap] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'membershipApplications'), fs.where('uid', '==', uid))),
      fs.getDocs(fs.query(fs.collection(db, 'applications'), fs.where('uid', '==', uid)))
    ]);
    const rows = mSnap.docs.map(d => ({ id: d.id, src: 'm', ...d.data() })).map(r => ({ ...r, amount: r.fee,
        title: '연회비 · ' + TIER_NAMES[r.kind === 'upgrade' ? 'full' : r.tier] + ' ' + KIND_NAMES[r.kind],
        state: r.status === '활성화' ? 'paid' : r.status === '환불' ? 'refund' : r.status === '접수' ? 'wait' : 'cancel', on: r.processedOn }))
      .concat(aSnap.docs.map(d => ({ id: d.id, src: 'a', ...d.data() })).map(r => ({ ...r, amount: r.total,
        title: '교육비 · ' + (r.items || []).map(i => i.title).join(', '),
        state: r.status === '승인' ? 'paid' : r.status === '접수완료' ? 'wait' : 'cancel', on: r.approvedOn })))
      .filter(r => Number(r.amount) > 0 && r.state !== 'cancel')
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const ST = { paid: ['ok', '납부 완료'], wait: ['wait', '입금 대기'], refund: ['off', '환불'] };
    const receipt = r => r.receipt && r.receipt.type !== 'none'
      ? (r.receipt.type === 'cash' ? '현금영수증' : '계산서') + '<br><small>' + (RECEIPT_TEXT[r.receiptStatus] || '') + (r.receiptNo ? ' · ' + esc(r.receiptNo) : '') + '</small>'
      : '<small class="muted">신청 안 함</small>';
    box.innerHTML = '<p class="form-help">회비·교육비 납부 내역과 현금영수증·계산서 발급 상태입니다. 납부확인서는 입금이 확인된 건만 출력할 수 있으며, 세법상 증빙을 대신하지 않습니다.</p>' +
      (rows.length ? '<div class="table-scroll"><table class="board-table"><thead><tr><th class="col-date">신청일</th><th>내용</th><th>금액</th><th>상태</th><th>증빙</th><th></th></tr></thead><tbody>' +
        rows.map(r => '<tr><td class="col-date">' + fmtDate(r.createdAt) + '</td><td class="col-title">' + esc(r.title) + '</td><td class="nowrap">' + won(r.amount) + '</td>' +
          '<td><span class="mstatus mstatus-' + ST[r.state][0] + '">' + ST[r.state][1] + '</span>' + (r.on && r.state === 'paid' ? '<br><small>' + esc(r.on) + '</small>' : '') + '</td>' +
          '<td>' + receipt(r) + '</td>' +
          '<td class="nowrap">' + (r.state === 'paid' ? '<a class="link-btn" href="payment-receipt.html?kind=' + r.src + '&id=' + encodeURIComponent(r.id) + '">납부확인서</a>' : '') + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p class="board-empty">납부 내역이 없습니다.</p>');
  } catch (e) { console.error(e); box.innerHTML = '<p class="board-empty">결제 내역을 불러오지 못했습니다.</p>'; }
}

/* ---------- 소식지 수신 설정 ---------- */
let consentP = null;
const getConsent = () => consentP ||= loadConsent(state.user.uid);
async function loadMkt() {
  const box = document.getElementById('mkt');
  let c = await getConsent();
  const draw = () => {
    const again = needsReconfirm(c);
    box.innerHTML = '<h3>소식지·행사 안내 수신 <small>(선택)</small></h3><p class="form-help">' + MKT_TEXT + '</p>' +
      '<form id="mkt-f"><label class="check"><input type="checkbox" name="email"' + (c && c.email ? ' checked' : '') + '> 이메일로 받기</label>' +
      '<label class="check"><input type="checkbox" name="sms"' + (c && c.sms ? ' checked' : '') + '> 문자로 받기</label>' +
      '<p class="form-help">현재: <b>' + consentText(c) + '</b>' + (c && c.updatedAt ? ' · ' + fmtDate(c.updatedAt) + ' 변경' : '') +
        (again ? '<br><b class="warn">동의한 지 2년이 되어 갑니다. 계속 받으시려면 아래 버튼을 눌러 다시 확인해 주세요.</b>' : '') + '</p>' +
      '<button class="btn btn-outline btn-sm" type="submit">' + (again ? '이대로 계속 받기' : '저장') + '</button></form>';
    const mf = document.getElementById('mkt-f');
    mf.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await saveConsent(state.user.uid, { email: mf.email.checked, sms: mf.sms.checked }, c);
        c = await loadConsent(state.user.uid); consentP = Promise.resolve(c);
        toast('수신 설정을 저장했습니다. 처리 결과를 알림함으로 보냈습니다.'); draw();
      } catch (err) { toast(errMsg(err)); }
    });
  };
  draw();
}

/* ---------- 생존수영 인증 ---------- */
async function loadSwim() {
  const box = document.getElementById('swim-list');
  try {
    const [snap, ev] = await Promise.all([fs.getDocs(fs.query(fs.collection(db, 'swimStudents'), fs.where('uid', '==', state.user.uid))),
      fs.getDoc(fs.doc(db, 'evaluators', state.user.uid)).catch(() => null)]);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const groups = {};
    await Promise.all([...new Set(list.map(s => s.groupId))].map(async id => { const g = await fs.getDoc(fs.doc(db, 'swimGroups', id)); groups[id] = g.exists() ? g.data() : {}; }));
    const today = todayYmd();
    box.innerHTML = (ev && ev.exists() ? '<p class="notice-box left">평가 강사로 지정되어 있습니다. <a class="btn btn-primary btn-sm" href="evaluate.html">평가하기</a></p>' : '') +
      '<p class="form-help">학교·협회 생존수영 교육에서 평가를 받은 학생에게 인증서가 발급됩니다. 인증을 받으면 인증일로부터 5년 동안 협회 준회원으로 등록됩니다. <a href="swim.html">학생 등록하기</a></p>' +
      (list.length ? '<div class="table-scroll"><table class="board-table"><thead><tr><th>학생</th><th>학교·수업</th><th>상태</th><th></th></tr></thead><tbody>' +
        list.map(s => { const g = groups[s.groupId] || {}, member = s.status === 'issued' && s.memberUntil >= today;
          return '<tr><td>' + esc(s.name) + '<br><small>' + esc(s.birth) + '</small></td><td class="col-title">' + esc(groupTitle(g)) + (s.grade ? '<br><small>' + esc(s.grade) + '</small>' : '') + '</td>' +
            '<td><span class="mstatus mstatus-' + (s.status === 'issued' ? 'ok' : s.status === 'evaluated' ? 'wait' : 'off') + '">' + STUDENT_STATUS[s.status] + '</span>' +
            (s.status === 'issued' ? '<br><small>' + esc(s.certNo) + '<br>' + (member ? '준회원 ' + esc(s.memberUntil) + '까지' : '준회원 기간 끝남') + '</small>' : '') + '</td>' +
            '<td class="nowrap">' + (s.status === 'issued' ? '<a class="link-btn" href="swim-certificate.html?id=' + encodeURIComponent(s.id) + '">인증서</a>' : '<a class="link-btn" href="swim.html?g=' + encodeURIComponent(s.groupId) + '">등록 정보</a>') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="board-empty">등록한 학생이 없습니다. 학교에서 받은 등록 링크로 등록해 주세요.</p>');
  } catch (e) { console.error(e); box.innerHTML = '<p class="board-empty">생존수영 인증 정보를 불러오지 못했습니다.</p>'; }
}

/* ---------- 자료실 ---------- */
const levelTag = lv => '<span class="lv-tag lv-' + (lv || 'all') + '">' + LEVEL_NAMES[lv || 'all'] + '</span>';
const joinLink = lv => lv === 'full' ? '<a href="membership.html">정회원 안내</a>' : '<a href="membership-apply.html">멤버십 가입</a>';
async function loadLibrary() {
  const box = document.getElementById('lib-list'), have = myLevel(state.membership, state.isAdmin);
  try {
    const snap = await fs.getDocs(fs.collection(db, 'resources'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.open !== false)
      .sort((a, b) => String(a.category).localeCompare(String(b.category), 'ko') || (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (!list.length) { box.innerHTML = '<p class="board-empty">아직 올라온 자료가 없습니다.</p>'; return; }
    box.innerHTML = '<p class="form-help">협회 교안, 진도표, 평가지, 안전 서식 등을 회원 등급에 따라 받을 수 있습니다. 받은 자료는 협회 교육 목적으로만 써 주세요.</p>' +
      '<ul class="res-list">' + list.map(r => '<li><div><span class="res-cat">' + esc(r.category) + '</span><span class="res-title"><b>' + esc(r.title) + '</b>' + levelTag(r.level) + '</span>' +
        (r.description ? '<p>' + esc(r.description) + '</p>' : '') + '<small>' + esc(r.fileName) + ' · ' + fileSize(r.size) + '</small></div>' +
        (canAccess(r.level, have) ? '<button type="button" class="btn btn-outline btn-sm" data-res="' + r.id + '">받기</button>' : '<span class="res-lock">🔒 ' + joinLink(r.level) + '</span>') + '</li>').join('') + '</ul>';
    box.querySelectorAll('[data-res]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = '받는 중…';
      try { await downloadResource(b.dataset.res); } catch (e) { toast(errMsg(e)); }
      b.disabled = false; b.textContent = '받기';
    }));
  } catch (e) { console.error(e); box.innerHTML = '<p class="board-empty">자료실을 불러오지 못했습니다.</p>'; }
}

/* ---------- 제휴 할인 ---------- */
async function loadPartners() {
  const box = document.getElementById('partner-list'), have = myLevel(state.membership, state.isAdmin), today = todayYmd();
  try {
    const snap = await fs.getDocs(fs.collection(db, 'partners'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.open !== false && (!p.validUntil || p.validUntil >= today)).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!list.length) { box.innerHTML = '<p class="board-empty">준비 중인 제휴 할인이 곧 열립니다.</p>'; return; }
    box.innerHTML = '<p class="form-help">협회 회원을 위한 제휴처 할인입니다. 할인 코드는 등급에 맞는 회원에게만 보이며, 다른 사람과 나누지 말아 주세요.</p>' +
      '<div class="partner-grid">' + list.map(p => '<article class="partner-card"><header><b>' + esc(p.name) + '</b>' + levelTag(p.level) + '</header>' +
        (p.category ? '<small>' + esc(p.category) + '</small>' : '') + '<p class="partner-benefit">' + esc(p.benefit) + '</p>' + (p.description ? '<p>' + esc(p.description) + '</p>' : '') +
        '<p class="form-help">' + (p.validUntil ? p.validUntil + '까지' : '상시') + (/^https:\/\//.test(p.link || '') ? ' · <a href="' + esc(p.link) + '" target="_blank" rel="noopener">제휴처 가기</a>' : '') + '</p>' +
        '<div class="partner-code" data-code="' + p.id + '">' + (canAccess(p.level, have) ? '<button type="button" class="btn btn-primary btn-sm" data-show="' + p.id + '">할인 코드 보기</button>' : '🔒 ' + joinLink(p.level)) + '</div></article>').join('') + '</div>';
    let codes = null;
    box.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        codes = codes || (await callFn('getPartnerCodes', {})).codes;
        const c = codes[b.dataset.show], slot = box.querySelector('[data-code="' + b.dataset.show + '"]');
        slot.innerHTML = c && c.code ? '<code class="coupon">' + esc(c.code) + '</code>' + (c.howTo ? '<small>' + esc(c.howTo) + '</small>' : '') : '<small class="muted">코드 없이 회원증을 보여 주면 할인됩니다.</small>';
      } catch (e) { toast(errMsg(e)); b.disabled = false; }
    }));
  } catch (e) { console.error(e); box.innerHTML = '<p class="board-empty">제휴 할인을 불러오지 못했습니다.</p>'; }
}

/* ---------- 대시보드 ---------- */
async function loadDash() {
  const box = document.getElementById('dash'), uid = state.user.uid, m = state.membership, today = todayYmd(), p = state.profile || {};
  const mine = c => fs.getDocs(fs.query(fs.collection(db, c), fs.where('uid', '==', uid))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(e => { console.warn(c, e); return []; });
  const [quals, comps, enrs, apps] = await Promise.all([mine('qualifications'), mine('completions'), mine('enrollments'), mine('applications')]);
  quals.forEach(q => { q.certNo = q.certNo || q.id; });
  await inboxP;

  // 확인할 일 (만료 임박 등). 저장하지 않고 들어올 때마다 계산
  const todo = [], s = memberStatus(m);
  if (s === 'active' && daysLeft(m) <= M.renewWindowDays) todo.push(['멤버십이 ' + daysLeft(m) + '일 뒤(' + m.endDate + ') 만료됩니다.', 'membership-apply.html', '갱신 신청']);
  if (s === 'grace') todo.push(['멤버십 기간이 끝나 유예 기간입니다. 지금 갱신하면 기간이 이어집니다.', 'membership-apply.html', '갱신 신청']);
  quals.forEach(q => {
    const st = qualStatus(q);
    if (st === 'soon') todo.push([qualTitle(q) + ' 자격이 ' + daysBetween(today, q.expiresOn) + '일 뒤(' + q.expiresOn + ') 만료됩니다. 갱신교육을 이수해 주세요.', 'programs.html', '갱신교육 보기']);
    if (st === 'expired' && daysBetween(q.expiresOn, today) <= 365) todo.push([qualTitle(q) + ' 자격의 유효기간이 ' + q.expiresOn + '에 끝났습니다. 갱신교육을 이수하면 다시 유효해집니다.', 'programs.html', '갱신교육 보기']);
  });
  enrs.forEach(e => {
    if (enrollmentStatus(e) !== 'active') return;
    const left = daysBetween(today, e.endDate);
    if (left <= 14) todo.push(['「' + e.courseTitle + '」 온라인 수강 기간이 ' + left + '일 남았습니다 (' + e.endDate + '까지).', 'learn.html?course=' + encodeURIComponent(e.courseId), '이어서 학습']);
  });
  (await surveyTodo()).filter(x => !x.done).forEach(x => todo.push(['「' + x.item.title + '」 사전 설문(건강 문진표)을 교육 전에 제출해 주세요' + (x.who ? ' (참가자 ' + x.who + ')' : '') + '.', surveyLink(x), '작성하기']));
  if (needsReconfirm(await getConsent())) todo.push(['소식지 수신에 동의한 지 2년이 되어 갑니다. 계속 받을지 다시 확인해 주세요.', '#info', '수신 설정']);
  const waiting = apps.filter(a => a.status === '접수완료');
  if (waiting.length) todo.push(['입금 확인을 기다리는 교육·자격 신청이 ' + waiting.length + '건 있습니다. 협회 안내를 확인해 주세요.', '#apps', '신청 내역']);

  // 요약 카드
  const compIds = new Set(comps.map(c => c.id));
  let planned = 0;
  apps.filter(a => a.status === '승인').forEach(a => (a.items || []).forEach(i => { if (i.type !== 'online' && !compIds.has(a.id + '_' + i.programId)) planned++; }));
  const validQ = quals.filter(q => qualValid(q)), soonQ = quals.filter(q => qualStatus(q) === 'soon');
  const card = (href, title, main, sub) => '<a class="dash-card" href="' + href + '"><span>' + title + '</span><b>' + main + '</b><small>' + sub + '</small></a>';
  const msMain = s === 'none' || s === 'expired' ? '준회원' : TIER_NAMES[m.tier];
  const msSub = s === 'active' ? esc(m.memberNo) + ' · ' + daysLeft(m) + '일 남음' : s === 'grace' ? '유예 기간' : s === 'suspended' ? '정지' : s === 'expired' ? '멤버십 만료' : '멤버십 가입하기';

  box.innerHTML =
    '<div class="dash-hello"><h3>' + esc(p.name || '') + '님, 반갑습니다</h3>' +
      '<p>' + (s === 'active' || s === 'grace' ? TIER_NAMES[m.tier] + ' · ' + esc(m.memberNo) + ' · ' + esc(m.endDate) + '까지' : '준회원 (무료 회원)') + '</p></div>' +
    (todo.length ? '<div class="dash-todo"><h3>확인할 일</h3><ul>' + todo.map(([t, href, label]) =>
      '<li><span>' + esc(t) + '</span><a class="btn btn-outline btn-sm" href="' + esc(href) + '">' + label + '</a></li>').join('') + '</ul></div>' : '') +
    '<div class="dash-cards">' +
      card('#ms', '멤버십', msMain, msSub) +
      card('#qual', '자격증', '유효 ' + validQ.length + '개', soonQ.length ? '갱신 필요 ' + soonQ.length + '개' : quals.length ? '전체 ' + quals.length + '개' : '보유 자격 없음') +
      card('#edu', '내 교육', '수강 예정 ' + planned, '이수 ' + comps.filter(c => c.result === '이수').length + '건') +
      card('#ol', '온라인 학습', '수강 중 ' + enrs.filter(e => enrollmentStatus(e) === 'active').length, '수료 ' + enrs.filter(e => enrollmentStatus(e) === 'passed').length + '건') +
      card('#inbox', '알림', '새 알림 ' + inbox.unread, '전체 ' + inbox.items.length + '건') +
    '</div>' +
    '<div class="dash-recent"><div class="dash-recent-head"><h3>최근 알림</h3><a class="link-btn" href="#inbox">모두 보기</a></div>' +
      (inbox.items.length ? '<ul class="nt-list">' + inbox.items.slice(0, 3).map(noticeItem).join('') + '</ul>' : '<p class="board-empty">받은 알림이 없습니다.</p>') + '</div>';
}

/* ---------- 내 정보 ---------- */
function infoForm(u, p) {
  return '<form class="form-card my-info" id="f">' +
    '<label>이메일<input value="' + esc(u.email) + '" disabled></label>' +
    '<label>이름<input name="name" required maxlength="30" value="' + esc(p.name || '') + '"></label>' +
    '<label>휴대폰 번호<input type="tel" name="phone" value="' + esc(p.phone || '') + '" placeholder="010-0000-0000"></label>' +
    '<label>생년월일 <small>(선택. 입력해 두면 교육·멤버십 신청서에 자동으로 채워집니다)</small><input type="date" name="birth" value="' + esc(p.birth || '') + '"></label>' +
    '<button class="btn btn-primary btn-block" type="submit">정보 저장</button>' +
    (u.providerData.some(x => x.providerId === 'password') ? '<p class="form-links"><button type="button" class="link-btn" id="reset">비밀번호 변경 메일 받기</button></p>' : '') +
    '<p class="uid">계정 ID(UID): <code>' + esc(u.uid) + '</code></p>' +
    '<p class="form-links"><button type="button" class="link-btn" id="withdraw-open">회원 탈퇴</button></p>' +
    '<div class="withdraw" id="withdraw" hidden>' +
      '<h3>회원 탈퇴</h3>' +
      '<ul><li>회원 정보(이름, 이메일, 휴대폰 번호, 생년월일), 장바구니, 알림, 소식지 수신 설정이 바로 삭제되고, 다시 되돌릴 수 없습니다.</li>' +
      '<li>교육·자격 신청 기록은 <a href="privacy.html" target="_blank">개인정보처리방침</a>에 따라 신청일로부터 3년간 보관한 뒤 삭제됩니다.</li>' +
      '<li>멤버십 회비 납부·증빙 기록은 세법에 따라 5년간 보관합니다. 탈퇴하면 남은 멤버십 기간은 사라집니다.</li>' +
      '<li>발급된 생존수영 능력 인증 기록은 준회원 기간이 끝날 때까지 보관합니다.</li>' +
          '<li>작성한 댓글은 자동으로 지워지지 않습니다. 필요하면 탈퇴 전에 직접 삭제해 주세요.</li></ul>' +
      '<label class="check"><input type="checkbox" id="withdraw-ok"> 위 내용을 확인했습니다.</label>' +
      '<div class="btn-row"><button type="button" class="btn btn-outline btn-sm" id="withdraw-cancel">취소</button>' +
      '<button type="button" class="btn btn-danger btn-sm" id="withdraw-go">탈퇴하기</button></div>' +
    '</div>' +
  '</form>';
}
function initInfo(u) {
  const f = document.getElementById('f');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: u.email, birth: f.birth.value };
    try {
      await fs.setDoc(fs.doc(db, 'users', u.uid), data, { merge: true });
      await fa.updateProfile(u, { displayName: data.name });
      state.profile = { ...(state.profile || {}), ...data };
      toast('저장했습니다.');
    } catch (err) { toast(errMsg(err)); }
  });
  const reset = document.getElementById('reset');
  if (reset) reset.addEventListener('click', async () => {
    try { await fa.sendPasswordResetEmail(auth, u.email); toast('비밀번호 변경 메일을 보냈습니다.'); } catch (err) { toast(errMsg(err)); }
  });
}

// 자격증: 보유 자격, 유효기간, 갱신 안내
async function loadQual() {
  const box = document.getElementById('qual');
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'qualifications'), fs.where('uid', '==', state.user.uid)));
    const qs2 = snap.docs.map(d => ({ ...d.data(), certNo: d.id })).sort((a, b) => (b.issuedOn || '').localeCompare(a.issuedOn || ''));
    if (!qs2.length) { box.innerHTML = '<p class="board-empty">보유한 협회 자격이 없습니다. <a href="programs.html">자격 과정 보기</a></p>'; return; }
    const pill = { valid: 'ok', soon: 'wait', expired: 'off', suspended: 'no', revoked: 'no' };
    box.innerHTML = '<div class="table-scroll"><table class="board-table"><thead><tr><th>자격명</th><th>자격번호</th><th class="col-date">유효기간</th><th>상태</th><th></th></tr></thead><tbody>' +
      qs2.map(q => {
        const st = qualStatus(q), left = daysBetween(todayYmd(), q.expiresOn);
        const note = st === 'soon' ? '<br><small>만료 ' + left + '일 전 · <a href="programs.html">갱신교육 신청</a></small>'
          : st === 'expired' ? '<br><small><a href="programs.html">갱신교육</a>을 이수하면 다시 유효해집니다</small>'
          : (st === 'suspended' || st === 'revoked') && q.statusReason ? '<br><small>' + esc(q.statusReason) + '</small>' : '';
        return '<tr><td class="col-title">' + esc(qualTitle(q)) + (q.name !== state.profile?.name ? '<br><small>' + esc(q.name) + '</small>' : '') + '</td><td class="nowrap">' + esc(q.certNo) + '</td>' +
          '<td class="col-date">' + esc(q.issuedOn) + '<br>~ ' + esc(q.expiresOn) + '</td><td><span class="mstatus mstatus-' + pill[st] + '">' + QUAL_STATUS_NAMES[st] + '</span>' + note + '</td>' +
          '<td class="nowrap">' + (st === 'revoked' || st === 'suspended' ? '' : '<a class="link-btn" href="qual-certificate.html?no=' + encodeURIComponent(q.certNo) + '">자격증</a>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  } catch (e) { console.error(e); box.innerHTML = '<p class="board-empty">자격 정보를 불러오지 못했습니다.</p>'; }
}

// 내 교육: 대면 교육·자격 과정별 진행 상태와 이수 결과
async function loadEdu() {
  const box = document.getElementById('edu');
  try {
    const [aSnap, cSnap] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'applications'), fs.where('uid', '==', state.user.uid))),
      fs.getDocs(fs.query(fs.collection(db, 'completions'), fs.where('uid', '==', state.user.uid)))
    ]);
    const comps = Object.fromEntries(cSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    const rows = [];
    aSnap.docs.forEach(d => {
      const a = d.data();
      if (a.status !== '승인' && a.status !== '접수완료') return;
      (a.items || []).filter(i => i.type !== 'online').forEach(i => rows.push({ a, i, c: comps[d.id + '_' + i.programId], created: a.createdAt?.toMillis?.() || 0 }));
    });
    if (!rows.length) { box.innerHTML = '<p class="board-empty">신청한 교육이 없습니다. <a href="programs.html">교육·자격 과정 보기</a></p>'; return; }
    rows.sort((x, y) => y.created - x.created);
    const status = r => r.c && r.c.result === '이수' ? '<span class="mstatus mstatus-ok">이수</span>' + (r.c.score != null ? '<br><small>' + r.c.score + '점</small>' : '')
      : r.c && r.c.result === '미이수' ? '<span class="mstatus mstatus-no">미이수</span>'
      : r.a.status === '승인' ? '<span class="mstatus mstatus-wait">수강 예정</span>' : '<span class="mstatus mstatus-off">신청 접수</span>';
    box.innerHTML = '<div class="table-scroll"><table class="board-table"><thead><tr><th>과정명</th><th class="col-date">일정</th><th>상태</th><th></th></tr></thead><tbody>' +
      rows.map(r => '<tr><td class="col-title">' + esc(r.i.title) + (r.a.applicant && r.a.applicant.guardianName ? '<br><small>참가자 ' + esc(r.a.applicant.name) + '</small>' : '') +
        (r.c && r.c.comment ? '<br><small class="muted">' + esc(r.c.comment) + '</small>' : '') + '</td>' +
        '<td class="col-date">' + esc(r.i.date || '') + '</td><td>' + status(r) + '</td>' +
        '<td class="nowrap">' + (r.c && r.c.result === '이수' ? '<a class="link-btn" href="edu-certificate.html?id=' + encodeURIComponent(r.c.id) + '">이수증</a>' : '') + '</td></tr>').join('') +
      '</tbody></table></div>';
  } catch (e) { console.error(e); box.innerHTML = '<p class="board-empty">교육 정보를 불러오지 못했습니다.</p>'; }
}

// 온라인 학습 (STA의 Begin / Continue 표 방식)
async function loadOnline() {
  const box = document.getElementById('ol');
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'enrollments'), fs.where('uid', '==', state.user.uid)));
    const enrs = snap.docs.map(d => d.data());
    if (!enrs.length) { box.innerHTML = '<p class="board-empty">수강 중인 온라인 과정이 없습니다. <a href="online.html">온라인 학습 보기</a></p>'; return; }
    const courses = {};
    await Promise.all(enrs.map(async e => { const c = await fs.getDoc(fs.doc(db, 'courses', e.courseId)); courses[e.courseId] = c.exists() ? c.data() : null; }));
    box.innerHTML = '<div class="table-scroll"><table class="board-table"><thead><tr><th>과정명</th><th>상태</th><th>진도</th><th class="col-date">기간</th><th></th></tr></thead><tbody>' +
      enrs.map(e => {
        const st = enrollmentStatus(e), c = courses[e.courseId], q = encodeURIComponent(e.courseId);
        const when = st === 'passed' ? '수료 ' + esc(e.passedOn) + (e.validUntil ? '<br><small>인정 ' + esc(e.validUntil) + '까지' + (completionValid(e) ? '' : ' (만료)') + '</small>' : '')
          : esc(e.endDate) + '까지';
        const act = st === 'passed' ? '<a class="link-btn" href="course-certificate.html?course=' + q + '">수료증</a>'
          : st === 'active' ? '<a class="btn btn-primary btn-sm" href="learn.html?course=' + q + '">' + (progressPercent(c, e) ? '이어서 학습' : '학습 시작') + '</a>'
          : '<a class="link-btn" href="online.html#' + q + '">다시 신청</a>';
        return '<tr><td class="col-title">' + esc((c && c.title) || e.courseTitle) + '</td><td>' + ENR_STATUS_NAMES[st] + (st === 'passed' ? '<br><small>' + e.score + '점</small>' : '') + '</td>' +
          '<td>' + progressPercent(c, e) + '%</td><td class="col-date">' + when + '</td><td class="nowrap">' + act + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  } catch (e) { console.error(e); box.innerHTML = '<p class="board-empty">온라인 학습 정보를 불러오지 못했습니다.</p>'; }
}

async function loadMembership() {
  const box = document.getElementById('ms');
  const m = state.membership, s = memberStatus(m), kinds = availableKinds(m);
  let apps = [];
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'membershipApplications'), fs.where('uid', '==', state.user.uid)));
    apps = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  } catch (e) { console.error(e); }
  const pending = apps.find(a => a.status === '접수');

  let html;
  if (s === 'none') {
    html = '<div class="ms-card empty"><p><b>멤버십 회원이 아닙니다.</b></p>' +
      '<p class="form-help">' + TIER_NAMES.general + '(연 ' + won(M.tiers.general.fee) + ')은 교육비 ' + Math.round(M.tiers.general.discount * 100) + '%, ' +
      TIER_NAMES.full + '(연 ' + won(M.tiers.full.fee) + ')은 ' + Math.round(M.tiers.full.discount * 100) + '% 할인을 받습니다.</p>' +
      (pending ? '' : '<p class="btn-row left"><a class="btn btn-primary btn-sm" href="membership-apply.html">멤버십 신청</a><a class="btn btn-outline btn-sm" href="membership.html">회원 안내</a></p>') + '</div>';
  } else {
    const left = daysLeft(m);
    const remain = s === 'active' ? '만료까지 ' + left + '일'
      : s === 'grace' ? '유예 기간 ' + (M.graceDays + left) + '일 남음 · 지금 갱신하면 기간이 이어집니다'
      : s === 'expired' ? '만료되었습니다. 다시 가입해 주세요.' : '사무국으로 문의해 주세요.';
    html = '<div class="ms-card tier-' + esc(m.tier) + '">' +
      '<header><span class="ms-tier">' + TIER_NAMES[m.tier] + '</span>' + statusBadge(m) + '</header>' +
      '<dl class="ms-info"><dt>회원번호</dt><dd>' + esc(m.memberNo) + '</dd>' +
      '<dt>기간</dt><dd>' + esc(m.startDate) + ' ~ ' + esc(m.endDate) + '</dd></dl>' +
      '<p class="ms-remain">' + remain + '</p>' +
      '<p class="btn-row left">' + (s === 'active' || s === 'grace' ? '<a class="btn btn-outline btn-sm" href="membership-card.html">회원증 보기</a>' : '') +
      (!pending && kinds.length ? '<a class="btn btn-primary btn-sm" href="membership-apply.html">' +
        kinds.map(k => KIND_NAMES[k]).join(' · ') + ' 신청</a>' : '') + '</p>' +
      '</div>' +
      '<details class="ms-benefits"><summary>등급별 혜택 보기</summary>' + benefitsTable(m.tier) + '</details>';
  }
  if (pending) {
    html += '<div class="app-card"><header>' + appStatusBadge(pending.status) + '<small>' + fmtDate(pending.createdAt, true) + ' 신청</small></header>' +
      '<p><b>' + KIND_NAMES[pending.kind] + ' · ' + TIER_NAMES[pending.tier] + '</b> · 입금하실 금액 ' + won(pending.fee) + '</p>' +
      '<p class="form-help">사무국이 입금' + (pending.tier === 'full' && pending.kind !== 'renew' ? '과 자격을' : '을') + ' 확인하면 바로 활성화됩니다. ' +
      '<a href="membership-apply.html">입금 안내·신청 취소</a></p></div>';
  }
  const last = apps.find(a => a.status === '반려');
  if (!pending && last && last.adminMemo) html += '<p class="admin-memo">최근 신청이 반려되었습니다: ' + esc(last.adminMemo) + '</p>';
  box.innerHTML = html;
}

function initWithdraw(u) {
  const box = document.getElementById('withdraw');
  const open = () => { box.hidden = false; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  document.getElementById('withdraw-open').addEventListener('click', open);
  document.getElementById('withdraw-cancel').addEventListener('click', () => { box.hidden = true; });
  if (qs('withdraw')) open();

  document.getElementById('withdraw-go').addEventListener('click', async () => {
    if (!document.getElementById('withdraw-ok').checked) { toast('안내 내용을 확인하고 체크해 주세요.'); return; }
    // 계정 삭제는 최근에 로그인한 경우에만 가능하므로, 오래됐으면 다시 로그인부터
    if (Date.now() - Date.parse(u.metadata.lastSignInTime) > 5 * 60 * 1000) {
      toast('보안을 위해 다시 로그인해 주세요.');
      await fa.signOut(auth);
      setTimeout(() => { location.href = 'login.html?back=' + encodeURIComponent('mypage.html?withdraw=1'); }, 1200);
      return;
    }
    const btn = document.getElementById('withdraw-go'); btn.disabled = true;
    try {
      const cart = await fs.getDocs(fs.collection(db, 'users', u.uid, 'cart'));
      const batch = fs.writeBatch(db);
      cart.docs.forEach(d => batch.delete(d.ref));
      const notes = await fs.getDocs(fs.query(fs.collection(db, 'notifications'), fs.where('uid', '==', u.uid)));
      notes.docs.forEach(d => batch.delete(d.ref));
      batch.delete(fs.doc(db, 'users', u.uid, 'state', 'inbox'));
      batch.delete(fs.doc(db, 'marketingConsents', u.uid));
      batch.delete(fs.doc(db, 'users', u.uid));
      await batch.commit();
      await u.delete();
      alert('탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
      location.href = 'index.html';
    } catch (err) { toast(errMsg(err)); btn.disabled = false; }
  });
}

async function loadApps() {
  const box = document.getElementById('apps');
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'applications'), fs.where('uid', '==', state.user.uid)));
    const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (!apps.length) { box.innerHTML = '<p class="board-empty">신청 내역이 없습니다. <a href="programs.html">교육·자격 신청하기</a></p>'; return; }
    box.innerHTML = apps.map(a =>
      '<article class="app-card">' +
        '<header><span class="status status-' + esc(a.status) + '">' + esc(a.status) + '</span><small>' + fmtDate(a.createdAt, true) + ' 신청</small></header>' +
        '<ul>' + a.items.map(i => '<li>[' + esc(i.category) + '] ' + esc(i.title) + (i.date ? ' <small>' + esc(i.date) + '</small>' : '') + '<span>' + won(i.fee) + '</span></li>').join('') + '</ul>' +
        '<footer><b>합계 ' + won(a.total) + '</b>' +
        (a.status === '접수완료' ? '<button type="button" class="btn btn-outline btn-sm" data-cancel="' + a.id + '">신청 취소</button>' : '') +
        '</footer>' +
        (a.adminMemo ? '<p class="admin-memo">협회 안내: ' + esc(a.adminMemo) + '</p>' : '') +
      '</article>'
    ).join('');
    box.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('신청을 취소할까요?')) return;
      try { await fs.updateDoc(fs.doc(db, 'applications', b.getAttribute('data-cancel')), { status: '취소' }); toast('취소했습니다.'); loadApps(); }
      catch (err) { toast(errMsg(err)); }
    }));
  } catch (err) { console.error(err); box.innerHTML = '<p class="board-empty">신청 내역을 불러오지 못했습니다.</p>'; }
}
init();
