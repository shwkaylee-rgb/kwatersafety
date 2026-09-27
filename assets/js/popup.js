/* 첫 화면 팝업
   settings/popup: { on, title, body, link, imageUrl, imagePath, start, end, updatedAt }
   기간(start~end) 안이고 켜져 있을 때만 첫 화면에 띄웁니다. "오늘 하루 보지 않기"는 이 브라우저에만 기억합니다. */
import { enabled, db, fs, esc, textToHTML, today } from './app.js';

const HIDE_KEY = 'kwasa-popup-hide';
const safeLink = l => /^(https:\/\/|[a-z0-9-]+\.html)/i.test(l || '') ? l : '';
const version = p => String(p.updatedAt && p.updatedAt.toMillis ? p.updatedAt.toMillis() : '');

export const popupActive = (p, d = today()) => !!(p && p.on && (p.title || p.imageUrl) && (!p.start || p.start <= d) && (!p.end || d <= p.end));

export function popupHTML(p) {
  const link = safeLink(p.link), ext = /^https:/.test(link);
  const img = p.imageUrl ? '<img src="' + esc(p.imageUrl) + '" alt="' + esc(p.title || '안내') + '">' : '';
  return '<div class="site-popup" role="dialog" aria-modal="true" aria-label="' + esc(p.title || '안내') + '"><div class="site-popup-box">' +
    (img ? (link ? '<a href="' + esc(link) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + img + '</a>' : img) : '') +
    (p.title || p.body ? '<div class="site-popup-text">' + (p.title ? '<h2>' + esc(p.title) + '</h2>' : '') + (p.body ? '<p>' + textToHTML(p.body) + '</p>' : '') +
      (link ? '<p><a class="btn btn-primary btn-sm" href="' + esc(link) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>자세히 보기</a></p>' : '') + '</div>' : '') +
    '<div class="site-popup-foot"><button type="button" data-popup="today">오늘 하루 보지 않기</button><button type="button" data-popup="close">닫기</button></div>' +
    '</div></div>';
}

// 화면에 띄우기. preview 이면 "오늘 하루" 기억 없이 닫기만
export function openPopup(p, preview) {
  const wrap = document.createElement('div');
  wrap.innerHTML = popupHTML(p);
  const el = wrap.firstChild;
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', e => { if (e.target === el) close(); });
  el.querySelector('[data-popup=close]').addEventListener('click', close);
  el.querySelector('[data-popup=today]').addEventListener('click', () => {
    if (!preview) { try { localStorage.setItem(HIDE_KEY, today() + '|' + version(p)); } catch (e) { /* 저장 못 해도 닫기는 됨 */ } }
    close();
  });
  el.querySelector('[data-popup=close]').focus();
}

export async function showSitePopup() {
  if (!enabled) return;
  try {
    const d = await fs.getDoc(fs.doc(db, 'settings', 'popup'));
    const p = d.exists() ? d.data() : null;
    if (!popupActive(p)) return;
    let hidden = '';
    try { hidden = localStorage.getItem(HIDE_KEY) || ''; } catch (e) { /* 개인정보 보호 모드 등 */ }
    if (hidden === today() + '|' + version(p)) return;
    openPopup(p);
  } catch (e) { console.warn('팝업을 불러오지 못했습니다.', e); }
}
