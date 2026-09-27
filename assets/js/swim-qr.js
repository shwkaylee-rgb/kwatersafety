/* 생존수영 인증 등록 안내 이미지 (QR 코드 포함) 만들기
   학교 가정통신문·단체 채팅방에 그대로 올릴 수 있는 세로형 PNG (1080×1350) */
import { groupTitle, groupPeriod } from './swim.js';

const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const FONT = 'Pretendard, "Malgun Gothic", sans-serif';
const W = 1080, H = 1350;

function loadScript(src, name) {
  if (window[name]) return Promise.resolve(window[name]);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(window[name]);
    s.onerror = () => rej(new Error('QR 코드 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(s);
  });
}
const loadImage = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// 가운데 정렬로 줄바꿈하며 쓰기. 마지막 줄의 아래쪽 y를 돌려줌
function splitLines(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function wrapText(ctx, text, y, maxW, lineH) {
  const lines = splitLines(ctx, text, maxW);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lineH));
  return y + (lines.length - 1) * lineH;
}

export async function makeQrPoster(g, link) {
  const qrcode = await loadScript(QR_LIB, 'qrcode');
  await Promise.all(['800 60px', '700 40px', '500 32px'].map(f => document.fonts.load(f + ' Pretendard').catch(() => null)));
  const logo = await loadImage('assets/img/logo-color.png');
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // 머리띠
  ctx.fillStyle = '#1f5fb0'; ctx.fillRect(0, 0, W, 200);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '500 32px ' + FONT; ctx.fillText('사단법인 대한수상안전협회', W / 2, 78);
  ctx.fillStyle = '#ffffff'; ctx.font = '800 58px ' + FONT; ctx.fillText('생존수영 능력 인증서 등록', W / 2, 152);

  // 학교·수업
  // 학교 이름이 길면 두 줄 안에 들어가도록 글자를 줄임
  ctx.fillStyle = '#10233d';
  let fs = 60;
  do { ctx.font = '800 ' + fs + 'px ' + FONT; } while (splitLines(ctx, groupTitle(g), W - 140).length > 2 && (fs -= 4) >= 36);
  let y = wrapText(ctx, groupTitle(g), 300, W - 140, Math.round(fs * 1.2));
  // 교육 기간과 장소는 한 줄씩. 양옆 여백(좌우 100px)을 넘으면 글자를 줄임
  ctx.fillStyle = '#55657a';
  [groupPeriod(g) && '교육 ' + groupPeriod(g), g.place].filter(Boolean).forEach((line, i) => {
    let size = 34;
    do { ctx.font = '500 ' + size + 'px ' + FONT; } while (ctx.measureText(line).width > W - 200 && (size -= 2) >= 22);
    y += i ? 48 : 60; ctx.fillText(line, W / 2, y);
  });

  // QR 코드
  const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
  // 아래 안내가 바닥 띠에 닿지 않는 범위에서 QR을 크게 (420~560px)
  const qy = Math.round(y + 110), below = 60 + 78 + 56 + (g.regDeadline ? 56 : 0) + 40;
  const n = qr.getModuleCount(), size = Math.max(420, Math.min(560, H - 110 - below - qy)), cell = Math.floor(size / n), qrW = cell * n;
  // 좌표는 정수여야 칸 사이에 흐린 선이 생기지 않고, QR 둘레 흰 여백은 4칸 이상이어야 잘 읽힘
  const qx = Math.round((W - qrW) / 2), pad = Math.max(36, cell * 4);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d8e0e8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(qx - pad, qy - pad, qrW + pad * 2, qrW + pad * 2, 28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#10233d';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) ctx.fillRect(qx + col * cell, qy + r * cell, cell, cell);
  y = qy + qrW + pad;

  // 안내
  ctx.fillStyle = '#10233d'; ctx.font = '700 38px ' + FONT;
  y += 78; ctx.fillText('휴대폰 카메라로 QR 코드를 비춰 주세요', W / 2, y);
  ctx.fillStyle = '#55657a'; ctx.font = '500 31px ' + FONT;
  y += 56; ctx.fillText('① 보호자 회원가입  ② 자녀 정보 등록  ③ 교육 후 인증서 발급', W / 2, y);
  if (g.regDeadline) { ctx.fillStyle = '#c2410c'; ctx.font = '700 32px ' + FONT; y += 56; ctx.fillText('등록 마감 ' + g.regDeadline, W / 2, y); }

  // 바닥: 로고와 주소
  ctx.fillStyle = '#f3f6f9'; ctx.fillRect(0, H - 110, W, 110);
  if (logo) { const lh = 52, lw = logo.width * lh / logo.height; ctx.drawImage(logo, W / 2 - lw / 2, H - 95, lw, lh); }
  ctx.fillStyle = '#8794a3'; ctx.font = '500 22px ' + FONT; ctx.fillText(link.replace(/^https?:\/\//, ''), W / 2, H - 20);
  return c;
}

export const canvasBlob = c => new Promise(res => c.toBlob(res, 'image/png'));
