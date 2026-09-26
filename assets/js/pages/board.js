import { listPosts, postURL, esc, ready, state } from '../app.js';

const el = document.getElementById('board');
const board = el.getAttribute('data-board');

async function render() {
  let posts;
  try { posts = await listPosts(board); }
  catch (e) { console.error(e); el.innerHTML = '<p class="board-empty">게시물을 불러오지 못했습니다.</p>'; return; }
  await ready;
  const writeBtn = state.isAdmin ? '<p class="board-actions"><a class="btn btn-primary" href="write.html?board=' + board + '">글쓰기</a></p>' : '';
  if (!posts.length) { el.innerHTML = '<p class="board-empty">등록된 게시물이 없습니다.</p>' + writeBtn; return; }
  const total = posts.length;
  el.innerHTML =
    '<p class="board-count">전체 <b>' + total + '</b>건</p>' +
    '<table class="board-table"><thead><tr><th class="col-no">번호</th><th>제목</th><th class="col-author">작성자</th><th class="col-date">작성일</th></tr></thead><tbody>' +
    posts.map((p, i) =>
      '<tr><td class="col-no">' + (total - i) + '</td>' +
      '<td class="col-title"><a href="' + postURL(board, p.id) + '">' + esc(p.title) + '</a></td>' +
      '<td class="col-author">' + esc(p.author) + '</td><td class="col-date">' + esc(p.date) + '</td></tr>'
    ).join('') + '</tbody></table>' + writeBtn;
}
render();
