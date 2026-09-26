import { enabled, db, fs, listPosts, postURL, esc, textToHTML, fmtDate, ready, state, onAuth, displayName, toast, errMsg, BOARD_TITLES } from '../app.js';

const el = document.getElementById('post');
const q = new URLSearchParams(location.search);
const board = q.get('board') || 'notice', id = q.get('id');

async function render() {
  let posts;
  try { posts = await listPosts(board); }
  catch (e) { console.error(e); el.innerHTML = '<p class="board-empty">게시물을 불러오지 못했습니다.</p>'; return; }
  const idx = posts.findIndex(p => p.id === id);
  if (idx < 0) { el.innerHTML = '<p class="board-empty">게시물을 찾을 수 없습니다.</p>'; return; }
  const p = posts[idx], newer = posts[idx - 1], older = posts[idx + 1];
  document.title = p.title + ' | ' + (BOARD_TITLES[board] || '');
  await ready;
  const adminBtns = state.isAdmin && !p.isStatic
    ? '<a class="btn btn-outline btn-sm" href="write.html?board=' + board + '&id=' + encodeURIComponent(p.id) + '">수정</a>' +
      '<button class="btn btn-outline btn-sm" type="button" id="del-post">삭제</button>' : '';
  el.innerHTML =
    '<article class="post-view">' +
      '<header class="post-head"><h2>' + esc(p.title) + '</h2>' +
      '<p class="post-meta">' + esc(p.author) + ' <i>|</i> ' + esc(p.date) + '</p></header>' +
      '<div class="post-body">' + p.bodyHTML + '</div>' +
    '</article>' +
    (enabled && !p.isStatic ? '<section class="comments" id="comments"></section>' : '') +
    '<ul class="post-nav">' +
      (newer ? '<li><span>다음글</span><a href="' + postURL(board, newer.id) + '">' + esc(newer.title) + '</a></li>' : '') +
      (older ? '<li><span>이전글</span><a href="' + postURL(board, older.id) + '">' + esc(older.title) + '</a></li>' : '') +
    '</ul>' +
    '<p class="center btn-row"><a class="btn btn-outline" href="' + board + '.html">목록으로</a>' + adminBtns + '</p>';

  const del = document.getElementById('del-post');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('이 게시물을 삭제할까요? 댓글도 함께 보이지 않게 됩니다.')) return;
    try { await fs.deleteDoc(fs.doc(db, 'posts', p.id)); location.href = board + '.html'; }
    catch (e) { toast(errMsg(e)); }
  });
  if (enabled && !p.isStatic) initComments(p.id);
}

/* ---------- 댓글 ---------- */
function initComments(postId) {
  const box = document.getElementById('comments');
  const col = fs.collection(db, 'posts', postId, 'comments');
  let comments = [];

  function draw() {
    const u = state.user;
    const form = u
      ? '<form class="comment-form" id="comment-form"><textarea name="text" maxlength="1000" required placeholder="댓글을 입력하세요"></textarea>' +
        '<button class="btn btn-primary" type="submit">등록</button></form>'
      : '<p class="comment-login"><a href="login.html?back=' + encodeURIComponent(location.pathname.split('/').pop() + location.search) + '">로그인</a> 후 댓글을 작성할 수 있습니다.</p>';
    box.innerHTML = '<h3>댓글 <b>' + comments.length + '</b></h3>' +
      '<ul class="comment-list">' + comments.map(c =>
        '<li><div class="comment-meta"><strong>' + esc(c.name) + '</strong> <span>' + fmtDate(c.createdAt, true) + '</span>' +
        (u && (u.uid === c.uid || state.isAdmin) ? '<button type="button" class="link-btn" data-del="' + c.id + '">삭제</button>' : '') +
        '</div><p>' + textToHTML(c.text) + '</p></li>'
      ).join('') + '</ul>' + form;

    const f = document.getElementById('comment-form');
    if (f) f.addEventListener('submit', async e => {
      e.preventDefault();
      const text = f.text.value.trim();
      if (!text) return;
      f.querySelector('button').disabled = true;
      try {
        await fs.addDoc(col, { uid: state.user.uid, name: displayName(), text, createdAt: fs.serverTimestamp() });
      } catch (err) { toast(errMsg(err)); f.querySelector('button').disabled = false; }
    });
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('댓글을 삭제할까요?')) return;
      try { await fs.deleteDoc(fs.doc(col, b.getAttribute('data-del'))); } catch (err) { toast(errMsg(err)); }
    }));
  }

  fs.onSnapshot(fs.query(col, fs.orderBy('createdAt', 'asc')), snap => {
    comments = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    draw();
  }, err => { console.error(err); box.innerHTML = '<p class="board-empty">댓글을 불러오지 못했습니다.</p>'; });
  onAuth(draw);
}

render();
