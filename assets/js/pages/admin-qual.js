/* 관리자 > 자격증 탭: 이수자 자격 발급·갱신, 자격 목록(정지·취소·회원 연결), 기존 자격 직접 등록
   자격 과정은 [교육·자격 과정] 탭에서 '자격 연계'(종목, 등급, 신규/갱신)를 지정해 둔 과정입니다. */
import { db, fs, toast, errMsg, esc } from '../app.js';
import { todayYmd } from '../membership.js';
import { QUALS, QUAL_GRADES, qualTitle, QUAL_STATUS_NAMES, qualStatus, validUntil, formatCertNo, normNo, normName, verifyId, publicView } from '../qual.js';

let box, programs, comps, quals;
const view = () => document.getElementById('qual-view');
const qualRef = no => fs.doc(db, 'qualifications', no);
const statusPill = q => { const s = qualStatus(q); return '<span class="mstatus mstatus-' + ({ valid: 'ok', soon: 'wait', expired: 'off', suspended: 'no', revoked: 'no' })[s] + '">' + QUAL_STATUS_NAMES[s] + '</span>'; };

// 공개 자격 확인 문서도 함께 맞춤
async function syncVerify(q) { await fs.setDoc(fs.doc(db, 'qualVerify', await verifyId(q.certNo, q.name)), publicView(q)); }

export async function tabQual(container) {
  box = container;
  box.innerHTML = '<div id="qual-view"><p class="board-empty">불러오는 중…</p></div>';
  try {
    const [pSnap, cSnap, qSnap] = await Promise.all([
      fs.getDocs(fs.collection(db, 'programs')), fs.getDocs(fs.collection(db, 'completions')), fs.getDocs(fs.collection(db, 'qualifications'))
    ]);
    programs = Object.fromEntries(pSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    comps = cSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.result === '이수');
    quals = qSnap.docs.map(d => ({ ...d.data(), certNo: d.id })).sort((a, b) => (b.issuedOn || '').localeCompare(a.issuedOn || ''));
  } catch (e) { view().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  draw();
}

// 발급·갱신 대기: 자격 연계 과정을 이수했는데 아직 처리하지 않은 사람
function pendingList() {
  const out = [];
  comps.forEach(c => {
    const p = programs[c.programId];
    if (!p || !QUALS[p.qualType]) return;
    if (p.qualAction === 'renew') {
      if (quals.some(q => (q.renewals || []).some(r => r.completionId === c.id))) return;
      const mine = quals.filter(q => q.typeId === p.qualType && (!p.qualGrade || q.grade === p.qualGrade) && q.status !== 'revoked' && q.uid === c.uid);
      out.push({ c, p, action: 'renew', target: mine.find(q => normName(q.name) === normName(c.name)) || null });
    } else if (!quals.some(q => q.source && q.source.completionId === c.id)) out.push({ c, p, action: 'new' });
  });
  return out.sort((x, y) => (x.c.completedOn || '').localeCompare(y.c.completedOn || ''));
}

function draw(filter = { type: '', status: '', q: '' }) {
  const pend = pendingList();
  const list = quals.filter(q => (!filter.type || q.typeId === filter.type) && (!filter.status || qualStatus(q) === filter.status) &&
    (!filter.q || q.name.includes(filter.q) || q.certNo.includes(normNo(filter.q))));
  view().innerHTML =
    '<p class="form-help">[교육·자격 과정]에서 <b>자격 연계</b>를 지정한 과정을 이수하면 아래 ‘발급 대기’에 모입니다. 유효기간은 결과 발표일(갱신은 갱신교육 이수일)로부터 2년입니다. ' +
      '발급한 자격은 회원 마이페이지와 공개 <a href="verify.html" target="_blank">자격 확인</a> 페이지에서 조회됩니다.</p>' +
    '<h3 class="list-title">발급·갱신 대기 ' + pend.length + '건</h3>' +
    (pend.length ? '<div class="table-scroll"><table class="board-table edu-table"><thead><tr><th>구분</th><th>종목</th><th>이름</th><th>생년월일</th><th>이수한 과정</th><th>결과 발표일</th><th></th></tr></thead><tbody>' +
      pend.map((x, i) => '<tr><td>' + (x.action === 'renew' ? '갱신' : '신규') + '</td><td>' + esc(QUALS[x.p.qualType].name + (x.p.qualGrade ? ' ' + x.p.qualGrade : '')) + '</td>' +
        '<td>' + esc(x.c.name) + '</td><td>' + esc(x.c.birth || '') + '</td><td class="col-title">' + esc(x.c.programTitle) + '<br><small>이수 ' + esc(x.c.completedOn) + ' · ' + esc(x.c.certNo) + '</small></td>' +
        '<td><input type="date" class="mini-input wide" data-date="' + i + '" value="' + esc(x.c.completedOn || todayYmd()) + '"></td>' +
        '<td class="nowrap">' + (x.action === 'renew'
          ? (x.target ? '<small>' + esc(x.target.certNo) + '<br>만료 ' + esc(x.target.expiresOn) + '</small><br><button type="button" class="btn btn-primary btn-sm" data-pend="' + i + '">갱신</button>'
            : '<small class="muted">갱신할 자격이 없습니다.<br>기존 자격을 직접 등록하고 회원을 연결하세요.</small>')
          : '<button type="button" class="btn btn-primary btn-sm" data-pend="' + i + '">자격 발급</button>') + '</td></tr>').join('') +
      '</tbody></table></div>' : '<p class="board-empty">처리할 이수자가 없습니다.</p>') +

    '<h3 class="list-title">자격 목록 ' + quals.length + '건</h3>' +
    '<div class="admin-toolbar"><div class="btn-row left">' +
      '<select id="qf-type"><option value="">모든 종목</option>' + Object.entries(QUALS).map(([k, v]) => '<option value="' + k + '"' + (k === filter.type ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') + '</select>' +
      '<select id="qf-status"><option value="">모든 상태</option>' + Object.entries(QUAL_STATUS_NAMES).map(([k, v]) => '<option value="' + k + '"' + (k === filter.status ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>' +
      '<input id="qf-q" class="mini-input wide" placeholder="이름 또는 자격번호" value="' + esc(filter.q) + '"></div>' +
      '<button type="button" class="btn btn-outline btn-sm" id="q-csv">CSV 내려받기</button></div>' +
    '<div class="table-scroll"><table class="board-table"><thead><tr><th>자격번호</th><th>종목</th><th>이름</th><th>생년월일</th><th class="col-date">취득일</th><th class="col-date">유효기간</th><th>상태</th><th>회원</th></tr></thead><tbody>' +
      (list.length ? list.map(q => '<tr><td class="nowrap"><button type="button" class="link-btn" data-open="' + esc(q.certNo) + '">' + esc(q.certNo) + '</button></td>' +
        '<td>' + esc(qualTitle(q)) + '</td><td>' + esc(q.name) + '</td><td>' + esc(q.birth || '') + '</td><td class="col-date">' + esc(q.issuedOn) + '</td><td class="col-date">' + esc(q.expiresOn) + '</td>' +
        '<td>' + statusPill(q) + '</td><td>' + (q.uid ? '연결됨' : '<span class="muted">미연결</span>') + '</td></tr>').join('')
        : '<tr><td colspan="8">해당하는 자격이 없습니다.</td></tr>') +
    '</tbody></table></div>' +
    '<div id="q-detail"></div>' +

    '<form class="form-card wide" id="qm"><h2>기존 자격 직접 등록</h2>' +
      '<p class="form-help">홈페이지 이전에 발급한 자격이나 오프라인 자격을 등록합니다. 자격번호를 비우면 새 번호가 자동으로 붙습니다.</p>' +
      '<div class="form-row"><label>종목<select name="typeId">' + Object.entries(QUALS).map(([k, v]) => '<option value="' + k + '">' + esc(v.name) + '</option>').join('') + '</select></label>' +
      '<label>등급<select name="grade">' + QUAL_GRADES.map(g => '<option>' + g + '</option>').join('') + '</select></label>' +
      '<label>자격번호 <small>(기존 번호가 있으면 입력)</small><input name="certNo" maxlength="40"></label></div>' +
      '<div class="form-row"><label>이름<input name="name" required maxlength="30"></label><label>생년월일<input type="date" name="birth"></label></div>' +
      '<div class="form-row"><label>결과 발표일(취득일)<input type="date" name="issuedOn" required></label>' +
      '<label>회원 이메일 <small>(선택. 입력하면 그 회원 마이페이지에 보임)</small><input type="email" name="email"></label></div>' +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">등록</button></div></form>';

  const refilter = () => draw({ type: document.getElementById('qf-type').value, status: document.getElementById('qf-status').value, q: document.getElementById('qf-q').value.trim() });
  document.getElementById('qf-type').addEventListener('change', refilter);
  document.getElementById('qf-status').addEventListener('change', refilter);
  document.getElementById('qf-q').addEventListener('change', refilter);
  document.getElementById('q-csv').addEventListener('click', () => downloadCSV(list));
  view().querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => detail(quals.find(q => q.certNo === b.getAttribute('data-open')))));

  view().querySelectorAll('[data-pend]').forEach(b => b.addEventListener('click', async () => {
    const i = b.getAttribute('data-pend'), x = pend[i], date = view().querySelector('[data-date="' + i + '"]').value;
    if (!date) { toast('결과 발표일을 입력해 주세요.'); return; }
    b.disabled = true;
    try {
      if (x.action === 'renew') { await renew(x.target, date, { completionId: x.c.id, programTitle: x.c.programTitle }); toast(x.c.name + '님 자격을 ' + validUntil(date) + '까지 갱신했습니다.'); }
      else { const no = await issue({ typeId: x.p.qualType, grade: x.p.qualGrade || '', uid: x.c.uid, name: x.c.name, birth: x.c.birth || '', issuedOn: date, source: { completionId: x.c.id, programId: x.p.id, programTitle: x.c.programTitle } }); toast(x.c.name + '님: ' + no + ' 발급'); }
      tabQual(box);
    } catch (e) { toast(e.message && !e.code ? e.message : errMsg(e)); b.disabled = false; }
  }));

  const f = document.getElementById('qm');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      let uid = '';
      if (f.email.value.trim()) uid = await findUid(f.email.value.trim());
      const no = await issue({ typeId: f.typeId.value, grade: f.grade.value, uid, name: f.name.value.trim(), birth: f.birth.value, issuedOn: f.issuedOn.value, certNo: normNo(f.certNo.value), source: { manual: true } });
      toast(no + ' 등록했습니다.'); tabQual(box);
    } catch (err) { toast(err.message && !err.code ? err.message : errMsg(err)); }
  });
}

async function findUid(email) {
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'users'), fs.where('email', '==', email)));
  if (!snap.size) throw new Error(email + ' 회원을 찾지 못했습니다.');
  return snap.docs[0].id;
}

// 신규 발급: 자격번호는 종목·연도별 일련번호 (직접 등록 시 기존 번호 사용 가능)
async function issue({ typeId, grade, uid, name, birth, issuedOn, certNo, source }) {
  let q;
  await fs.runTransaction(db, async tx => {
    // 트랜잭션은 읽기를 모두 마친 뒤에 써야 함
    let no = certNo, ctr = null;
    const ctrRef = fs.doc(db, 'counters', 'qual_' + typeId);
    if (!no) {
      const year = issuedOn.slice(0, 4), cs = await tx.get(ctrRef);
      ctr = cs.exists() ? cs.data() : { year, seq: 0 };
      if (ctr.year !== year) ctr = { year, seq: 0 };
      ctr = { year, seq: ctr.seq + 1 };
      no = formatCertNo(typeId, year, ctr.seq);
    }
    if ((await tx.get(qualRef(no))).exists()) throw new Error(no + ' 자격번호가 이미 있습니다.');
    if (ctr) tx.set(ctrRef, ctr);
    q = { uid: uid || '', typeId, typeName: QUALS[typeId].name, grade: grade || '', certNo: no, name, birth: birth || '', issuedOn, expiresOn: validUntil(issuedOn),
      status: 'active', statusReason: '', source, renewals: [], createdAt: fs.serverTimestamp() };
    tx.set(qualRef(no), q);
  });
  await syncVerify(q);
  return q.certNo;
}

// 갱신: 갱신교육 이수일로부터 2년
async function renew(q, on, src) {
  const upd = { expiresOn: validUntil(on), lastRenewedOn: on, renewals: fs.arrayUnion({ on, ...src }), updatedAt: fs.serverTimestamp() };
  await fs.updateDoc(qualRef(q.certNo), upd);
  await syncVerify({ ...q, expiresOn: upd.expiresOn });
}

function detail(q) {
  const box2 = document.getElementById('q-detail');
  box2.innerHTML = '<form class="form-card wide" id="qd"><h2>' + esc(q.certNo) + ' · ' + esc(qualTitle(q)) + '</h2>' +
    '<p>' + esc(q.name) + (q.birth ? ' · ' + esc(q.birth) : '') + ' · 취득 ' + esc(q.issuedOn) + ' · 유효기간 ' + esc(q.expiresOn) + ' ' + statusPill(q) + '</p>' +
    '<p class="form-help">발급 근거: ' + (q.source && q.source.programTitle ? esc(q.source.programTitle) : q.source && q.source.manual ? '직접 등록' : '–') +
      ((q.renewals || []).length ? ' · 갱신 이력: ' + q.renewals.map(r => esc(r.on) + (r.programTitle ? ' (' + esc(r.programTitle) + ')' : '')).join(', ') : '') + '</p>' +
    '<div class="form-row"><label>등급<select name="grade">' + QUAL_GRADES.map(g => '<option' + (g === q.grade ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></label><span></span></div>' +
    '<div class="form-row"><label>상태<select name="status">' + [['active', '유효(정상)'], ['suspended', '정지'], ['revoked', '취소']].map(([k, v]) => '<option value="' + k + '"' + (k === q.status ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
    '<label>사유 <small>(정지·취소 시. 회원에게 보임)</small><input name="reason" maxlength="100" value="' + esc(q.statusReason || '') + '"></label></div>' +
    '<div class="form-row"><label>유효기간 만료일 <small>(특별한 경우에만 직접 수정)</small><input type="date" name="expiresOn" value="' + esc(q.expiresOn) + '"></label>' +
    '<label>회원 연결 <small>(다른 회원으로 바꾸려면 이메일 입력)</small><input type="email" name="email" placeholder="' + (q.uid ? '현재 회원과 연결됨' : '연결 안 됨') + '"></label></div>' +
    (q.uid ? '<label class="check"><input type="checkbox" name="unlink"> 회원 연결 해제 (마이페이지에서 보이지 않게)</label>' : '') +
    '<div class="btn-row"><button type="button" class="btn btn-outline" id="qd-close">닫기</button><button class="btn btn-primary" type="submit">저장</button></div></form>';
  box2.scrollIntoView({ behavior: 'smooth' });
  const f = document.getElementById('qd');
  document.getElementById('qd-close').addEventListener('click', () => { box2.innerHTML = ''; });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const upd = { grade: f.grade.value, status: f.status.value, statusReason: f.status.value === 'active' ? '' : f.reason.value.trim(), expiresOn: f.expiresOn.value || q.expiresOn, updatedAt: fs.serverTimestamp() };
    if (upd.status !== 'active' && !upd.statusReason) { toast('정지·취소 사유를 입력해 주세요.'); return; }
    try {
      const email = f.email.value.trim();
      if (email) upd.uid = await findUid(email);
      else if (f.unlink && f.unlink.checked) upd.uid = '';
      await fs.updateDoc(qualRef(q.certNo), upd);
      await syncVerify({ ...q, ...upd });
      toast('저장했습니다.'); tabQual(box);
    } catch (err) { toast(err.message && !err.code ? err.message : errMsg(err)); }
  });
}

function downloadCSV(list) {
  const rows = [['자격번호', '종목', '등급', '이름', '생년월일', '취득일', '유효기간', '상태', '사유', '최근 갱신일', '발급 근거']].concat(list.map(q => [
    q.certNo, q.typeName, q.grade || '', q.name, q.birth || '', q.issuedOn, q.expiresOn, QUAL_STATUS_NAMES[qualStatus(q)], q.statusReason || '', q.lastRenewedOn || '',
    q.source && q.source.programTitle ? q.source.programTitle : q.source && q.source.manual ? '직접 등록' : '']));
  const text = '﻿' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = '자격목록_' + todayYmd() + '.csv'; a.click(); URL.revokeObjectURL(a.href);
}
