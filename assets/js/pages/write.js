import { enabled, db, fs, ready, state, requireLogin, displayName, disabledNotice, toast, errMsg, today, qs, BOARD_TITLES, postURL } from '../app.js';

const el = document.getElementById('write');
const id = qs('id');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  await ready;
  if (!state.isAdmin) { el.innerHTML = '<p class="board-empty">관리자만 글을 쓸 수 있습니다.</p>'; return; }

  let post = { board: qs('board') || 'notice', title: '', body: '', date: today() };
  if (id) {
    const d = await fs.getDoc(fs.doc(db, 'posts', id));
    if (!d.exists()) { el.innerHTML = '<p class="board-empty">게시물을 찾을 수 없습니다.</p>'; return; }
    post = d.data();
  }
  el.innerHTML =
    '<form class="form-card wide" id="f">' +
      '<div class="form-row">' +
        '<label>게시판<select name="board">' + Object.entries(BOARD_TITLES).map(([k, v]) =>
          '<option value="' + k + '"' + (k === post.board ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
        '<label>게시 날짜 <small>(목록에 표시되고, 이 날짜순으로 정렬됩니다)</small><input type="date" name="date" required></label>' +
      '</div>' +
      '<label>제목<input name="title" required maxlength="200"></label>' +
      '<label>내용<textarea name="body" rows="16" required></textarea></label>' +
      '<p class="form-help">줄바꿈은 그대로 표시되고, http로 시작하는 주소는 자동으로 링크가 됩니다.</p>' +
      '<div class="btn-row"><a class="btn btn-outline" href="' + (id ? postURL(post.board, id) : post.board + '.html') + '">취소</a>' +
      '<button class="btn btn-primary" type="submit">' + (id ? '수정 완료' : '등록') + '</button></div>' +
    '</form>';
  const f = document.getElementById('f');
  f.title.value = post.title; f.body.value = post.body;
  f.date.value = post.date || today();

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { board: f.board.value, title: f.title.value.trim(), body: f.body.value, date: f.date.value };
    f.querySelector('[type=submit]').disabled = true;
    try {
      let docId = id;
      if (id) await fs.updateDoc(fs.doc(db, 'posts', id), { ...data, updatedAt: fs.serverTimestamp() });
      else {
        const ref = await fs.addDoc(fs.collection(db, 'posts'), { ...data, author: '관리자', authorUid: state.user.uid, createdAt: fs.serverTimestamp() });
        docId = ref.id;
      }
      location.href = postURL(data.board, docId);
    } catch (err) { toast(errMsg(err)); f.querySelector('[type=submit]').disabled = false; }
  });
}
init();
