/* 관리자 > 알림 탭: 전체 공지 알림 보내기, 보낸 공지 목록, 1년 지난 알림 정리 */
import { db, fs, toast, errMsg, esc, fmtDate, callFn } from '../app.js';
import { TARGET_NAMES, NOTICE_KEEP_DAYS } from '../notify.js';

let box;
export async function tabNotice(container) {
  box = container;
  box.innerHTML = '<p class="board-empty">불러오는 중…</p>';
  let list, recent = [];
  try {
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
    '<p class="form-help">개인 알림이 생기면 같은 내용이 회원 이메일로도 갑니다. 매일 아침 9시에는 만료 안내(멤버십 30일·자격 90일·온라인 수강 7일 전), 사전 설문 미제출(교육 3일 전), 소식지 수신 2년 확인 안내를 자동으로 만듭니다.</p>' +
    '<p class="btn-row left"><button type="button" class="btn btn-outline btn-sm" id="remind-now">매일 안내 지금 확인·보내기</button></p>' +
    '<div class="table-scroll"><table class="board-table"><thead><tr><th class="col-date">만든 때</th><th>제목</th><th>메일</th></tr></thead><tbody>' +
      (recent.length ? recent.map(n => '<tr><td class="col-date">' + fmtDate(n.createdAt, true) + '</td><td class="col-title">' + esc(n.title) + '</td><td>' +
        (n.mailedAt ? '<span class="mstatus mstatus-ok">발송</span>' : n.mailError ? '<span class="mstatus mstatus-no">실패</span><br><small>' + esc(n.mailError) + '</small>' : '<span class="mstatus mstatus-wait">대기</span>') + '</td></tr>').join('')
        : '<tr><td colspan="3">알림이 없습니다.</td></tr>') + '</tbody></table></div>' +
    '<div class="notice-box left"><h3>오래된 알림 정리</h3><p>알림은 1년 동안 보관합니다. 보낸 지 1년이 지난 개인 알림과 공지를 삭제합니다.</p>' +
      '<button type="button" class="btn btn-outline btn-sm" id="purge">1년 지난 알림 삭제</button></div>';

  const f = document.getElementById('bc');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const link = f.link.value.trim();
    if (link && !/^(https:\/\/|[a-z0-9-]+\.html)/i.test(link)) { toast('바로가기 주소는 https:// 로 시작하거나 사이트 안 페이지(예: notice.html)여야 합니다.'); return; }
    if (!confirm(TARGET_NAMES[f.target.value] + '에게 알림을 보낼까요?')) return;
    try {
      await fs.addDoc(fs.collection(db, 'broadcasts'), { target: f.target.value, title: f.title.value.trim(), body: f.body.value.trim(), link, createdAt: fs.serverTimestamp() });
      toast('알림을 보냈습니다.'); tabNotice(box);
    } catch (err) { toast(errMsg(err)); }
  });
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('이 공지를 삭제할까요? 회원 알림함에서도 사라집니다.')) return;
    try { await fs.deleteDoc(fs.doc(db, 'broadcasts', b.getAttribute('data-del'))); toast('삭제했습니다.'); tabNotice(box); }
    catch (err) { toast(errMsg(err)); }
  }));
  document.getElementById('remind-now').addEventListener('click', async e => {
    e.target.disabled = true;
    try {
      const r = await callFn('runRemindersNow', {});
      toast('새로 만든 안내: 멤버십 ' + r.membership + ', 자격 ' + r.qual + ', 온라인 ' + r.online + ', 사전 설문 ' + r.survey + ', 수신 확인 ' + r.consent + '건');
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
      toast(refs.length + '건을 삭제했습니다.'); tabNotice(box);
    } catch (err) { toast(errMsg(err)); }
  });
}
