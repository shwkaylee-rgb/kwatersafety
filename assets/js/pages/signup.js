import { enabled, auth, db, fa, fs, ready, state, disabledNotice, toast, errMsg } from '../app.js';

const el = document.getElementById('signup');

async function init() {
  if (!enabled) return disabledNotice(el);
  await ready;
  if (state.user) { location.replace('mypage.html'); return; }

  el.innerHTML =
    '<form class="form-card" id="f">' +
      '<h2>회원가입</h2>' +
      '<button class="btn btn-google btn-block" type="button" id="google"><span class="g-icon" aria-hidden="true">G</span> 구글 계정으로 가입</button>' +
      '<p class="divider"><span>또는 이메일로 가입</span></p>' +
      '<label>이름<input name="name" required maxlength="30" autocomplete="name"></label>' +
      '<label>이메일<input type="email" name="email" required autocomplete="email"></label>' +
      '<label>비밀번호 <small>(6자 이상)</small><input type="password" name="password" required minlength="6" autocomplete="new-password"></label>' +
      '<label>비밀번호 확인<input type="password" name="password2" required minlength="6" autocomplete="new-password"></label>' +
      '<label>휴대폰 번호<input type="tel" name="phone" required placeholder="010-0000-0000" autocomplete="tel"></label>' +
      '<div class="agree">' +
        '<p><strong>개인정보 수집·이용 안내</strong><br>수집 항목: 이름, 이메일, 휴대폰 번호<br>이용 목적: 회원 관리, 교육·자격 신청 접수 및 안내<br>보유 기간: 회원 탈퇴 시까지</p>' +
        '<label class="check"><input type="checkbox" name="agree" required> 개인정보 수집·이용에 동의합니다. (필수)</label>' +
      '</div>' +
      '<button class="btn btn-primary btn-block" type="submit">가입하기</button>' +
      '<p class="form-links">이미 회원이신가요? <a href="login.html">로그인</a></p>' +
    '</form>';
  const f = document.getElementById('f');

  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (f.password.value !== f.password2.value) { toast('비밀번호가 서로 다릅니다.'); return; }
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const cred = await fa.createUserWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
      await fa.updateProfile(cred.user, { displayName: f.name.value.trim() });
      await fs.setDoc(fs.doc(db, 'users', cred.user.uid), {
        name: f.name.value.trim(), email: cred.user.email, phone: f.phone.value.trim(),
        agreePrivacy: true, createdAt: fs.serverTimestamp()
      });
      location.replace('mypage.html?welcome=1');
    } catch (err) { toast(errMsg(err)); btn.disabled = false; }
  });
  document.getElementById('google').addEventListener('click', async () => {
    try { await fa.signInWithPopup(auth, new fa.GoogleAuthProvider()); location.replace('mypage.html?welcome=1'); }
    catch (err) { toast(errMsg(err)); }
  });
}
init();
