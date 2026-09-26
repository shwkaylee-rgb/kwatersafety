import { listPosts, postURL, esc } from '../app.js';

async function latest(elId, board, withSummary) {
  const el = document.getElementById(elId);
  try {
    const posts = (await listPosts(board)).slice(0, 4);
    if (!posts.length) { el.innerHTML = '<li class="board-empty">등록된 게시물이 없습니다.</li>'; return; }
    el.innerHTML = posts.map(p => {
      const summary = p.bodyHTML.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '');
      return '<li><a href="' + postURL(board, p.id) + '">' +
        '<span class="latest-title">' + esc(p.title) + '</span>' +
        (withSummary ? '<span class="latest-summary">' + summary + '</span>' : '') +
        '<span class="latest-date">' + esc(p.date) + '</span></a></li>';
    }).join('');
  } catch (e) {
    console.error(e);
    el.innerHTML = '<li class="board-empty">게시물을 불러오지 못했습니다.</li>';
  }
}
latest('latest-notice', 'notice');
latest('latest-news', 'news', true);
