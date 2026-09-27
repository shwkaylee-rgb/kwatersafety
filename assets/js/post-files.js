/* 게시글 사진·첨부 파일
   posts/{id}.files: [{ name, path, url, size, type }]  — 파일은 저장소 posts/{글ID}/ 에 있고 누구나 받을 수 있음 */
import { esc } from './app.js';

export const POST_FILE_MAX = 20 * 1024 * 1024;
const IMAGE = /^image\/(jpeg|png|gif|webp)$/;
const safeUrl = u => /^https:\/\/(firebasestorage\.googleapis\.com|127\.0\.0\.1|localhost)[:/]/.test(u || '') || /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u || '') ? u : '';

export function fileSizeText(n) {
  n = Number(n) || 0;
  return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
}

// 게시글 화면: 사진은 본문 아래에 바로, 나머지는 받기 목록으로
export function postFilesHTML(files) {
  const list = (files || []).filter(f => safeUrl(f.url));
  const imgs = list.filter(f => IMAGE.test(f.type)), others = list.filter(f => !IMAGE.test(f.type));
  return (imgs.length ? '<div class="post-images">' + imgs.map(f => '<a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="' + esc(f.url) + '" alt="' + esc(f.name) + '" loading="lazy"></a>').join('') + '</div>' : '') +
    (others.length ? '<ul class="post-files"><li class="post-files-title">첨부 파일</li>' + others.map(f =>
      '<li><a href="' + esc(f.url) + '" target="_blank" rel="noopener" download="' + esc(f.name) + '">' + esc(f.name) + '</a> <small>' + fileSizeText(f.size) + '</small></li>').join('') + '</ul>' : '');
}
