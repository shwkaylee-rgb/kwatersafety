/* 간편 로그인 (네이버) — 화면 쪽
   1) startSocial(): 네이버 로그인 창으로 이동 (돌아올 곳과 위조 방지값 state 를 이 브라우저 탭에 저장)
   2) 네이버가 oauth.html?code=…&state=… 로 돌려보냄 → pages/oauth.js 가 서버 함수 socialLogin 으로 확인
   Client ID는 공개해도 되는 값입니다. Secret은 서버 비밀값(NAVER_CLIENT_SECRET)에만 둡니다. */
export const NAVER_CLIENT_ID = '';   // 네이버 개발자센터에서 받은 Client ID
export const SOCIAL = {
  naver: { name: '네이버', clientId: NAVER_CLIENT_ID, authorize: 'https://nid.naver.com/oauth2.0/authorize' }
};
const KEY = 'kwasa-social';
export const socialEnabled = p => !!(SOCIAL[p] && SOCIAL[p].clientId);
export const redirectUri = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'oauth.html';

// mode: 'login'(가입·로그인) | 'link'(마이페이지에서 연결)
export function startSocial(provider, mode = 'login', back = '') {
  const s = SOCIAL[provider];
  if (!s || !s.clientId) throw new Error(s ? s.name + ' 로그인은 준비 중입니다.' : '지원하지 않는 로그인 방법입니다.');
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem(KEY, JSON.stringify({ provider, mode, back, state, at: Date.now() })); }
  catch (e) { throw new Error('이 브라우저에서는 간편 로그인을 쓸 수 없습니다. 개인정보 보호 모드를 끄고 다시 시도해 주세요.'); }
  const q = new URLSearchParams({ response_type: 'code', client_id: s.clientId, redirect_uri: redirectUri(), state });
  location.href = s.authorize + '?' + q;
}
// 돌아왔을 때 저장해 둔 값 꺼내기 (한 번만)
export function takeSocialSession() {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); return v; } catch (e) { return null; }
}
export const naverButton = (id, label) => '<button class="btn btn-naver btn-block" type="button" id="' + id + '"><span class="n-icon" aria-hidden="true">N</span> ' + label + '</button>';
