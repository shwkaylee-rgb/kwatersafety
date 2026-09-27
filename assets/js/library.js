/* 자료실·제휴 할인 공통
   resources/{id}: { title, category, description, level, path, fileName, contentType, size, open, downloads, createdAt }
   partners/{id}: { name, category, benefit, description, link, level, validUntil, open, order }
   partnerCodes/{id}: { code, howTo }  — 관리자만. 회원은 서버 함수 getPartnerCodes 로 등급에 맞는 코드만 받음 */
import { callFn } from './app.js';
import { hasBenefits } from './membership.js';

export const LEVEL_NAMES = { all: '모든 회원', paid: '일반회원 이상', full: '정회원 전용' };
export const RES_CATEGORIES = ['교안', '진도표', '평가지', '안전 서식', '규정·지침', '기타'];
const RANK = { all: 0, paid: 1, full: 2 };

// 화면에서 쓰는 내 등급 (서버에서도 같은 기준으로 다시 확인함)
export const myLevel = (membership, isAdmin) => isAdmin ? 'full' : !hasBenefits(membership) ? 'all' : membership.tier === 'full' ? 'full' : 'paid';
export const canAccess = (need, have) => RANK[have] >= RANK[need || 'all'];

export function fileSize(n) {
  n = Number(n) || 0;
  return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
}

// 서버에서 파일을 받아 내려받기
export async function downloadResource(id) {
  const r = await callFn('getResourceFile', { id });
  const bin = atob(r.data), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: r.type }));
  const a = document.createElement('a'); a.href = url; a.download = r.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
