/* 관리자 > 멤버십 탭: 신청 처리(심사·입금 확인·활성화), 증빙 발급, 회원 목록 */
import { db, fs, toast, errMsg, esc, fmtDate, won } from '../app.js';
import { MEMBERSHIP as M, TIER_NAMES, KIND_NAMES, STATUS_NAMES, memberStatus, daysLeft, nextPeriod,
  formatMemberNo, retierMemberNo, todayYmd, addDays } from '../membership.js';
import { statusBadge, appStatusBadge } from '../membership-ui.js';

const RECEIPT_NAMES = { none: '필요 없음', '대기': '발급 대기', '발급': '발급 완료', '취소필요': '취소 발급 필요', '취소': '취소 완료' };
let box, view = 'apps';

export function tabMembership(container) {
  box = container;
  box.innerHTML = '<div class="chips sub-chips">' +
    [['apps', '신청 처리'], ['receipts', '증빙 발급'], ['members', '회원 목록']].map(([k, v]) =>
      '<button type="button" class="chip' + (k === view ? ' is-active' : '') + '" data-view="' + k + '">' + v + '</button>').join('') +
    '</div><div id="ms-view"><p class="board-empty">불러오는 중…</p></div>';
  box.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.getAttribute('data-view'); tabMembership(box); }));
  ({ apps: viewApps, receipts: viewReceipts, members: viewMembers })[view]();
}
const target = () => document.getElementById('ms-view');

async function loadApps() {
  const snap = await fs.getDocs(fs.collection(db, 'membershipApplications'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}
async function loadMembers() {
  const snap = await fs.getDocs(fs.collection(db, 'memberships'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

function receiptText(r) {
  if (!r || r.type === 'none') return '증빙 필요 없음';
  if (r.type === 'cash') return '현금영수증 · ' + esc(r.phone);
  return '계산서 · ' + esc(r.bizName) + ' (' + esc(r.bizNo) + ') · 대표 ' + esc(r.bizOwner) + ' · ' + esc(r.email);
}

/* ---------- 신청 처리 ---------- */
async function viewApps() {
  let apps;
  try { apps = await loadApps(); } catch (e) { target().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  let filter = '접수';
  function draw() {
    const list = filter === '전체' ? apps : apps.filter(a => a.status === filter);
    target().innerHTML =
      '<div class="admin-toolbar"><div class="chips">' + ['접수', '활성화', '반려', '취소', '환불', '전체'].map(s =>
        '<button type="button" class="chip' + (s === filter ? ' is-active' : '') + '" data-filter="' + s + '">' + s + ' ' +
        (s === '전체' ? apps.length : apps.filter(a => a.status === s).length) + '</button>').join('') + '</div></div>' +
      (list.length ? list.map(appCard).join('') : '<p class="board-empty">해당하는 신청이 없습니다.</p>');
    target().querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.getAttribute('data-filter'); draw(); }));
    target().querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.getAttribute('data-act'), apps.find(a => a.id === b.getAttribute('data-id')))));
  }
  async function act(kind, a) {
    try {
      if (kind === 'activate') {
        if (!confirm(a.applicant.name + '님의 ' + KIND_NAMES[a.kind] + '(' + won(a.fee) + ') 입금을 확인하고 활성화할까요?')) return;
        await activate(a); toast('활성화했습니다.');
      } else if (kind === 'reject') {
        const memo = document.getElementById('memo-' + a.id).value.trim();
        if (!memo) { toast('반려 사유를 입력해 주세요. 신청자에게 보입니다.'); return; }
        await fs.updateDoc(fs.doc(db, 'membershipApplications', a.id), { status: '반려', adminMemo: memo, receiptStatus: 'none', processedOn: todayYmd() });
        toast('반려했습니다.');
      } else if (kind === 'refund') {
        if (!confirm('환불 처리할까요? 멤버십 기간이 신청 전 상태로 돌아갑니다. 발급한 증빙은 취소 발급이 필요합니다.')) return;
        await refund(a); toast('환불 처리했습니다.');
      }
      apps = await loadApps(); draw();
    } catch (e) { toast(e.message && !e.code ? e.message : errMsg(e)); }
  }
  draw();
}

function appCard(a) {
  const q = a.qualification;
  return '<article class="app-card admin">' +
    '<header>' + appStatusBadge(a.status) + '<b>' + KIND_NAMES[a.kind] + ' · ' + TIER_NAMES[a.tier] + '</b><small>' + fmtDate(a.createdAt, true) + '</small></header>' +
    '<p class="applicant"><b>' + esc(a.applicant.name) + '</b> · ' + esc(a.applicant.birth) + ' · ' + esc(a.applicant.phone) + ' · ' + esc(a.applicant.email) + '</p>' +
    (a.currentMemberNo ? '<p class="form-help">현재 ' + esc(a.currentMemberNo) + ' · 만료 ' + esc(a.currentEndDate) + '</p>' : '') +
    '<p class="pay-line">입금액 <b>' + won(a.fee) + '</b> · 입금자명 <b>' + esc(a.depositor) + '</b>' +
      (a.alumni ? ' · <span class="guardian-line">준회원 출신 할인 (인증서 ' + esc(a.alumni.certNo) + ') 확인 필요</span>' : '') + '</p>' +
    (q ? '<p class="memo">자격: ' + (q.type === 'kwsa' ? '협회 자격' : '외부 자격') + ' · ' + esc(q.name) + ' · 번호 ' + esc(q.number) +
      (q.type === 'external' ? ' · ' + esc(q.issuer) : '') + (q.date ? ' · 취득 ' + esc(q.date) : '') + ' · 윤리강령 동의 ' + (a.ethicsAgreed ? '✓' : '✗') + '</p>' : '') +
    '<p class="form-help">' + receiptText(a.receipt) + ' · ' + RECEIPT_NAMES[a.receiptStatus || 'none'] + '</p>' +
    (a.status === '활성화' ? '<p class="form-help">회원번호 ' + esc(a.memberNo) + ' · 기간 ' + esc(a.periodStart) + ' ~ ' + esc(a.periodEnd) + ' · 처리 ' + esc(a.processedOn) + '</p>' : '') +
    (a.adminMemo ? '<p class="admin-memo">사유: ' + esc(a.adminMemo) + '</p>' : '') +
    (a.status === '접수' ? '<footer class="admin-app-foot">' +
      '<input id="memo-' + a.id + '" placeholder="반려 사유 (신청자에게 보임)">' +
      '<button type="button" class="btn btn-outline btn-sm" data-act="reject" data-id="' + a.id + '">반려</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-act="activate" data-id="' + a.id + '">입금 확인·활성화</button></footer>' : '') +
    (a.status === '활성화' ? '<footer class="admin-app-foot"><span></span><button type="button" class="btn btn-outline btn-sm" data-act="refund" data-id="' + a.id + '">환불 처리</button></footer>' : '') +
    '</article>';
}

// 입금 확인 → 회원번호 부여, 기간 계산, 멤버십 반영 (한 번에 저장)
async function activate(a) {
  const today = todayYmd();
  await fs.runTransaction(db, async tx => {
    const appRef = fs.doc(db, 'membershipApplications', a.id);
    const msRef = fs.doc(db, 'memberships', a.uid);
    const ctrRef = fs.doc(db, 'counters', 'membership');
    const appSnap = await tx.get(appRef), msSnap = await tx.get(msRef), ctrSnap = await tx.get(ctrRef);
    if (appSnap.data().status !== '접수') throw new Error('이미 처리된 신청입니다. 새로고침해 주세요.');
    const m = msSnap.exists() ? msSnap.data() : null;
    const tier = a.kind === 'upgrade' ? 'full' : a.tier;
    let memberNo = m && m.memberNo;
    if (!memberNo) {
      const year = today.slice(0, 4);
      let ctr = ctrSnap.exists() ? ctrSnap.data() : { year, seq: 0 };
      if (ctr.year !== year) ctr = { year, seq: 0 };
      ctr = { year, seq: ctr.seq + 1 };
      tx.set(ctrRef, ctr);
      memberNo = formatMemberNo(tier, year, ctr.seq);
    } else if (m.tier !== tier) memberNo = retierMemberNo(memberNo, tier);
    const period = nextPeriod(a.kind, m, today);
    tx.set(msRef, {
      tier, memberNo, startDate: period.startDate, endDate: period.endDate, suspended: false,
      name: a.applicant.name, email: a.applicant.email,
      qualification: a.qualification || (m && m.qualification) || null,
      lastApplicationId: a.id, updatedAt: fs.serverTimestamp()
    });
    tx.update(appRef, {
      status: '활성화', memberNo, periodStart: period.startDate, periodEnd: period.endDate,
      prevTier: m ? m.tier : '', prevEndDate: m ? m.endDate : '', prevStartDate: m ? m.startDate : '',
      processedOn: today, processedAt: fs.serverTimestamp()
    });
  });
}

// 환불: 멤버십을 신청 전 상태로 되돌림
async function refund(a) {
  const msRef = fs.doc(db, 'memberships', a.uid), appRef = fs.doc(db, 'membershipApplications', a.id);
  const batch = fs.writeBatch(db);
  if (a.kind === 'join' && !a.prevEndDate) batch.delete(msRef);
  else if (a.kind === 'upgrade') batch.update(msRef, { tier: a.prevTier || 'general', memberNo: retierMemberNo(a.memberNo, a.prevTier || 'general'), updatedAt: fs.serverTimestamp() });
  else batch.update(msRef, { startDate: a.prevStartDate || a.periodStart, endDate: a.prevEndDate || addDays(todayYmd(), -(M.graceDays + 1)), updatedAt: fs.serverTimestamp() });
  batch.update(appRef, {
    status: '환불', refundedOn: todayYmd(),
    receiptStatus: a.receiptStatus === '발급' ? '취소필요' : a.receiptStatus === '대기' ? 'none' : (a.receiptStatus || 'none')
  });
  await batch.commit();
}

/* ---------- 증빙 발급 ---------- */
async function viewReceipts() {
  let apps;
  try { apps = await loadApps(); } catch (e) { target().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  // 발급은 입금 확인(활성화) 후, 취소 발급은 환불 후
  const todo = apps.filter(a => (a.status === '활성화' && a.receiptStatus === '대기') || a.receiptStatus === '취소필요');
  const done = apps.filter(a => a.receiptStatus === '발급' || a.receiptStatus === '취소').slice(0, 30);
  const row = a => '<tr><td>' + esc(a.processedOn || '') + '</td><td>' + esc(a.applicant.name) + '</td><td>' + won(a.fee) + '</td>' +
    '<td class="col-title">' + receiptText(a.receipt) + '</td><td>' + RECEIPT_NAMES[a.receiptStatus] + (a.receiptNo ? '<br><small>' + esc(a.receiptNo) + '</small>' : '') + '</td>';
  target().innerHTML =
    '<p class="form-help">홈택스에서 발급한 뒤 승인번호를 적고 [발급 완료]를 누르세요. 협회는 면세 사업자이므로 사업자에게는 <b>계산서</b>를 발급합니다.</p>' +
    '<h3 class="list-title">발급할 증빙 ' + todo.length + '건</h3>' +
    (todo.length ? '<div class="table-scroll"><table class="board-table"><thead><tr><th>확인일</th><th>이름</th><th>금액</th><th>발급 정보</th><th>상태</th><th>처리</th></tr></thead><tbody>' +
      todo.map(a => row(a) + '<td class="nowrap"><input class="mini-input" id="rno-' + a.id + '" placeholder="승인번호">' +
        '<button type="button" class="btn btn-primary btn-sm" data-issue="' + a.id + '">' + (a.receiptStatus === '취소필요' ? '취소 완료' : '발급 완료') + '</button></td></tr>').join('') +
      '</tbody></table></div>' : '<p class="board-empty">발급할 증빙이 없습니다.</p>') +
    '<h3 class="list-title">최근 처리</h3>' +
    (done.length ? '<div class="table-scroll"><table class="board-table"><thead><tr><th>확인일</th><th>이름</th><th>금액</th><th>발급 정보</th><th>상태</th></tr></thead><tbody>' +
      done.map(a => row(a) + '</tr>').join('') + '</tbody></table></div>' : '<p class="board-empty">처리한 증빙이 없습니다.</p>') +
    '<p class="btn-row left"><button type="button" class="btn btn-outline btn-sm" id="rcsv">증빙 목록 CSV</button></p>';

  target().querySelectorAll('[data-issue]').forEach(b => b.addEventListener('click', async () => {
    const a = apps.find(x => x.id === b.getAttribute('data-issue'));
    const no = document.getElementById('rno-' + a.id).value.trim();
    if (!no) { toast('승인번호를 입력해 주세요.'); return; }
    const cancel = a.receiptStatus === '취소필요';
    try {
      await fs.updateDoc(fs.doc(db, 'membershipApplications', a.id), cancel
        ? { receiptStatus: '취소', receiptCancelNo: no, receiptCancelledOn: todayYmd() }
        : { receiptStatus: '발급', receiptNo: no, receiptIssuedOn: todayYmd() });
      toast(cancel ? '취소 발급을 기록했습니다.' : '발급 완료로 기록했습니다.'); viewReceipts();
    } catch (e) { toast(errMsg(e)); }
  }));
  document.getElementById('rcsv').addEventListener('click', () => csv('증빙목록',
    [['확인일', '이름', '금액', '구분', '휴대폰(현금영수증)', '사업자번호', '상호', '대표자', '이메일', '상태', '승인번호']].concat(
      apps.filter(a => a.receipt && a.receipt.type !== 'none').map(a => [a.processedOn || '', a.applicant.name, a.fee,
        a.receipt.type === 'cash' ? '현금영수증' : '계산서', a.receipt.phone || '', a.receipt.bizNo || '', a.receipt.bizName || '',
        a.receipt.bizOwner || '', a.receipt.email || '', RECEIPT_NAMES[a.receiptStatus] || '', a.receiptNo || '']))));
}

/* ---------- 회원 목록 ---------- */
async function viewMembers() {
  let members;
  try { members = await loadMembers(); } catch (e) { target().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  const soon = m => memberStatus(m) === 'active' && daysLeft(m) <= M.renewWindowDays;
  const filters = {
    '전체': () => true, '활성': m => memberStatus(m) === 'active', '만료 임박': soon,
    '유예': m => memberStatus(m) === 'grace', '만료': m => memberStatus(m) === 'expired', '정지': m => memberStatus(m) === 'suspended',
    [TIER_NAMES.general]: m => m.tier === 'general', [TIER_NAMES.full]: m => m.tier === 'full'
  };
  let filter = '전체';
  function draw() {
    const list = members.filter(filters[filter]).sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
    const activeCount = t => members.filter(m => m.tier === t && ['active', 'grace'].includes(memberStatus(m))).length;
    target().innerHTML =
      '<p class="board-count">유효 회원 ' + TIER_NAMES.general + ' <b>' + activeCount('general') + '</b>명 · ' + TIER_NAMES.full + ' <b>' + activeCount('full') +
      '</b>명 · 만료 ' + M.renewWindowDays + '일 이내 <b>' + members.filter(soon).length + '</b>명</p>' +
      '<div class="admin-toolbar"><div class="chips">' + Object.keys(filters).map(k =>
        '<button type="button" class="chip' + (k === filter ? ' is-active' : '') + '" data-filter="' + k + '">' + k + ' ' + members.filter(filters[k]).length + '</button>').join('') +
      '</div><button type="button" class="btn btn-outline btn-sm" id="mcsv">CSV 내려받기</button></div>' +
      (list.length ? '<div class="table-scroll"><table class="board-table"><thead><tr><th>회원번호</th><th>이름</th><th>등급</th><th class="col-date">기간</th><th>상태</th><th>이메일</th><th></th></tr></thead><tbody>' +
        list.map(m => '<tr><td class="nowrap">' + esc(m.memberNo) + '</td><td>' + esc(m.name) + '</td><td>' + TIER_NAMES[m.tier] + '</td>' +
          '<td class="col-date">' + esc(m.startDate) + '<br>~ ' + esc(m.endDate) + '</td><td>' + statusBadge(m) +
          (soon(m) ? '<br><small>' + daysLeft(m) + '일 남음</small>' : '') + '</td><td class="col-title">' + esc(m.email) + '</td>' +
          '<td><button type="button" class="link-btn" data-suspend="' + m.uid + '">' + (m.suspended ? '정지 해제' : '정지') + '</button></td></tr>').join('') +
        '</tbody></table></div>' : '<p class="board-empty">해당하는 회원이 없습니다.</p>');
    target().querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.getAttribute('data-filter'); draw(); }));
    target().querySelectorAll('[data-suspend]').forEach(b => b.addEventListener('click', async () => {
      const m = members.find(x => x.uid === b.getAttribute('data-suspend'));
      if (!confirm(m.name + '님의 멤버십을 ' + (m.suspended ? '정지 해제' : '정지') + '할까요?')) return;
      try {
        await fs.updateDoc(fs.doc(db, 'memberships', m.uid), { suspended: !m.suspended, updatedAt: fs.serverTimestamp() });
        m.suspended = !m.suspended; draw();
      } catch (e) { toast(errMsg(e)); }
    }));
    document.getElementById('mcsv').addEventListener('click', () => csv('멤버십회원',
      [['회원번호', '이름', '등급', '시작일', '만료일', '상태', '이메일', '보유 자격']].concat(
        list.map(m => [m.memberNo, m.name, TIER_NAMES[m.tier], m.startDate, m.endDate, STATUS_NAMES[memberStatus(m)], m.email,
          m.qualification ? m.qualification.name + ' ' + (m.qualification.number || '') : '']))));
  }
  draw();
}

function csv(name, rows) {
  const text = '﻿' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name + '_' + todayYmd() + '.csv';
  a.click(); URL.revokeObjectURL(a.href);
}
