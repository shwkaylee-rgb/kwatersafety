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
      '<form class="form-card wide" id="f"><h2>신청서</h2>' +
        '<fieldset class="choice"><legend>신청 구분</legend>' +
          '<label class="check"><input type="radio" name="type" value="self" checked> 본인 신청</label>' +
          '<label class="check"><input type="radio" name="type" value="guardian"> 보호자가 자녀(만 14세 미만) 대신 신청</label>' +
        '</fieldset>' +
        '<h3 class="form-sub">참가자 정보</h3>' +
        '<div class="form-row">' +
          '<label><span data-label-name>이름</span><input name="name" required maxlength="30" value="' + esc(p.name || '') + '"></label>' +
          '<label>생년월일<input type="date" name="birth" required></label>' +
        '</div>' +
        '<div class="guardian" id="guardian" hidden>' +
          '<h3 class="form-sub">보호자(법정대리인) 정보</h3>' +
          '<div class="form-row">' +
            '<label>보호자 이름<input name="guardianName" maxlength="30" value="' + esc(p.name || '') + '"></label>' +
            '<label>참가자와의 관계<input name="relation" maxlength="20" placeholder="예: 부, 모"></label>' +
          '</div>' +
        '</div>' +
        '<h3 class="form-sub" data-contact-title>연락처</h3>' +
        '<div class="form-row">' +
          '<label>휴대폰 번호<input type="tel" name="phone" required value="' + esc(p.phone || '') + '" placeholder="010-0000-0000"></label>' +
          '<label>이메일<input type="email" name="email" required value="' + esc(state.user.email || '') + '"></label>' +
        '</div>' +
        '<label>소속 / 메모 <small>(선택)</small><textarea name="memo" rows="3" maxlength="500"></textarea></label>' +
        '<div class="agree">' +
          '<p><strong>개인정보 수집·이용 동의</strong><br>수집 항목: 참가자 이름·생년월일, 연락처(휴대폰, 이메일), 보호자 신청 시 보호자 이름·관계<br>' +
          '이용 목적: 교육·자격 신청 접수, 본인 확인, 일정 안내, 이수·자격 확인<br>보유 기간: 신청일로부터 3년 ' +
          '<a href="privacy.html" target="_blank">개인정보처리방침</a></p>' +
          '<label class="check"><input type="checkbox" name="agree" required> 위 개인정보 수집·이용에 동의합니다. (필수)</label>' +
          '<label class="check" id="guardian-agree" hidden><input type="checkbox" name="guardianAgree"> 법정대리인으로서 자녀의 개인정보 수집·이용에 동의합니다. (필수)</label>' +
        '</div>' +
        '<p class="form-help">신청이 접수되면 협회에서 확인 후 연락드립니다. 비용이 있는 과정은 입금 안내를 별도로 드립니다.</p>' +
        '<button class="btn btn-primary btn-block" type="submit">신청서 제출</button>' +
      '</form>';

    el.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
      try { await fs.deleteDoc(fs.doc(cartCol, b.getAttribute('data-remove'))); } catch (e) { toast(errMsg(e)); }
    }));

    const f = document.getElementById('f');
    const isGuardian = () => f.type.value === 'guardian';
    function syncType() {
      const g = isGuardian();
      document.getElementById('guardian').hidden = !g;
      document.getElementById('guardian-agree').hidden = !g;
      f.guardianName.required = g; f.relation.required = g; f.guardianAgree.required = g;
      f.querySelector('[data-label-name]').textContent = g ? '자녀 이름' : '이름';
      f.querySelector('[data-contact-title]').textContent = g ? '보호자 연락처' : '연락처';
      if (g && f.name.value === (p.name || '')) f.name.value = '';
    }
    f.querySelectorAll('[name=type]').forEach(r => r.addEventListener('change', syncType));

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const age = ageOn(f.birth.value);
      if (!isGuardian() && age < 14) { toast('만 14세 미만은 "보호자가 자녀 대신 신청"으로 신청해 주세요.'); return; }
      if (isGuardian() && age >= 14) { toast('만 14세 이상은 본인 신청으로 해 주세요.'); return; }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      const applicant = { name: f.name.value.trim(), birth: f.birth.value, phone: f.phone.value.trim(), email: f.email.value.trim() };
      if (isGuardian()) Object.assign(applicant, { guardianName: f.guardianName.value.trim(), relation: f.relation.value.trim(), guardianConsent: true });
      try {
        const batch = fs.writeBatch(db);
        batch.set(fs.doc(fs.collection(db, 'applications')), {
          uid: state.user.uid,
          applicant, agreePrivacy: true,
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
// 오늘 기준 만 나이
function ageOn(birth) {
  const b = new Date(birth), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
init();
