/* 관리자 > 알림 탭: 전체 공지 알림 보내기, 보낸 공지 목록, 1년 지난 알림 정리 */
import { db, fs, toast, errMsg, esc, fmtDate, callFn, storageApi, today } from '../app.js';
import { TARGET_NAMES, NOTICE_KEEP_DAYS } from '../notify.js';
import { logAdmin } from '../admin-log.js';
import { popupActive, openPopup } from '../popup.js';

let box;
export async function tabNotice(container) {
  box = container;
  box.innerHTML = '<p class="board-empty">불러오는 중…</p>';
  let list, recent = [], popup = {};
  try {
    const pp = await fs.getDoc(fs.doc(db, 'settings', 'popup')).catch(() => null);
    if (pp && pp.exists()) popup = pp.data();
    const rs = await fs.getDocs(fs.query(fs.collection(db, 'notifications'), fs.orderBy('createdAt', 'desc'), fs.limit(30))).catch(() => null);
    if (rs) recent = rs.docs.map(d => d.data());
    const snap = await fs.getDocs(fs.collection(db, 'broadcasts'));
    list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  } catch (e) { box.innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }

  box.innerHTML =
    '<form class="form-card wide" id="bc"><h2>전체 공지 알림 보내기</h2>' +
      '<p class="form-help">받는 회원의 마이페이지 알림함과 대시보드에 표시됩니다. 이메일로는 보내지 않습니다. 신청 승인·이수·자격 발급 같은 개인 알림은 처리할 때 자동으로 갑니다.</p>' +
      '<div class="form-row"><label>받는 사람<select name="target">' + Object.entries(TARGET_NAMES).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') + '</select></label>' +
      '<label>바로가기 주소 <small>(선택. 예: notice.html 또는 https://…)</small><input name="link" maxlength="300"></label></div>' +
      '<label>제목<input name="title" required maxlength="80"></label>' +
      '<label>내용<textarea name="body" rows="4" maxlength="1000"></textarea></label>' +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">보내기</button></div></form>' +
    '<h3 class="list-title">보낸 공지 ' + list.length + '건</h3>' +
    '<div class="table-scroll"><table class="board-table"><thead><tr><th class="col-date">보낸 날</th><th>받는 사람</th><th>제목</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(b => '<tr><td class="col-date">' + fmtDate(b.createdAt, true) + '</td><td>' + (TARGET_NAMES[b.target] || '') + '</td>' +
        '<td class="col-title">' + esc(b.title) + (b.body ? '<br><small class="muted">' + esc(b.body.slice(0, 80)) + '</small>' : '') + '</td>' +
        '<td><button type="button" class="link-btn" data-del="' + b.id + '">삭제</button></td></tr>').join('') : '<tr><td colspan="4">보낸 공지가 없습니다.</td></tr>') +
    '</tbody></table></div>' +
    '<h3 class="list-title">개인 알림·메일 발송 현황 <small>(최근 30건)</small></h3>' +
    '<p class="form-help">개인 알림이 생기면 같은 내용이 회원 이메일로도 갑니다. 매일 아침 9시에는 만료 안내(멤버십 30일·자격 90일·온라인 수강 7일 전), 사전 설문 미제출(교육 3일 전), 소식지 수신 2년 확인, 생존수영 인증 준회원 종료(30일 전) 안내를 자동으로 만듭니다.</p>' +
    '<p class="btn-row left"><button type="button" class="btn btn-outline btn-sm" id="remind-now">매일 안내 지금 확인·보내기</button></p>' +
    '<div class="table-scroll"><table class="board-table"><thead><tr><th class="col-date">만든 때</th><th>제목</th><th>메일</th></tr></thead><tbody>' +
      (recent.length ? recent.map(n => '<tr><td class="col-date">' + fmtDate(n.createdAt, true) + '</td><td class="col-title">' + esc(n.title) + '</td><td>' +
        (n.mailedAt ? '<span class="mstatus mstatus-ok">발송</span>' : n.mailError ? '<span class="mstatus mstatus-no">실패</span><br><small>' + esc(n.mailError) + '</small>' : '<span class="mstatus mstatus-wait">대기</span>') + '</td></tr>').join('')
        : '<tr><td colspan="3">알림이 없습니다.</td></tr>') + '</tbody></table></div>' +
    popupForm(popup) +
    '<div class="notice-box left"><h3>오래된 알림 정리</h3><p>알림은 1년 동안 보관합니다. 보낸 지 1년이 지난 개인 알림과 공지를 삭제합니다.</p>' +
      '<button type="button" class="btn btn-outline btn-sm" id="purge">1년 지난 알림 삭제</button></div>';

  initPopup(popup);
  const f = document.getElementById('bc');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const link = f.link.value.trim();
    if (link && !/^(https:\/\/|[a-z0-9-]+\.html)/i.test(link)) { toast('바로가기 주소는 https:// 로 시작하거나 사이트 안 페이지(예: notice.html)여야 합니다.'); return; }
    if (!confirm(TARGET_NAMES[f.target.value] + '에게 알림을 보낼까요?')) return;
    try {
      await fs.addDoc(fs.collection(db, 'broadcasts'), { target: f.target.value, title: f.title.value.trim(), body: f.body.value.trim(), link, createdAt: fs.serverTimestamp() });
      logAdmin('전체 공지 보내기', f.title.value.trim(), TARGET_NAMES[f.target.value]);
      toast('알림을 보냈습니다.'); tabNotice(box);
    } catch (err) { toast(errMsg(err)); }
  });
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('이 공지를 삭제할까요? 회원 알림함에서도 사라집니다.')) return;
    const bc = list.find(x => x.id === b.getAttribute('data-del'));
    try { await fs.deleteDoc(fs.doc(db, 'broadcasts', bc.id)); logAdmin('전체 공지 삭제', bc.title); toast('삭제했습니다.'); tabNotice(box); }
    catch (err) { toast(errMsg(err)); }
  }));
  document.getElementById('remind-now').addEventListener('click', async e => {
    e.target.disabled = true;
    try {
      const r = await callFn('runRemindersNow', {});
      toast('새로 만든 안내: 멤버십 ' + r.membership + ', 자격 ' + r.qual + ', 온라인 ' + r.online + ', 사전 설문 ' + r.survey + ', 수신 확인 ' + r.consent + ', 준회원 ' + (r.swim || 0) + '건');
      setTimeout(() => tabNotice(box), 1500);
    } catch (err) { toast(errMsg(err)); e.target.disabled = false; }
  });
  document.getElementById('purge').addEventListener('click', async () => {
    const limit = fs.Timestamp.fromMillis(Date.now() - NOTICE_KEEP_DAYS * 86400000);
    try {
      const [n, bc] = await Promise.all([
        fs.getDocs(fs.query(fs.collection(db, 'notifications'), fs.where('createdAt', '<', limit))),
        fs.getDocs(fs.query(fs.collection(db, 'broadcasts'), fs.where('createdAt', '<', limit)))
      ]);
      const refs = n.docs.concat(bc.docs).map(d => d.ref);
      if (!refs.length) { toast('1년 지난 알림이 없습니다.'); return; }
      if (!confirm('1년 지난 알림 ' + refs.length + '건을 영구 삭제할까요?')) return;
      for (let i = 0; i < refs.length; i += 400) {
        const batch = fs.writeBatch(db);
        refs.slice(i, i + 400).forEach(r => batch.delete(r));
        await batch.commit();
      }
      logAdmin('알림 일괄 삭제', '1년 지난 알림', refs.length + '건');
      toast(refs.length + '건을 삭제했습니다.'); tabNotice(box);
    } catch (err) { toast(errMsg(err)); }
  });
}

/* ---------- 첫 화면 팝업 ---------- */
function popupForm(p) {
  const state = popupActive(p) ? '<span class="mstatus mstatus-ok">지금 표시 중</span>' : p.on ? '<span class="mstatus mstatus-wait">켜짐 · 기간 밖</span>' : '<span class="mstatus mstatus-off">꺼짐</span>';
  return '<form class="form-card wide" id="pp"><h2>첫 화면 팝업 ' + state + '</h2>' +
    '<p class="form-help">홈페이지 첫 화면에 뜨는 안내 창입니다. 방문자는 "오늘 하루 보지 않기"를 누를 수 있고, 내용을 고쳐 저장하면 다시 보입니다.</p>' +
    '<label class="check"><input type="checkbox" name="on"' + (p.on ? ' checked' : '') + '> 팝업 켜기</label>' +
    '<div class="form-row"><label>보이기 시작하는 날 <small>(비우면 바로)</small><input type="date" name="start" value="' + esc(p.start || '') + '"></label>' +
    '<label>마지막 날 <small>(비우면 끌 때까지)</small><input type="date" name="end" value="' + esc(p.end || '') + '"></label></div>' +
    '<label>제목<input name="title" maxlength="60" value="' + esc(p.title || '') + '"></label>' +
    '<label>내용 <small>(선택)</small><textarea name="body" rows="3" maxlength="500">' + esc(p.body || '') + '</textarea></label>' +
    '<label>바로가기 주소 <small>(선택. 예: programs.html 또는 https://…)</small><input name="link" maxlength="300" value="' + esc(p.link || '') + '"></label>' +
    '<div class="form-row"><label>이미지 <small>(선택. 5MB 이하 jpg·png·webp. 제목·내용 위에 표시)</small><input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif"></label>' +
    (p.imageUrl ? '<label class="check"><input type="checkbox" name="noImage"> 지금 이미지 빼기 <small>(' + esc(p.imagePath ? p.imagePath.split('/').pop() : '') + ')</small></label>' : '<span></span>') + '</div>' +
    '<div class="btn-row"><button type="button" class="btn btn-outline" id="pp-preview">미리 보기</button><button class="btn btn-primary" type="submit">저장</button></div></form>';
}

function initPopup(p) {
  const f = document.getElementById('pp');
  const read = () => ({ on: f.on.checked, start: f.start.value, end: f.end.value, title: f.title.value.trim(), body: f.body.value.trim(), link: f.link.value.trim() });
  document.getElementById('pp-preview').addEventListener('click', () => {
    const file = f.image.files[0];
    const v = { ...read(), imageUrl: file ? URL.createObjectURL(file) : f.noImage && f.noImage.checked ? '' : p.imageUrl || '' };
    if (!v.title && !v.imageUrl) { toast('제목이나 이미지를 넣어 주세요.'); return; }
    openPopup(v, true);
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const v = read(), file = f.image.files[0];
    if (v.link && !/^(https:\/\/|[a-z0-9-]+\.html)/i.test(v.link)) { toast('바로가기 주소는 https:// 로 시작하거나 사이트 안 페이지(예: programs.html)여야 합니다.'); return; }
    if (v.start && v.end && v.start > v.end) { toast('마지막 날이 시작일보다 빠릅니다.'); return; }
    if (file && file.size > 5 * 1024 * 1024) { toast('이미지는 5MB 이하만 올릴 수 있습니다.'); return; }
    const dropOld = file || (f.noImage && f.noImage.checked);
    if (v.on && !v.title && !file && (dropOld || !p.imageUrl)) { toast('제목이나 이미지를 넣어 주세요.'); return; }
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      let imageUrl = p.imageUrl || '', imagePath = p.imagePath || '';
      if (dropOld || file) {
        const { m, s } = await storageApi();
        if (dropOld && imagePath) await m.deleteObject(m.ref(s, imagePath)).catch(err => { if (err.code !== 'storage/object-not-found') throw err; });
        imageUrl = ''; imagePath = '';
        if (file) {
          imagePath = 'popup/' + Date.now() + '_' + file.name.replace(/[^\w.\-가-힣]/g, '_').slice(-60);
          const r = m.ref(s, imagePath);
          await m.uploadBytes(r, file, { contentType: file.type });
          imageUrl = await m.getDownloadURL(r);
        }
      }
      await fs.setDoc(fs.doc(db, 'settings', 'popup'), { ...v, imageUrl, imagePath, updatedAt: fs.serverTimestamp() });
      logAdmin('첫 화면 팝업 저장', v.title || '(이미지만)', (v.on ? '켜짐' : '꺼짐') + ' · ' + (v.start || '바로') + ' ~ ' + (v.end || '끌 때까지'));
      toast(v.on ? (popupActive({ ...v, imageUrl }, today()) ? '저장했습니다. 지금 첫 화면에 보입니다.' : '저장했습니다. 정한 기간에 보입니다.') : '저장했습니다. 팝업은 꺼져 있습니다.');
      tabNotice(box);
    } catch (err) { toast(errMsg(err)); btn.disabled = false; }
  });
}
