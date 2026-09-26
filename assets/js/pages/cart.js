import { enabled, db, fs, state, requireLogin, disabledNotice, toast, errMsg, esc, won } from '../app.js';

const el = document.getElementById('cart');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  const cartCol = fs.collection(db, 'users', state.user.uid, 'cart');
  let items = [];

  fs.onSnapshot(cartCol, snap => {
    items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    draw();
  }, err => { console.error(err); el.innerHTML = '<p class="board-empty">장바구니를 불러오지 못했습니다.</p>'; });

  function draw() {
    if (!items.length) {
      el.innerHTML = '<p class="board-empty">장바구니가 비어 있습니다.</p><p class="center"><a class="btn btn-primary" href="programs.html">교육·자격 과정 보기</a></p>';
      return;
    }
    const total = items.reduce((s, i) => s + (Number(i.fee) || 0), 0);
    const p = state.profile || {};
    el.innerHTML =
      '<table class="board-table cart-table"><thead><tr><th>구분</th><th>과정명</th><th class="col-date">일정</th><th>비용</th><th></th></tr></thead><tbody>' +
      items.map(i => '<tr><td>' + esc(i.category) + '</td><td class="col-title">' + esc(i.title) + '</td><td class="col-date">' + esc(i.date) + '</td>' +
        '<td>' + won(i.fee) + '</td><td><button type="button" class="link-btn" data-remove="' + i.id + '">삭제</button></td></tr>').join('') +
      '</tbody></table>' +
      '<p class="cart-total">합계 <b>' + won(total) + '</b></p>' +
      '<form class="form-card wide" id="f"><h2>신청자 정보</h2>' +
        '<div class="form-row">' +
          '<label>이름<input name="name" required maxlength="30" value="' + esc(p.name || '') + '"></label>' +
          '<label>생년월일<input type="date" name="birth" required></label>' +
        '</div><div class="form-row">' +
          '<label>휴대폰 번호<input type="tel" name="phone" required value="' + esc(p.phone || '') + '" placeholder="010-0000-0000"></label>' +
          '<label>이메일<input type="email" name="email" required value="' + esc(state.user.email || '') + '"></label>' +
        '</div>' +
        '<label>소속 / 메모 <small>(선택)</small><textarea name="memo" rows="3" maxlength="500"></textarea></label>' +
        '<p class="form-help">신청이 접수되면 협회에서 확인 후 연락드립니다. 비용이 있는 과정은 입금 안내를 별도로 드립니다.</p>' +
        '<button class="btn btn-primary btn-block" type="submit">신청서 제출</button>' +
      '</form>';

    el.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
      try { await fs.deleteDoc(fs.doc(cartCol, b.getAttribute('data-remove'))); } catch (e) { toast(errMsg(e)); }
    }));

    const f = document.getElementById('f');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const batch = fs.writeBatch(db);
        batch.set(fs.doc(fs.collection(db, 'applications')), {
          uid: state.user.uid,
          applicant: { name: f.name.value.trim(), birth: f.birth.value, phone: f.phone.value.trim(), email: f.email.value.trim() },
          memo: f.memo.value.trim(),
          items: items.map(i => ({ programId: i.programId, title: i.title, category: i.category, date: i.date || '', fee: Number(i.fee) || 0 })),
          total, status: '접수완료', createdAt: fs.serverTimestamp()
        });
        items.forEach(i => batch.delete(fs.doc(cartCol, i.id)));
        await batch.commit();
        location.href = 'mypage.html';
      } catch (err) { toast(errMsg(err)); btn.disabled = false; }
    });
  }
}
init();
