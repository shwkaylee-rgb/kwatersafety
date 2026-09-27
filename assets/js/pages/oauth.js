/* 간편 로그인에서 돌아오는 페이지: oauth.html?code=…&state=… */
import { enabled, auth, fa, state, ready, disabledNotice, errMsg, esc, qs, callFn } from '../app.js';
import { SOCIAL, takeSocialSession } from '../social.js';

const el = document.getElementById('oauth');
const safeBack = b => /^[\w-]+\.html(\?[^#]*)?(#[\w-]+)?$/.test(b || '') ? b : '';
const fail = (msg, back) => {
  el.innerHTML = '<div class="notice-box"><p>' + msg + '</p><p class="btn-row"><a class="btn btn-primary" href="login.html' + (back ? '?back=' + encodeURIComponent(back) : '') + '">로그인 화면으로</a>' +
    '<a class="btn btn-outline" href="index.html">처음으로</a></p></div>';
};

async function init() {
  if (!enabled) return disabledNotice(el);
  const s = takeSocialSession(), back = safeBack(s && s.back);
  // 주소의 값을 먼저 읽은 뒤, 주소창에서 인증 코드를 지워 새로고침·뒤로 가기로 다시 쓰이지 않게 함
  const code = qs('code'), st = qs('state'), error = qs('error');
  history.replaceState(null, '', 'oauth.html');
  if (error) return fail('로그인을 취소했거나 동의하지 않았습니다.', back);
  if (!s || !code || s.state !== st || Date.now() - s.at > 10 * 60 * 1000) {
    return fail('로그인 정보가 맞지 않거나 시간이 지났습니다. 처음부터 다시 시도해 주세요.', back);
  }
  const name = (SOCIAL[s.provider] || {}).name || '간편 로그인';
  await ready;
  try {
    if (s.mode === 'link') {
      if (!state.user) return fail('먼저 로그인한 뒤 마이페이지에서 연결해 주세요.', 'mypage.html#info');
      const r = await callFn('socialLogin', { provider: s.provider, code, state: st, mode: 'link' });
      el.innerHTML = '<div class="notice-box"><p><b>' + name + ' 계정을 연결했습니다.</b>' + (r.email ? ' (' + esc(r.email) + ')' : '') + '<br>다음부터 ' + name + '로도 이 계정에 로그인할 수 있습니다.</p>' +
        '<p class="btn-row"><a class="btn btn-primary" href="mypage.html#info">마이페이지로</a></p></div>';
      return;
    }
    const r = await callFn('socialLogin', { provider: s.provider, code, state: st });
    if (r.status === 'email-exists') {
      if (state.user) await fa.signOut(auth);
      return fail('이 ' + name + ' 계정의 이메일(<b>' + esc(r.email) + '</b>)은 이미 <b>' + esc((r.methods || []).join(', ') || '다른 방법') + '</b>(으)로 가입되어 있습니다.<br>' +
        '원래 방법으로 로그인한 뒤 <b>마이페이지 → 내 정보 → 간편 로그인 연결</b>에서 ' + name + '를 연결하면, 다음부터 ' + name + '로도 로그인할 수 있습니다.', 'mypage.html#info');
    }
    await fa.signInWithCustomToken(auth, r.token);
    // 처음 가입이면 이동한 페이지에서 가입 마무리(동의·연락처) 화면으로 자동 안내됨
    location.replace(back || 'mypage.html');
  } catch (e) { fail(esc(errMsg(e)), back); }
}
init();
