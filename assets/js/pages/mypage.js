import { enabled, auth, db, fa, fs, state, requireLogin, disabledNotice, toast, errMsg, esc, fmtDate, won, qs, logout } from '../app.js';

const el = document.getElementById('mypage');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  if (qs('welcome')) toast('가입을 환영합니다!');
  const u = state.user, p = state.profile || {};

  el.innerHTML =
    '<div class="mypage-grid">' +
      '<form class="form-card" id="f"><h2>내 정보</h2>' +
        '<label>이메일<input value="' + esc(u.email) + '" disabled></label>' +
        '<label>이름<input name="name" required maxlength="30" value="' + esc(p.name || '') + '"></label>' +
        '<label>휴대폰 번호<input type="tel" name="phone" value="' + esc(p.phone || '') + '" placeholder="010-0000-0000"></label>' +
        '<button class="btn btn-primary btn-block" type="submit">정보 저장</button>' +
        '<p class="form-links">' +
          (u.providerData.some(x => x.providerId === 'password') ? '<button type="button" class="link-btn" id="reset">비밀번호 변경 메일 받기</button><i>|</i>' : '') +
          '<button type="button" class="link-btn" id="logout">로그아웃</button></p>' +
        '<p class="uid">회원 번호(UID): <code>' + esc(u.uid) + '</code></p>' +
        '<p class="form-links"><button type="button" class="link-btn" id="withdraw-open">회원 탈퇴</button></p>' +
        '<div class="withdraw" id="withdraw" hidden>' +
          '<h3>회원 탈퇴</h3>' +
          '<ul><li>회원 정보(이름, 이메일, 휴대폰 번호)와 장바구니가 바로 삭제되고, 다시 되돌릴 수 없습니다.</li>' +
          '<li>교육·자격 신청 기록은 <a href="privacy.html" target="_blank">개인정보처리방침</a>에 따라 신청일로부터 3년간 보관한 뒤 삭제됩니다.</li>' +
          '<li>작성한 댓글은 자동으로 지워지지 않습니다. 필요하면 탈퇴 전에 직접 삭제해 주세요.</li></ul>' +
          '<label class="check"><input type="checkbox" id="withdraw-ok"> 위 내용을 확인했습니다.</label>' +
          '<div class="btn-row"><button type="button" class="btn btn-outline btn-sm" id="withdraw-cancel">취소</button>' +
          '<button type="button" class="btn btn-danger btn-sm" id="withdraw-go">탈퇴하기</button></div>' +
        '</div>' +
      '</form>' +
      '<section class="my-apps"><h2>교육·자격 신청 내역</h2><div id="apps"><p class="board-empty">불러오는 중…</p></div></section>' +
    '</div>';

  const f = document.getElementById('f');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await fs.setDoc(fs.doc(db, 'users', u.uid), { name: f.name.value.trim(), phone: f.phone.value.trim(), email: u.email }, { merge: true });
      await fa.updateProfile(u, { displayName: f.name.value.trim() });
      toast('저장했습니다.');
    } catch (err) { toast(errMsg(err)); }
  });
  const reset = document.getElementById('reset');
  if (reset) reset.addEventListener('click', async () => {
    try { await fa.sendPasswordResetEmail(auth, u.email); toast('비밀번호 변경 메일을 보냈습니다.'); } catch (err) { toast(errMsg(err)); }
  });
  document.getElementById('logout').addEventListener('click', logout);
  initWithdraw(u);
  loadApps();
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
