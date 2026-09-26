import { enabled, db, fs, state, requireLogin, disabledNotice, toast, errMsg, esc, fmtDate, won, BOARD_TITLES } from '../app.js';
import { tabMembership } from './admin-membership.js';
import { TIER_NAMES, memberStatus, STATUS_NAMES } from '../membership.js';

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
  el.innerHTML =
    '<div class="admin-tabs" role="tablist">' +
      '<button type="button" data-tab="apps" class="is-active">신청 관리</button>' +
      '<button type="button" data-tab="membership">멤버십</button>' +
      '<button type="button" data-tab="programs">교육·자격 과정</button>' +
      '<button type="button" data-tab="members">회원 목록</button>' +
      '<button type="button" data-tab="posts">게시판</button>' +
    '</div><div id="tab"></div>';
  const tabs = { apps: tabApps, membership: () => tabMembership(tab()), programs: tabPrograms, members: tabMembers, posts: tabPosts };
  el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('is-active', x === b));
    tabs[b.getAttribute('data-tab')]();
  }));
  tabApps();
}
const tab = () => document.getElementById('tab');

/* ---------- 신청 관리 ---------- */
async function tabApps() {
  tab().innerHTML = '<p class="board-empty">불러오는 중…</p>';
  let apps;
  try {
    const snap = await fs.getDocs(fs.collection(db, 'applications'));
    apps = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  } catch (e) { tab().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }

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
          '<ul>' + a.items.map(i => '<li>[' + esc(i.category) + '] ' + esc(i.title) + (i.date ? ' <small>' + esc(i.date) + '</small>' : '') + '<span>' + won(i.fee) + '</span></li>').join('') + '</ul>' +
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
        await fs.updateDoc(fs.doc(db, 'applications', id), { status, adminMemo });
        Object.assign(apps.find(a => a.id === id), { status, adminMemo });
        toast('저장했습니다.'); draw();
      } catch (e) { toast(errMsg(e)); }
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
        toast(old.length + '건을 삭제했습니다.'); draw();
      } catch (e) { toast(errMsg(e)); }
    });
  }
  draw();
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
  let programs;
  try {
    const snap = await fs.getDocs(fs.collection(db, 'programs'));
    programs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
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
      '<label class="check"><input type="checkbox" name="open"' + (p.open ? ' checked' : '') + '> 모집 중 (체크 해제하면 신청 페이지에서 숨김)</label>' +
      '<div class="btn-row">' + (p.id ? '<button type="button" class="btn btn-outline" id="pf-cancel">취소</button>' : '') +
      '<button class="btn btn-primary" type="submit">' + (p.id ? '수정 완료' : '등록') + '</button></div></form>';
  }

  function draw(editing) {
    tab().innerHTML =
      '<table class="board-table"><thead><tr><th>구분</th><th>과정명</th><th class="col-date">일정</th><th>비용</th><th>상태</th><th></th></tr></thead><tbody>' +
      (programs.length ? programs.map(p => '<tr><td>' + esc(p.category) + '</td><td class="col-title">' + esc(p.title) + '</td><td class="col-date">' + esc(p.date) + '</td>' +
        '<td>' + won(p.fee) + '</td><td>' + (p.open ? '<span class="status status-승인">모집 중</span>' : '<span class="status status-취소">마감</span>') + '</td>' +
        '<td class="nowrap"><button type="button" class="link-btn" data-edit="' + p.id + '">수정</button> <button type="button" class="link-btn" data-remove="' + p.id + '">삭제</button></td></tr>').join('')
        : '<tr><td colspan="6">등록된 과정이 없습니다.</td></tr>') +
      '</tbody></table>' + form(editing);

    tab().querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
      draw(programs.find(p => p.id === b.getAttribute('data-edit')));
      document.getElementById('pf').scrollIntoView({ behavior: 'smooth' });
    }));
    tab().querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('이 과정을 삭제할까요? (이미 접수된 신청 내역은 남습니다)')) return;
      try { await fs.deleteDoc(fs.doc(db, 'programs', b.getAttribute('data-remove'))); toast('삭제했습니다.'); tabPrograms(); }
      catch (e) { toast(errMsg(e)); }
    }));
    const cancel = document.getElementById('pf-cancel');
    if (cancel) cancel.addEventListener('click', () => draw());

    const f = document.getElementById('pf');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const data = {
        category: f.category.value, title: f.title.value.trim(), date: f.date.value.trim(), place: f.place.value.trim(),
        capacity: f.capacity.value ? Number(f.capacity.value) : '', deadline: f.deadline.value.trim(),
        fee: Number(f.fee.value) || 0, order: Number(f.order.value) || 0, description: f.description.value, open: f.open.checked
      };
      try {
        const id = f.getAttribute('data-id');
        if (id) await fs.updateDoc(fs.doc(db, 'programs', id), data);
        else await fs.addDoc(fs.collection(db, 'programs'), { ...data, createdAt: fs.serverTimestamp() });
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
    const [snap, msSnap] = await Promise.all([fs.getDocs(fs.collection(db, 'users')), fs.getDocs(fs.collection(db, 'memberships'))]);
    const ms = Object.fromEntries(msSnap.docs.map(d => [d.id, d.data()]));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const tierText = m => m ? TIER_NAMES[m.tier] + ' <small>(' + STATUS_NAMES[memberStatus(m)] + ')</small>' : '<span class="muted">–</span>';
    tab().innerHTML = '<p class="board-count">전체 회원 <b>' + users.length + '</b>명 <small>(멤버십 관리는 [멤버십] 탭)</small></p>' +
      '<div class="table-scroll"><table class="board-table"><thead><tr><th>이름</th><th>이메일</th><th>휴대폰</th><th>멤버십</th><th class="col-date">가입일</th></tr></thead><tbody>' +
      users.map(u => '<tr><td>' + esc(u.name) + '</td><td class="col-title">' + esc(u.email) + '</td><td>' + esc(u.phone) + '</td><td>' + tierText(ms[u.id]) + '</td><td class="col-date">' + fmtDate(u.createdAt) + '</td></tr>').join('') +
      '</tbody></table></div>';
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
      toast(n + '개의 글을 가져왔습니다.');
    } catch (e) { toast(errMsg(e)); }
  });
}

init();
