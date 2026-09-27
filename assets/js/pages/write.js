import { enabled, db, fs, ready, state, requireLogin, displayName, disabledNotice, toast, errMsg, today, qs, esc, BOARD_TITLES, postURL, storageApi } from '../app.js';
import { logAdmin } from '../admin-log.js';
import { POST_FILE_MAX, fileSizeText } from '../post-files.js';

const el = document.getElementById('write');
const id = qs('id');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  await ready;
  if (!state.isAdmin) { el.innerHTML = '<p class="board-empty">관리자만 글을 쓸 수 있습니다.</p>'; return; }

  let post = { board: qs('board') || 'notice', title: '', body: '', date: today(), pinned: false, files: [] };
  if (id) {
    const d = await fs.getDoc(fs.doc(db, 'posts', id));
    if (!d.exists()) { el.innerHTML = '<p class="board-empty">게시물을 찾을 수 없습니다.</p>'; return; }
    post = { files: [], ...d.data() };
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
      '<label class="check"><input type="checkbox" name="pinned"> 목록 맨 위에 고정 (중요 공지)</label>' +
      '<fieldset class="choice"><legend>사진·첨부 파일</legend>' +
        (post.files.length ? '<ul class="post-files-edit">' + post.files.map((x, i) => '<li><label class="check"><input type="checkbox" data-remove="' + i + '"> 삭제</label> ' +
          esc(x.name) + ' <small>' + fileSizeText(x.size) + '</small></li>').join('') + '</ul>' : '') +
        '<input type="file" name="files" multiple>' +
        '<p class="form-help">사진(jpg·png·gif·webp)은 본문 아래에 바로 보이고, 그 밖의 파일은 첨부 목록에 받기 링크로 표시됩니다. 파일 하나에 20MB까지 올릴 수 있습니다.</p>' +
      '</fieldset>' +
      '<div class="btn-row"><a class="btn btn-outline" href="' + (id ? postURL(post.board, id) : post.board + '.html') + '">취소</a>' +
      '<button class="btn btn-primary" type="submit">' + (id ? '수정 완료' : '등록') + '</button></div>' +
    '</form>';
  const f = document.getElementById('f');
  f.title.value = post.title; f.body.value = post.body;
  f.date.value = post.date || today();
  f.pinned.checked = !!post.pinned;

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const add = [...f.files.files], big = add.find(x => x.size > POST_FILE_MAX);
    if (big) { toast('"' + big.name + '"은(는) 20MB보다 커서 올릴 수 없습니다.'); return; }
    const removeIdx = new Set([...f.querySelectorAll('[data-remove]:checked')].map(x => +x.dataset.remove));
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const ref = id ? fs.doc(db, 'posts', id) : fs.doc(fs.collection(db, 'posts'));
      let files = post.files.filter((x, i) => !removeIdx.has(i));
      if (add.length || removeIdx.size) {
        const { m, s } = await storageApi();
        for (const [i, x] of post.files.entries()) {
          if (removeIdx.has(i)) await m.deleteObject(m.ref(s, x.path)).catch(err => { if (err.code !== 'storage/object-not-found') throw err; });
        }
        for (const [k, file] of add.entries()) {
          btn.textContent = '올리는 중… (' + (k + 1) + '/' + add.length + ')';
          const path = 'posts/' + ref.id + '/' + Date.now() + '_' + file.name.replace(/[^\w.\-가-힣]/g, '_').slice(-80);
          const fileRef = m.ref(s, path);
          await m.uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' });
          files.push({ name: file.name, path, url: await m.getDownloadURL(fileRef), size: file.size, type: file.type || '' });
        }
      }
      const data = { board: f.board.value, title: f.title.value.trim(), body: f.body.value, date: f.date.value, pinned: f.pinned.checked, files };
      if (id) await fs.updateDoc(ref, { ...data, updatedAt: fs.serverTimestamp() });
      else await fs.setDoc(ref, { ...data, author: '관리자', authorUid: state.user.uid, createdAt: fs.serverTimestamp() });
      logAdmin(id ? '게시글 수정' : '게시글 등록', BOARD_TITLES[data.board] + ' · ' + data.title, (data.pinned ? '상단 고정 · ' : '') + '첨부 ' + files.length + '개');
      location.href = postURL(data.board, ref.id);
    } catch (err) { toast(errMsg(err)); btn.disabled = false; btn.textContent = id ? '수정 완료' : '등록'; }
  });
}
init();
