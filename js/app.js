'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const LOG_TYPES = {
  video:   { label: '動画',       icon: 'video',         color: 'var(--c-video)' },
  work:    { label: 'ワーク',     icon: 'message',       color: 'var(--c-work)' },
  break:   { label: '休憩',       icon: 'coffee',        color: 'var(--c-break)' },
  talk:    { label: 'トーク',     icon: 'mic',           color: 'var(--c-talk)' },
  trouble: { label: 'トラブル',   icon: 'alertTriangle', color: 'var(--c-trouble)' },
  other:   { label: 'その他',     icon: 'list',          color: 'var(--c-other)' },
  missed:  { label: '入力し忘れ', icon: 'clock',         color: 'var(--c-missed)' },
};

const DURATION_PRESETS_LONG  = [30,60,90,120,150,180,210,240,270,300,600,900,1200,1800,2700,3600];
const DURATION_PRESETS_BREAK = [300,600,900,1800];

// ============================================================
// ICON HELPER
// ============================================================
function icon(name, size = 24) {
  const paths = {
    search:        `<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/>`,
    x:             `<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>`,
    video:         `<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`,
    message:       `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
    coffee:        `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>`,
    mic:           `<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>`,
    alertTriangle: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    list:          `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
    clock:         `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    folder:        `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`,
    file:          `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
    chevronRight:  `<polyline points="9 18 15 12 9 6"/>`,
    chevronLeft:   `<polyline points="15 18 9 12 15 6"/>`,
    film:          `<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>`,
    record:        `<circle cx="12" cy="12" r="10"/>`,
    stop:          `<rect x="3" y="3" width="18" height="18" rx="2"/>`,
    home:          `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    user:          `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  };
  const isFilled = ['record','stop'].includes(name);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${isFilled ? 'currentColor' : 'none'}" stroke="${isFilled ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle">${paths[name] || ''}</svg>`;
}

const TROUBLE_CATEGORIES = {
  audio:      { label: '音声',     subs: ['ノイズ','干渉','ハウリング','音割れ','無音'] },
  video:      { label: '映像',     subs: ['映像乱れ','フリーズ','切替ミス'] },
  connection: { label: '回線',     subs: ['配信断','遅延','接続不良'] },
  equipment:  { label: '機材',     subs: [] },
};

// ============================================================
// STORAGE  (v2 — flat tree model)
// ============================================================
const STORAGE_KEY = 'shotlog_v2';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.version === 2) return d;
    }
  } catch (e) {}
  return { version: 2, folders: [], sessions: [] };
}

// 端末の保存容量を超えても処理を止めない(記録そのものは画面と送信待ちに残る)。
// 超えたときは写真を除いて保存する。写真は送信済みならサーバーから戻る
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    console.error('[shotlog] saveData failed', e);
    try {
      const noPhotos = { ...appData, sessions: appData.sessions.map(s => ({ ...s, logs: s.logs.map(l => ({ ...l, photos: [] })) })) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(noPhotos));
    } catch (e2) {
      console.error('[shotlog] saveData failed without photos', e2);
    }
    showToast('端末の保存容量が不足しています。写真はこの端末に残らない場合があります');
  }
}

// ログアウト時：手元のデータを消す
function clearLocalData() {
  stopTimer();
  appData = { version: 2, folders: [], sessions: [] };
  saveData();
  navStack = [{ view: 'home' }, { view: 'account' }];
}

// ============================================================
// STATE
// ============================================================
let appData = loadData();

let navStack = [{ view: 'home' }];
let expandedSidebarFolders = new Set();
// 左の一覧の幅は画面の幅に対する割合で持つ（画面が変わっても比率を保つ）。広げきった状態が初期値
const SIDEBAR_MAX_RATIO = 1 / 3;
const SIDEBAR_MIN_PX = 200;
let sidebarRatio = Math.min(SIDEBAR_MAX_RATIO, parseFloat(localStorage.getItem('shotlog_sidebar_ratio')) || SIDEBAR_MAX_RATIO);
let draggedItem = null; // { type: 'folder'|'session', id } — ドラッグ中のアイテム

let timerInterval  = null;
let timerStartedAt = null;
let timerBase      = 0;

let formState = {};
const sessionAlias = {}; // 圏外で始めた収録の仮ID → サーバーのID

// ============================================================
// UUID
// ============================================================
function uid() {
  // Supabase側にそのまま同期できるよう、正式なUUID形式で発行する
  return crypto.randomUUID();
}

// ============================================================
// TIME UTILITIES
// ============================================================
function formatHMS(totalSeconds) {
  if (totalSeconds == null || isNaN(totalSeconds)) return '--:--:--';
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function formatDuration(seconds) {
  if (seconds == null) return '自動';
  if (seconds === 'unknown') return '不明';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (rem === 0) return `${m}分`;
  return `${m}分${rem}秒`;
}

// ━━ 時間の入力欄：数字を続けて打つと右から埋まる（5 3 0 → 5:30、1 0 5 3 0 → 1:05:30） ━━
// 欄は1つだけなので、分から秒へタップで移る必要がない。hours：時:分:秒の欄か（なければ分:秒）
function timeEntryText(digits, hours) {
  if (!digits) return '';
  const sec = digits.slice(-2).padStart(2, '0');
  if (hours) return `${digits.slice(0, -4) || '0'}:${digits.slice(-4, -2).padStart(2, '0')}:${sec}`;
  return `${digits.slice(0, -2) || '0'}:${sec}`;
}

function timeEntryHtml(id, seconds, hours) {
  const value = seconds == null ? '' : secondsToEntry(seconds, hours);
  return `<input class="time-entry" type="text" inputmode="numeric" autocomplete="off" id="${id}"
    data-hours="${hours ? 1 : 0}" placeholder="${hours ? '0:00:00' : '0:00'}" value="${value}">`;
}

function secondsToEntry(seconds, hours) {
  const s = Math.floor(seconds);
  const pad = n => String(n).padStart(2, '0');
  return hours
    ? `${Math.floor(s / 3600)}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`
    : `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

// 欄の内容 → 秒。空なら null
function timeEntrySeconds(id) {
  const value = document.getElementById(id)?.value.trim();
  if (!value) return null;
  return value.split(':').reduce((sum, part) => sum * 60 + (parseInt(part) || 0), 0);
}

// 端末の時刻での今日(toISOString はUTCなので、朝9時前だと前日になる)
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getElapsedSeconds() {
  if (!timerStartedAt) return timerBase;
  return (Date.now() - timerStartedAt) / 1000 + timerBase;
}

function logDisplayTime(log, session) {
  const base   = session.timecodeStart || 0;
  const offset = session.offset || 0;
  return log.startOffset + base + offset;
}

// ============================================================
// ESCAPE HTML
// ============================================================
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ============================================================
// DATA HELPERS  (tree model)
// ============================================================
function getFolder(id)          { return appData.folders.find(f => f.id === id); }
function getTopLevelFolders()   { return appData.folders.filter(f => !f.parentId); }
function getChildFolders(pid)   { return appData.folders.filter(f => f.parentId === (pid || null)); }
function getSessionById(id)     { const key = sessionAlias[id] || id; return appData.sessions.find(s => s.id === key); }
function getSessionsInFolder(fid) { return appData.sessions.filter(s => s.folderId === (fid || null)); }
function getUnfiledSessions()   { return appData.sessions.filter(s => !s.folderId); }

// All descendant folder IDs (breadth-first)
function getFolderDescendants(folderId) {
  const result = [];
  const queue  = [folderId];
  while (queue.length) {
    const id = queue.shift();
    const children = appData.folders.filter(f => f.parentId === id);
    children.forEach(c => { result.push(c.id); queue.push(c.id); });
  }
  return result;
}

function isFolderDescendantOf(targetId, ancestorId) {
  return getFolderDescendants(ancestorId).includes(targetId);
}

// Breadcrumb path: array from root → folder
function getFolderPath(folderId) {
  const path = [];
  let cur = getFolder(folderId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? getFolder(cur.parentId) : null;
  }
  return path;
}

// 圏外で始めた収録がサーバーに登録できたら、IDを置き換える(開いている画面は仮IDのままでも引ける)
function remapSessionId(tempId, newId) {
  sessionAlias[tempId] = newId;
  const session = appData.sessions.find(s => s.id === tempId);
  if (session) { session.id = newId; delete session.pendingStart; saveData(); }
}

function currentFrame() { return navStack[navStack.length - 1]; }

function nextVideoNumber(session) {
  return session.logs.filter(l => l.type === 'video').length + 1;
}

// 「自動」の所要時間 = 次の記録まで(最後の記録は収録の終わりまで)。
// トラブルは本編の途中で起きるもの、入力忘れは後から足すものなので、区切りとして数えない
function resolveAutoDurations(session) {
  const logs = session.logs;
  logs.forEach((log, i) => {
    if (log.durationMode !== 'auto') return;
    const next = logs.slice(i + 1).find(n => n.type !== 'trouble' && !n.isMissed);
    let dur = null;
    if (next) dur = next.startOffset - log.startOffset;
    else if (session.endedAt && session.startedAt) dur = (session.endedAt - session.startedAt) / 1000 - log.startOffset;
    if (dur != null) dur = Math.max(0, Math.round(dur));
    if (log.duration !== dur) {
      log.duration = dur;
      window.ShotLogAuth.sync.updateLog(log.id, { duration_seconds: dur });
    }
  });
}

// 動画番号を時間順に振り直す(削除や入力忘れの追加のあと)
function renumberVideos(session) {
  let n = 1;
  session.logs.forEach(l => {
    if (l.type !== 'video') return;
    if (l.videoNumber !== n) {
      l.videoNumber = n;
      window.ShotLogAuth.sync.updateLog(l.id, { video_number: n });
    }
    n++;
  });
}

function sessionTitle(session) {
  return session.name || `第${session.number}回収録`;
}

// 別の収録が進行中なら、新しく始めずにそちらへ案内する
function recordingInProgress() {
  return appData.sessions.find(s => s.status === 'recording');
}

function sessionSummary(session) {
  let totalDur=0, videoDur=0, videoCount=0, workDur=0, workCount=0,
      breakDur=0, breakCount=0, talkCount=0, troubleCount=0;
  session.logs.forEach(l => {
    const d = typeof l.duration === 'number' ? l.duration : 0;
    totalDur += d;
    if (l.type==='video')   { videoDur+=d; videoCount++; }
    if (l.type==='work')    { workDur+=d;  workCount++;  }
    if (l.type==='break')   { breakDur+=d; breakCount++; }
    if (l.type==='talk')    { talkCount++; }
    if (l.type==='trouble') { troubleCount++; }
  });
  return { totalDur, videoDur, videoCount, workDur, workCount, breakDur, breakCount, talkCount, troubleCount };
}

// 総収録時間 = REC開始〜終了までの実経過時間（ログの合計ではない）
function recordingDuration(session) {
  if (session.startedAt && session.endedAt) {
    return (session.endedAt - session.startedAt) / 1000;
  }
  // まだ収録中、または旧データで記録が無い場合はログ合計にフォールバック
  return sessionSummary(session).totalDur;
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(frame) { navStack.push(frame); render(); }
function goBack() {
  if (navStack.length <= 1) return;
  const left = navStack.pop();
  // 右で戻ったら、左の一覧のそのフォルダも閉じる
  if (left.view === 'folder') expandedSidebarFolders.delete(left.folderId);
  render();
}
function goHome() { navStack = [{ view: 'home' }]; expandedSidebarFolders.clear(); render(); }

// ━━ 左の一覧の開閉と、右の画面を連動させる ━━
let lastFolderOpen = { fid: null, at: 0, wasOpen: false };  // ダブルクリックの1回目で開いた直後かを見分ける

function openFolder(fid) {
  lastFolderOpen = { fid, at: Date.now(), wasOpen: expandedSidebarFolders.has(fid) };
  getFolderPath(fid).forEach(f => expandedSidebarFolders.add(f.id));
  const cur = currentFrame();
  if (cur.view === 'folder' && cur.folderId === fid) render();
  else navigate({ view: 'folder', folderId: fid });
}

// 閉じたら、右に出ていたそのフォルダ（または中のフォルダ）から1つ上へ戻る
function closeFolder(fid) {
  const closed = new Set([fid, ...getFolderDescendants(fid)]);
  closed.forEach(id => expandedSidebarFolders.delete(id));
  const cur = currentFrame();
  if (cur.view === 'folder' && closed.has(cur.folderId)) {
    const parentId = getFolder(fid)?.parentId || null;
    navStack = navStack.filter(f => !(f.view === 'folder' && closed.has(f.folderId)));
    if (parentId && currentFrame().folderId !== parentId) navStack.push({ view: 'folder', folderId: parentId });
  }
  render();
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

// ============================================================
// BOTTOM SHEET
// ============================================================
function openSheet(html) {
  document.getElementById('sheet-body').innerHTML =
    `<button class="sheet-close" data-action="close-sheet" aria-label="閉じる">${icon('x', 15)}</button>${html}`;
  document.getElementById('bottom-sheet').classList.add('open');
  document.getElementById('overlay').classList.add('visible');
}
function closeSheet() {
  document.getElementById('bottom-sheet').classList.remove('open');
  document.getElementById('overlay').classList.remove('visible');
  formState = {};
}

// 入力欄の今の状態（開いたときと比べて、入力があるかを見るため）
function sheetSnapshot() {
  const values = [...document.querySelectorAll('#sheet-body input, #sheet-body textarea, #sheet-body select')].map(i => i.value);
  return JSON.stringify([values, formState.durationMode, formState.duration, formState.troubleCategory, formState.troubleSubcategory, formState.selectedType, formState.photos?.length]);
}
// 閉じるボタン・シートの外：記録の入力中なら、消してよいか確かめる
function requestCloseSheet() {
  if (formState._snapshot && formState._snapshot !== sheetSnapshot()) {
    showConfirm('入力を破棄しますか？', '入力した内容は保存されません。', closeSheet, '破棄する');
    return;
  }
  closeSheet();
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
function showConfirm(title, message, onOk, okLabel='削除', okClass='btn-danger') {
  const div = document.createElement('div');
  div.className = 'dialog-overlay';
  div.id = 'dialog-overlay';
  div.innerHTML = `
    <div class="dialog">
      <div class="dialog-title">${title}</div>
      <div class="dialog-message">${message}</div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" id="dlg-cancel">キャンセル</button>
        <button class="btn ${okClass}" id="dlg-ok">${okLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('#dlg-cancel').onclick = () => div.remove();
  div.querySelector('#dlg-ok').onclick    = () => { div.remove(); onOk(); };
}

// ============================================================
// TIMER
// ============================================================
function clockText() {
  const n = new Date();
  return [n.getHours(), n.getMinutes(), n.getSeconds()].map(v => String(v).padStart(2,'0')).join(':');
}

function startTimer(session) {
  timerStartedAt = Date.now();
  timerBase = session.timecodeStart || 0;
  session.startedAt = timerStartedAt;
  session.status = 'recording';
  saveData();
  timerInterval = setInterval(() => {
    const el  = document.getElementById('timer-display');
    if (el)  el.textContent = formatHMS(getElapsedSeconds());
    const clk = document.getElementById('timer-clock');
    if (clk) clk.textContent = clockText();
  }, 200);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resumeTimerIfNeeded() {
  for (const s of appData.sessions) {
    if (s.status === 'recording') {
      timerStartedAt = s.startedAt;
      timerBase = s.timecodeStart || 0;
      timerInterval = setInterval(() => {
        const el  = document.getElementById('timer-display');
        if (el)  el.textContent = formatHMS(getElapsedSeconds());
        const clk = document.getElementById('timer-clock');
        if (clk) clk.textContent = clockText();
      }, 200);
      navStack = [{ view: 'home' }, { view: 'recording', sessionId: s.id }];
      return;
    }
  }
}

// ============================================================
// GLOBAL TOP BAR(常時表示・SHOT LOGブランド + アカウント)
// ============================================================
function renderGlobalTopBar() {
  return `<div class="header app-topbar">
    <span class="header-title" style="text-align:left;padding-left:8px;display:flex;align-items:center;gap:8px">
      <img src="icons/favicon-32.png?v=4" alt="" width="24" height="24">SHOT LOG
    </span>
    <button class="header-btn" data-action="open-account">${icon('user', 20)}</button>
  </div>`;
}

// 圏外で未送信の変更があるときだけ、画面の上に帯で件数を出す。
// 上のバーはスマホのホーム以外で隠れるので、バーとは別にして収録中でも見えるようにする。
// 通信できているときは記録のたびに帯が出入りして画面が動くので出さない
function updateSyncBadge() {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  const n = window.ShotLogAuth.pendingCount();
  el.hidden = !(n > 0 && window.ShotLogAuth.isOffline());
  el.textContent = `圏外：未送信 ${n}件（つながると自動で送信します）`;
}

// ============================================================
// RENDER DISPATCHER
// ============================================================
function render() {
  const frame = currentFrame();
  const app   = document.getElementById('app');
  closeSheet();

  let view;
  switch (frame.view) {
    case 'home':           view = renderHome();                    break;
    case 'folder':         view = renderFolder(frame.folderId);   break;
    case 'session-setup':  view = renderSessionSetup();            break;
    case 'recording':      view = renderRecording();               break;
    case 'session-review': view = renderSessionReview();           break;
    case 'export':         view = renderExport();                  break;
    case 'account':        view = window.ShotLogAuth.renderAccountView(); break;
    case 'quota-blocked':  view = renderQuotaBlocked();                    break;
    case 'folder-quota-blocked': view = renderFolderQuotaBlocked();        break;
    default:               view = renderHome();
  }

  const activeFolderId = frame.view === 'folder' ? frame.folderId : null;
  app.dataset.view = frame.view;
  app.innerHTML = `${renderGlobalTopBar()}
  <div class="sync-badge" id="sync-badge" hidden></div>
  <div class="app-shell" style="--sidebar-width:${sidebarRatio * 100}vw">
    <aside class="app-sidebar">
      <div class="app-sidebar-scroll">${renderAppSidebar(activeFolderId)}</div>
      <div class="app-sidebar-resize" id="sidebar-resize-handle"></div>
    </aside>
    <div class="app-main">${view.header}${view.content}</div>
  </div>`;
  updateSyncBadge();

  if (frame.view === 'recording' && timerInterval) {
    const el = document.getElementById('timer-display');
    if (el) el.textContent = formatHMS(getElapsedSeconds());
  }
}

// ============================================================
// DESKTOP SIDEBAR(フォルダツリー・未分類ファイル)
// ============================================================
function renderAppSidebar(activeFolderId) {
  const folders = getTopLevelFolders();
  const unfiled = getUnfiledSessions();

  const foldersHtml = folders.length > 0
    ? folders.map(f => renderSidebarFolder(f, 0, activeFolderId)).join('')
    : `<div class="app-sidebar-empty">フォルダはありません</div>`;

  const unfiledHtml = unfiled.length > 0
    ? `<div class="app-sidebar-heading">未分類</div>
       <div class="app-sidebar-list">${[...unfiled].reverse().map(s => renderSidebarSession(s)).join('')}</div>`
    : '';

  return `
    <div class="app-sidebar-heading">フォルダ</div>
    <button class="app-sidebar-add" data-action="add-folder">＋ フォルダを追加</button>
    <div class="app-sidebar-list app-sidebar-drop-root" data-action="drop-to-root">${foldersHtml}</div>
    ${unfiledHtml}
  `;
}

// depth：フォルダの中に並べるときの階層（未分類なら null）
function renderSidebarSession(session, depth = null) {
  const isRec = session.status === 'recording';
  const inFolder = depth === null ? '' : ` is-in-folder" style="--folder-depth:${depth}`;
  return `<button class="sidebar-session-row${inFolder}" data-action="open-session" data-sid="${session.id}"
      draggable="true" data-drag-type="session" data-drag-id="${session.id}">
    <span class="sidebar-session-icon" style="color:${isRec ? 'var(--danger)' : 'var(--text3)'}">${icon(isRec ? 'record' : 'file', 16)}</span>
    <span class="sidebar-session-name">${esc(sessionTitle(session))}</span>
  </button>`;
}

// ============================================================
// SHARED ROW RENDERERS
// ============================================================
// マウスのある端末だけ、一覧の行をドラッグできるようにする（スマホは長押しの方式を使う）
const MOUSE_DRAG = window.matchMedia('(hover: hover) and (pointer: fine)').matches ? 'draggable="true"' : '';

function renderFolderRow(folder) {
  const childCount   = getChildFolders(folder.id).length;
  const sessionCount = getSessionsInFolder(folder.id).length;
  const sub = [
    childCount   > 0 ? `フォルダ ${childCount}件`  : '',
    sessionCount > 0 ? `収録 ${sessionCount}回` : '',
  ].filter(Boolean).join('・') || '0件';

  return `<div class="list-row" ${MOUSE_DRAG} data-drag-type="folder" data-drag-id="${folder.id}" data-drop-fid="${folder.id}">
    <button class="list-item" data-action="open-folder" data-fid="${folder.id}">
      <span class="list-item-icon" style="color:var(--text2)">${icon('folder', 22)}</span>
      <span class="list-item-body">
        <span class="list-item-title">${esc(folder.name)}</span>
        <span class="list-item-sub">${sub}</span>
      </span>
      <span class="list-item-chevron">›</span>
    </button>
    <button class="list-item-opts" data-action="folder-opts" data-fid="${folder.id}">···</button>
  </div>`;
}

function renderSidebarFolder(folder, depth = 0, activeFolderId = null) {
  const children = getChildFolders(folder.id);
  const sessions = getSessionsInFolder(folder.id);
  const hasChildren = children.length > 0 || sessions.length > 0;
  const isExpanded = expandedSidebarFolders.has(folder.id);
  const sessionCount = sessions.length;
  const isActive = folder.id === activeFolderId;

  return `<div class="sidebar-folder-group">
    <div class="sidebar-folder-row${isActive ? ' is-active' : ''}" style="--folder-depth:${depth}"
      data-action="drop-target" data-drop-fid="${folder.id}">
      <button class="sidebar-folder-toggle${hasChildren ? '' : ' is-empty'}"
        data-action="toggle-sidebar-folder" data-fid="${folder.id}"
        aria-label="${hasChildren ? (isExpanded ? 'フォルダを閉じる' : 'フォルダを展開') : '中身なし'}">
        ${hasChildren ? '<span class="sidebar-folder-chevron">›</span>' : ''}
      </button>
      <button class="sidebar-folder-open" data-action="open-folder" data-fid="${folder.id}"
        draggable="true" data-drag-type="folder" data-drag-id="${folder.id}">
        <span class="sidebar-folder-icon">${icon('folder', 16)}</span>
        <span class="sidebar-folder-name">${esc(folder.name)}</span>
        ${sessionCount > 0 ? `<span class="sidebar-folder-count">${sessionCount}</span>` : ''}
      </button>
      <button class="sidebar-folder-opts" data-action="folder-opts" data-fid="${folder.id}" aria-label="フォルダの操作">···</button>
    </div>
    ${isExpanded && hasChildren ? `<div class="sidebar-folder-children">
      ${children.map(child => renderSidebarFolder(child, depth + 1, activeFolderId)).join('')}
      ${[...sessions].reverse().map(s => renderSidebarSession(s, depth)).join('')}
    </div>` : ''}
  </div>`;
}

function renderSessionRow(session) {
  const isRec = session.status === 'recording';
  const sum   = sessionSummary(session);
  return `<div class="list-row" ${MOUSE_DRAG} data-drag-type="session" data-drag-id="${session.id}">
    <button class="list-item" data-action="open-session" data-sid="${session.id}">
      <span class="list-item-icon" style="color:${isRec ? 'var(--danger)' : 'var(--text2)'}">${isRec ? icon('record', 16) : icon('file', 22)}</span>
      <span class="list-item-body">
        <span class="list-item-title">${esc(sessionTitle(session))}${isRec ? ' <span style="color:var(--danger);font-size:12px">REC中</span>' : ''}</span>
        <span class="list-item-sub">${esc(session.date)}・${session.logs.length}件 動画${sum.videoCount}本</span>
      </span>
      <span class="list-item-chevron">›</span>
    </button>
    <button class="list-item-opts" data-action="session-opts" data-sid="${session.id}">···</button>
  </div>`;
}

// ============================================================
// VIEW: HOME
// ============================================================
let homeQuery = ''; // ホームの検索欄の文字

// ホームの一覧。検索中は、階層に関係なくフォルダと収録から探す
function renderHomeList() {
  const q = homeQuery.trim().toLowerCase();
  if (q) {
    const hit = text => String(text || '').toLowerCase().includes(q);
    const folders  = appData.folders.filter(f => hit(f.name));
    const sessions = appData.sessions.filter(s => hit(sessionTitle(s)) || hit(s.date) || hit(sessionFolderName(s)));
    if (folders.length === 0 && sessions.length === 0) {
      return `<div class="empty-state"><div class="empty-state-text">見つかりませんでした</div></div>`;
    }
    return (folders.length ? `<div class="section-label">フォルダ</div><div class="list-group">${folders.map(f => renderFolderRow(f)).join('')}</div>` : '')
      + (sessions.length ? `<div class="section-label">収録</div><div class="list-group">${[...sessions].reverse().map(s => renderSessionRow(s)).join('')}</div>` : '');
  }

  const folders  = getTopLevelFolders();
  const unfiled  = getUnfiledSessions();
  if (folders.length === 0 && unfiled.length === 0) {
    return `<div class="empty-state">
      <div class="empty-state-icon" style="opacity:0.4">${icon('folder', 48)}</div>
      <div class="empty-state-text">上のボタンで収録を開始するか<br>フォルダを作成してください</div>
    </div>`;
  }
  return (unfiled.length ? `<div class="section-label">未分類</div><div class="list-group">${[...unfiled].reverse().map(s => renderSessionRow(s)).join('')}</div>` : '')
    + (folders.length ? `<div class="section-label">フォルダ</div><div class="list-group">${folders.map(f => renderFolderRow(f)).join('')}</div>` : '')
    + LIST_HINT;
}

const LIST_HINT = `<div class="list-hint">行を長押しすると、フォルダへ移動できます</div>`;

function renderHome() {
  return {
    header: '',
    content: `<div class="content home-content">
      <div class="home-main-actions">
        <button class="btn btn-primary" data-action="new-quick-session">新規収録</button>
        <button class="btn btn-secondary" data-action="add-folder">＋ フォルダ</button>
      </div>
      <label class="search-box">${icon('search', 15)}
        <input type="search" id="home-search" placeholder="フォルダ・収録を検索" value="${esc(homeQuery)}" autocomplete="off">
      </label>
      <div id="home-list">${renderHomeList()}</div>
    </div>`,
  };
}

// ============================================================
// VIEW: FOLDER (any depth)
// ============================================================
function renderFolder(folderId) {
  const folder = getFolder(folderId);
  if (!folder) { goHome(); return { header: '', content: '' }; }

  const childFolders = getChildFolders(folderId);
  const sessions     = getSessionsInFolder(folderId);

  let content = '';
  if (childFolders.length === 0 && sessions.length === 0) {
    content = `<div class="empty-state">
      <div class="empty-state-icon" style="opacity:0.4">${icon('folder', 48)}</div>
      <div class="empty-state-text">空のフォルダです<br>収録を追加するかフォルダを作成してください</div>
    </div>`;
  } else {
    if (childFolders.length > 0) {
      content += `<div class="section-label">フォルダ</div>
        <div class="list-group">${childFolders.map(f => renderFolderRow(f)).join('')}</div>`;
    }
    if (sessions.length > 0) {
      const reversed = [...sessions].reverse();
      content += `<div class="section-label">収録一覧</div>
        <div class="list-group">${reversed.map(s => renderSessionRow(s)).join('')}</div>`;
    }
    content += LIST_HINT;
  }

  return {
    header: `<div class="header">
      <button class="header-btn" data-action="back">‹</button>
      <span class="header-title">${esc(folder.name)}</span>
      <span style="width:44px"></span>
    </div>`,
    content: `<div class="content">
      <div class="home-main-actions">
        <button class="btn btn-primary"
          data-action="new-session-in-folder" data-fid="${folderId}">新規収録</button>
        <button class="btn btn-secondary"
          data-action="add-subfolder" data-parent-fid="${folderId}">＋ フォルダ</button>
      </div>
      ${content}
    </div>`,
  };
}

// ============================================================
// VIEW: SESSION SETUP
// ============================================================
function renderSessionSetup() {
  const { folderId } = currentFrame();
  const sessionsHere = folderId ? getSessionsInFolder(folderId) : getUnfiledSessions();
  const nextNum = sessionsHere.length + 1;
  const today   = localToday();
  const fidAttr = folderId ? `data-fid="${folderId}"` : '';

  const billing = window.ShotLogAuth.getBilling();
  let quotaHtml = '';
  if (!billing && window.ShotLogAuth.billingChecked()) {
    // 取得を試して失敗した(圏外など)。描き直すと入力が消えるので、ここでは再試行しない
    quotaHtml = `<div class="quota-badge">圏外のため残り回数を確認できません</div>`;
  } else if (!billing) {
    window.ShotLogAuth.ensureBillingLoaded().then(() => {
      if (currentFrame().view === 'session-setup') render();
    });
    quotaHtml = `<div class="quota-badge">残り回数を確認中…</div>`;
  } else if (billing.plan !== 'pro') {
    const remaining = Math.max(0, 3 - (billing.free_recordings_used || 0)) + (billing.purchased_recordings_remaining || 0);
    quotaHtml = `<div class="quota-badge${remaining <= 1 ? ' quota-badge-warn' : ''}">残り${remaining}回</div>`;
  }

  return { header: `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">収録設定</span>
    <span style="width:44px"></span>
  </div>`, content: `
  <div class="content content-pad">

    <div class="setup-section">
      <div class="setup-section-title">収録情報</div>
      <div class="form-group">
        <label class="form-label">収録回</label>
        <input class="form-input" type="number" id="setup-num" value="${nextNum}" min="1">
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">日付</label>
        <input class="form-input" type="date" id="setup-date" value="${today}">
      </div>
    </div>

    <div class="setup-section">
      <div class="setup-section-title">タイム基準</div>
      <div class="segment" id="time-base-seg">
        <button class="segment-btn active" data-val="zero">ゼロスタート</button>
        <button class="segment-btn" data-val="timecode">タイムコード</button>
        <button class="segment-btn" data-val="realtime">現在時刻</button>
      </div>
      <div id="timecode-row" style="display:none;margin-top:12px">
        <label class="form-label">開始タイムコード</label>
        ${timeEntryHtml('tc-time', null, true)}
      </div>
    </div>

    <div class="setup-section">
      <div class="setup-section-title">オフセット補正（後から調整可）</div>
      <div style="display:flex;align-items:center;gap:8px">
        <select class="form-select" id="offset-sign" style="width:72px;flex-shrink:0">
          <option value="1">＋</option>
          <option value="-1">－</option>
        </select>
        ${timeEntryHtml('off-time', null, true)}
      </div>
    </div>

    ${quotaHtml}
    <div style="margin:0 0 32px">
      <button class="btn btn-rec" data-action="start-recording" ${fidAttr}>REC 開始</button>
    </div>
  </div>` };
}

// ============================================================
// VIEW: QUOTA BLOCKED(無料枠を使い切った時のブロック画面)
// ============================================================
function renderQuotaBlocked() {
  return { header: `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">無料枠を使い切りました</span>
    <span style="width:44px"></span>
  </div>`, content: `
  <div class="content content-pad" style="text-align:center;padding-top:40px">
    <p style="color:var(--text2);line-height:1.8;margin-bottom:28px">
      都度払いで1回追加できます。フォルダは増やせませんが、<br>
      今のフォルダのまま収録を続けられます。
    </p>
    <button class="btn btn-secondary" style="width:100%" data-action="checkout-one-time">都度払いで1回追加（¥550）</button>
    <p style="color:var(--text3);font-size:13px;line-height:1.8;margin:24px 0">
      ここまで良ければPro加入がお得になるタイミングです。
    </p>
    <button class="btn btn-primary" style="width:100%" data-action="checkout-subscription">Proに登録して使い放題（¥1,078/月）</button>
    ${window.ShotLogAuth.legalLinks()}
  </div>` };
}

// ============================================================
// VIEW: FOLDER QUOTA BLOCKED(無料プランのフォルダ上限に達した時)
// ============================================================
function renderFolderQuotaBlocked() {
  return { header: `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">フォルダ数の上限です</span>
    <span style="width:44px"></span>
  </div>`, content: `
  <div class="content content-pad" style="text-align:center;padding-top:40px">
    <p style="color:var(--text2);line-height:1.8;margin-bottom:28px">
      無料プランはフォルダを1件までしか作成できません。<br>
      複数の案件フォルダを管理するには、Proへの登録が必要です。
    </p>
    <button class="btn btn-primary" style="width:100%" data-action="checkout-subscription">Proに登録して使い放題（¥1,078/月）</button>
    ${window.ShotLogAuth.legalLinks()}
  </div>` };
}

// ============================================================
// VIEW: RECORDING
// ============================================================
function renderRecording() {
  const { sessionId } = currentFrame();
  const session = getSessionById(sessionId);
  if (!session) { goBack(); return { header: '', content: '' }; }

  const folderName = session.folderId
    ? (getFolder(session.folderId)?.name || '未分類')
    : '未分類';

  const logListHtml = session.logs.length === 0
    ? `<div class="empty-state" style="padding:32px 16px">
         <div class="empty-state-text">下のボタンをタップして記録を開始</div>
       </div>`
    : session.logs.map(l => renderLogRow(l, session)).join('');

  const elapsed = session.startedAt
    ? (Date.now() - session.startedAt) / 1000 + (session.timecodeStart||0)
    : (session.timecodeStart||0);

  return { header: `<div class="header">
      <div class="rec-header-info">
        <div class="rec-header-name">${esc(folderName)} ${esc(sessionTitle(session))}</div>
        <div class="rec-header-sub">${esc(session.date)}</div>
      </div>
      <button class="stop-btn" data-action="stop-recording" data-sid="${sessionId}">${icon('stop', 12)} STOP</button>
    </div>`, content: `
  <div class="recording-screen">
    <div class="timer-area">
      <div class="timer-session-info"><span class="rec-dot"></span>REC</div>
      <div class="timer-display recording" id="timer-display">${formatHMS(elapsed)}</div>
      <div class="timer-clock-row"><span>現在時刻</span><span class="timer-clock" id="timer-clock">${clockText()}</span></div>
    </div>

    <div class="log-list" id="log-list">
      ${logListHtml}
    </div>

    <div class="rec-buttons">
      <button class="rec-btn" data-type="video" data-action="tap-log" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('video', 26)}</span>
        <span class="rec-btn-label">動画</span>
      </button>
      <button class="rec-btn" data-type="work" data-action="tap-log" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('message', 26)}</span>
        <span class="rec-btn-label">ワーク</span>
      </button>
      <button class="rec-btn" data-type="break" data-action="tap-log" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('coffee', 26)}</span>
        <span class="rec-btn-label">休憩</span>
      </button>
      <button class="rec-btn" data-type="talk" data-action="tap-log" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('mic', 26)}</span>
        <span class="rec-btn-label">トーク</span>
      </button>
      <button class="rec-btn" data-type="trouble" data-action="tap-log" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('alertTriangle', 26)}</span>
        <span class="rec-btn-label">トラブル</span>
      </button>
      <button class="rec-btn" data-type="other" data-action="tap-log" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('list', 26)}</span>
        <span class="rec-btn-label">その他</span>
      </button>
      <button class="rec-btn rec-btn-missed" data-action="tap-missed-log" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('clock', 22)}</span>
        <span class="rec-btn-label">入力忘れ</span>
      </button>
    </div>
  </div>` };
}

// 記録の1行（収録画面と収録の詳細で共通）
function renderLogRow(log, session) {
  const t = LOG_TYPES[log.type] || LOG_TYPES.other;
  const typeLabel = log.type === 'video' ? `動画${log.videoNumber}` : t.label;
  const dur = log.type === 'talk' || log.type === 'trouble'             ? ''
            : log.durationMode === 'unknown'                            ? '不明'
            : log.durationMode === 'auto' && log.duration == null       ? '自動'
            : formatDuration(log.duration);
  const text = [log.type === 'trouble' ? troubleDetail(log) : '', logText(log), log.isMissed ? '※入力し忘れ' : '']
    .filter(Boolean).join(' / ');

  return `<div class="log-entry ${log.type === 'trouble' ? 'log-entry-trouble' : ''} ${log.isMissed ? 'log-entry-missed' : ''}"
      data-action="edit-log" data-log-id="${log.id}" data-sid="${session.id}">
    <span class="log-entry-bar" style="background:${t.color}"></span>
    <span class="log-entry-time">${formatHMS(logDisplayTime(log, session))}</span>
    <span class="log-entry-type" style="color:${t.color}">${typeLabel}</span>
    <span class="log-entry-memo">${esc(text)}</span>
    <span class="log-entry-duration">${dur}</span>
  </div>`;
}

// ============================================================
// VIEW: SESSION REVIEW
// ============================================================
function renderSessionReview() {
  const { sessionId } = currentFrame();
  const session = getSessionById(sessionId);
  if (!session) { goBack(); return { header: '', content: '' }; }

  const sum = sessionSummary(session);
  const item = (label, value, unit, sub = '', cls = '') => `<div class="summary-item">
      <div class="summary-item-label">${label}</div>
      <div class="summary-item-value ${cls}">${value}${unit ? `<small>${unit}</small>` : ''}</div>
      ${sub ? `<div class="summary-item-sub">${sub}</div>` : ''}
    </div>`;

  const logsHtml = session.logs.length === 0
    ? `<div class="empty-state"><div class="empty-state-text">記録がありません</div></div>`
    : `<div class="list-group">${session.logs.map(l => renderLogRow(l, session)).join('')}</div>`;

  const offset = session.offset ? (session.offset > 0 ? '+' : '-') + formatHMS(Math.abs(session.offset)) : '0:00:00';

  return { header: `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">${esc(sessionTitle(session))}</span>
    <button class="header-action" data-action="session-opts" data-sid="${sessionId}" aria-label="収録の操作">···</button>
  </div>`, content: `
  <div class="content">
    <div class="summary-card">
      <div class="summary-grid">
        ${item('総収録時間', formatHMS(recordingDuration(session)), '')}
        ${item('動画', sum.videoCount, '本', formatDuration(sum.videoDur))}
        ${item('ワーク', sum.workCount, '回', formatDuration(sum.workDur))}
        ${item('休憩', sum.breakCount, '回', formatDuration(sum.breakDur))}
        ${item('トーク', sum.talkCount, '回')}
        ${item('トラブル', sum.troubleCount, '件', '', sum.troubleCount > 0 ? 'is-trouble' : '')}
      </div>
    </div>

    <div class="section-label">タイムライン</div>
    ${logsHtml}

    <div class="review-actions">
      <div class="review-actions-row">
        <button class="btn btn-secondary btn-sm" data-action="add-missed-log" data-sid="${sessionId}">入力し忘れを追加</button>
        <button class="btn btn-secondary btn-sm" data-action="edit-offset" data-sid="${sessionId}">オフセット ${offset}</button>
      </div>
      <button class="btn btn-primary" data-action="go-export" data-sid="${sessionId}">出力</button>
    </div>
  </div>` };
}

// ============================================================
// VIEW: EXPORT
// ============================================================
function renderExport() {
  const { sessionId } = currentFrame();
  const session = getSessionById(sessionId);
  if (!session) { goBack(); return { header: '', content: '' }; }

  return { header: `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">出力</span>
    <span style="width:44px"></span>
  </div>`, content: `
  <div class="content content-pad">

    <div class="export-card">
      <div class="export-card-title">CSV（スプレッドシート）</div>
      <div class="export-btn-row">
        <button class="btn btn-secondary btn-sm" data-action="download-csv" data-sid="${sessionId}">ダウンロード</button>
        <button class="btn btn-secondary btn-sm" data-action="copy-csv" data-sid="${sessionId}">コピー</button>
      </div>
      <div class="export-preview">${esc(generateCSV(session))}</div>
    </div>

    <div class="export-card">
      <div class="export-card-title">テキスト</div>
      <div class="export-btn-row">
        <button class="btn btn-secondary btn-sm" data-action="download-txt" data-sid="${sessionId}">ダウンロード</button>
        <button class="btn btn-secondary btn-sm" data-action="copy-txt" data-sid="${sessionId}">コピー</button>
      </div>
      <div class="export-preview">${esc(generateText(session))}</div>
    </div>

    <div class="export-card">
      <div class="export-card-title">JSONデータ（共有・バックアップ）</div>
      <div class="export-btn-row">
        <button class="btn btn-secondary btn-sm" data-action="download-json" data-sid="${sessionId}">エクスポート</button>
        <button class="btn btn-secondary btn-sm" data-action="import-json">インポート</button>
      </div>
    </div>

  </div>` };
}

// ============================================================
// EXPORT GENERATORS
// ============================================================
function sessionFolderName(session) {
  return session.folderId ? (getFolder(session.folderId)?.name || '未分類') : '未分類';
}

// トラブルの内容（例：音声／ノイズ）
function troubleDetail(log) {
  const cat = TROUBLE_CATEGORIES[log.troubleCategory]?.label || '';
  return [cat, log.troubleSubcategory].filter(Boolean).join('／');
}

// 書き出す文字：ファイル名とメモの両方
function logText(log) {
  return [log.filename, log.memo].filter(Boolean).join(' / ');
}

function logNote(log) {
  const notes = [];
  if (log.isMissed) notes.push('※入力し忘れ');
  if (log.photos?.length) notes.push(`写真${log.photos.length}枚`);
  return notes.join(' ');
}

function generateCSV(session) {
  const header = ['確認','開始','終了','所要時間','項目','メモ','備考'].join(',');
  const rows = session.logs.map(l => {
    const t = LOG_TYPES[l.type] || LOG_TYPES.other;
    const startSec = logDisplayTime(l, session);
    const dur = l.durationMode === 'unknown' ? null
              : (l.durationMode === 'auto' && l.duration == null ? null : l.duration);
    const endSec = dur != null ? startSec + dur : null;
    const detail = l.type === 'trouble' ? troubleDetail(l) : '';
    const typeLabel = l.type === 'video' ? `動画 ${l.videoNumber}` : detail ? `${t.label}（${detail}）` : t.label;
    return [
      '□',
      formatHMS(startSec),
      endSec != null ? formatHMS(endSec) : '—',
      dur != null ? formatDuration(dur) : (l.durationMode === 'unknown' ? '不明' : '—'),
      typeLabel,
      `"${logText(l).replace(/"/g,'""')}"`,
      logNote(l),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function generateText(session) {
  const folderName = sessionFolderName(session);
  const sum = sessionSummary(session);
  const lines = [
    `【${folderName} ${sessionTitle(session)}】 ${session.date}`,
    '',
    `総収録時間: ${formatHMS(recordingDuration(session))}`,
    `動画: ${sum.videoCount}本・計${formatDuration(sum.videoDur)}`,
    `ワーク: ${sum.workCount}回・計${formatDuration(sum.workDur)}`,
    `休憩: ${sum.breakCount}回・計${formatDuration(sum.breakDur)}`,
    `トラブル: ${sum.troubleCount}件`,
    '',
    '--- タイムライン ---',
  ];
  session.logs.forEach(l => {
    const t = LOG_TYPES[l.type] || LOG_TYPES.other;
    const startSec  = logDisplayTime(l, session);
    const typeLabel = l.type === 'video' ? `動画${l.videoNumber}` : t.label;
    const dur = l.durationMode === 'unknown'                          ? '不明'
              : l.durationMode === 'auto' && l.duration == null       ? '自動'
              : formatDuration(l.duration);
    const detail = l.type === 'trouble' ? troubleDetail(l) : '';
    const body = [detail, logText(l), logNote(l)].filter(Boolean).join(' ');
    lines.push(`${formatHMS(startSec)} [${typeLabel}] ${dur} ${body}`);
  });
  return lines.join('\n');
}

// ============================================================
// FOLDER PICKER  (builds HTML for move destination sheet)
// ============================================================
// confirmAction : data-action value to put on each button
// extraAttrs    : extra data-* attribute string (e.g. data-sid="xxx")
// excludeFid    : folder to exclude (and its descendants)
// currentFid    : folder currently selected (shown as 現在地)
// indent / pid  : recursion state
function buildFolderPickerHtml(confirmAction, extraAttrs, excludeFid, currentFid, indent, parentId) {
  indent   = indent   || 0;
  parentId = parentId || null;

  const excludeSet = excludeFid
    ? new Set([excludeFid, ...getFolderDescendants(excludeFid)])
    : new Set();

  let html = '';
  const folders = appData.folders.filter(f => f.parentId === parentId);
  for (const f of folders) {
    if (excludeSet.has(f.id)) continue;
    const isCurrent = f.id === currentFid;
    const pl = (indent * 20 + 16) + 'px';
    html += `<button class="list-item" style="border-radius:var(--r-sm);padding-left:${pl}"
      data-action="${confirmAction}" data-target-fid="${f.id}" ${extraAttrs}>
      <span class="list-item-icon" style="color:var(--text2);margin-right:8px">${icon('folder', 18)}</span>
      <span class="list-item-body">
        <span class="list-item-title">${esc(f.name)}</span>
      </span>
      ${isCurrent ? '<span style="color:var(--primary);font-size:12px;flex-shrink:0">現在地</span>' : ''}
    </button>`;
    html += buildFolderPickerHtml(confirmAction, extraAttrs, excludeFid, currentFid, indent + 1, f.id);
  }
  return html;
}

// ============================================================
// LOG ENTRY FORMS (BOTTOM SHEET)
// ============================================================
function openLogForm(type, session, editLog = null, tapContext = null) {
  formState = {
    type,
    editLog,
    duration:           editLog?.duration          ?? null,
    durationMode:       editLog?.durationMode       ?? (type === 'talk' || type === 'trouble' ? 'unknown' : 'auto'),
    memo:               editLog?.memo               ?? '',
    filename:           editLog?.filename           ?? '',
    troubleCategory:    editLog?.troubleCategory    ?? '',
    troubleSubcategory: editLog?.troubleSubcategory ?? '',
    photos:             editLog?.photos ? [...editLog.photos] : [],
    isMissed:           editLog?.isMissed           ?? false,
    videoNumber:        editLog?.videoNumber        ?? null,
  };
  if (tapContext) formState._tapContext = tapContext;

  const presets  = type === 'break' ? DURATION_PRESETS_BREAK : DURATION_PRESETS_LONG;
  const t        = LOG_TYPES[type] || LOG_TYPES.other;
  const isEdit   = !!editLog;
  const title    = isEdit ? `${t.label}を編集` : `${t.label}を記録`;

  let durationHtml = '';
  if (type !== 'talk' && type !== 'trouble') {
    durationHtml = renderDurationPicker(presets, formState.durationMode, formState.duration);
  }

  let typeSpecificHtml = '';
  if (type === 'video') {
    typeSpecificHtml = `
      <div class="form-group">
        <label class="form-label">ファイル名 / 内容（任意）</label>
        <input class="form-input" type="text" id="f-filename" placeholder="例: scene_01.mp4"
          value="${esc(formState.filename)}">
      </div>`;
  }
  if (type === 'trouble') {
    typeSpecificHtml = renderTroubleFields(formState.troubleCategory, formState.troubleSubcategory);
  }

  const memoHtml = (type !== 'video') ? `
    <div class="form-group">
      <label class="form-label">メモ（任意）</label>
      <textarea class="form-input" id="f-memo" placeholder="メモを入力">${esc(formState.memo)}</textarea>
    </div>` : '';

  const photoHtml  = type === 'trouble' ? renderPhotoField(formState.photos) : '';
  const deleteHtml = isEdit ? `
    <button class="btn btn-danger btn-sm" style="margin-top:8px"
      data-action="delete-log" data-log-id="${editLog.id}" data-sid="${session.id}">
      削除
    </button>` : '';

  openSheet(`
    <div class="sheet-title">${title}</div>
    ${durationHtml}
    ${typeSpecificHtml}
    ${memoHtml}
    ${photoHtml}
    <button class="btn btn-primary" style="margin-top:4px" data-action="save-log">
      ${isEdit ? '保存' : '記録する'}
    </button>
    ${deleteHtml}
  `);
  formState._snapshot = sheetSnapshot();
}

function renderDurationPicker(presets, currentMode, currentDuration) {
  const isUnknown = currentMode === 'unknown';
  const isCustom  = currentMode === 'custom' && currentDuration != null;

  const presetBtns = presets.map(sec => {
    const selected = currentMode === 'preset' && currentDuration === sec ? 'selected' : '';
    return `<button class="preset-btn ${selected}" data-action="select-preset" data-sec="${sec}">
      ${formatDuration(sec)}
    </button>`;
  }).join('');

  const autoBtn = `<button class="preset-btn ${currentMode==='auto'?'selected':''}" data-action="select-auto">
    自動
  </button>`;
  const unknownBtn = `<button class="preset-btn unknown ${isUnknown?'selected':''}" data-action="select-unknown">
    不明
  </button>`;

  return `<div class="form-group">
    <label class="form-label">所要時間（自動＝次の記録まで）</label>
    <div class="preset-grid" id="preset-grid">
      ${autoBtn}
      ${unknownBtn}
      ${presetBtns}
    </div>
    <div class="custom-duration">
      <span>自由入力（分:秒）</span>
      ${timeEntryHtml('custom-time', isCustom ? currentDuration : null, false)}
    </div>
  </div>`;
}

function renderTroubleFields(selectedCat, selectedSub) {
  const catBtns = Object.entries(TROUBLE_CATEGORIES).map(([key, cat]) =>
    `<button class="category-btn ${selectedCat===key?'selected':''}" data-action="select-trouble-cat" data-cat="${key}">
      ${cat.label}
    </button>`
  ).join('');

  const subs = selectedCat ? TROUBLE_CATEGORIES[selectedCat]?.subs || [] : [];
  const subBtns = subs.length > 0
    ? subs.map(s => `<button class="sub-cat-btn ${selectedSub===s?'selected':''}" data-action="select-trouble-sub" data-sub="${s}">${s}</button>`).join('')
    : (selectedCat === 'equipment' ? `<input class="form-input" type="text" id="f-equipment-detail" placeholder="機材の詳細" value="${esc(selectedSub)}">` : '');

  return `<div class="form-group">
    <label class="form-label">カテゴリ</label>
    <div class="category-grid">${catBtns}</div>
    ${subs.length > 0 || selectedCat === 'equipment' ? `
    <div class="sub-category-row" id="sub-cat-row">${subBtns}</div>` : '<div id="sub-cat-row"></div>'}
  </div>`;
}

function renderPhotoField(photos) {
  const thumbs = photos.map((p, i) =>
    `<div style="position:relative">
      <img class="photo-thumb" src="${p}" alt="photo">
      <button data-action="remove-photo" data-index="${i}"
        style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer">×</button>
    </div>`
  ).join('');
  return `<div class="form-group">
    <label class="form-label">写真（任意）</label>
    <div class="photo-row" id="photo-row">
      ${thumbs}
      <label class="photo-add-btn">
        ＋<span style="font-size:11px">追加</span>
        <input type="file" accept="image/*" id="photo-input" style="display:none" multiple>
      </label>
    </div>
  </div>`;
}

function openMissedForm(session) {
  formState = {
    type: 'missed',
    isMissed: true,
    duration: null,
    durationMode: 'unknown',
    memo: '',
    troubleCategory: '',
    troubleSubcategory: '',
    missedH: '', missedM: '', missedS: '',
    selectedType: 'video',
  };

  const typeBtns = Object.entries(LOG_TYPES)
    .filter(([k]) => k !== 'missed')
    .map(([k, t]) =>
      `<button class="preset-btn ${formState.selectedType===k?'selected':''}" data-action="missed-type" data-mtype="${k}">${t.label}</button>`
    ).join('');

  openSheet(`
    <div class="sheet-title">入力し忘れを追加</div>

    <div class="form-group">
      <label class="form-label">タイム（発生した時間）</label>
      ${timeEntryHtml('missed-time', null, true)}
    </div>

    <div class="form-group">
      <label class="form-label">所要時間（任意）</label>
      ${timeEntryHtml('missed-dur', null, true)}
    </div>

    <div class="form-group">
      <label class="form-label">項目の種類</label>
      <div class="preset-grid">${typeBtns}</div>
    </div>

    <div class="form-group">
      <label class="form-label">メモ（任意）</label>
      <textarea class="form-input" id="f-memo" placeholder="メモを入力"></textarea>
    </div>

    <button class="btn btn-primary" data-action="save-missed-log">記録する</button>
  `);
  formState._snapshot = sheetSnapshot();
}

function openOffsetEdit(session) {
  const abs  = Math.abs(session.offset || 0);
  const sign = (session.offset || 0) < 0 ? -1 : 1;

  openSheet(`
    <div class="sheet-title">オフセット補正</div>
    <div class="form-group">
      <label class="form-label">全タイムスタンプをずらす量</label>
      <div style="display:flex;align-items:center;gap:8px">
        <select class="form-select" id="off-sign" style="width:72px;flex-shrink:0">
          <option value="1" ${sign===1?'selected':''}>＋</option>
          <option value="-1" ${sign===-1?'selected':''}>－</option>
        </select>
        ${timeEntryHtml('off-time2', abs, true)}
      </div>
    </div>
    <button class="btn btn-primary" data-action="save-offset" data-sid="${session.id}">保存</button>
  `);
}

// ============================================================
// ACTION HANDLERS
// ============================================================
// ============================================================
// START RECORDING(サーバー側で回数を確認・消費してから開始)
// ============================================================
async function beginRecordingSession(targetFid) {
  const num  = Math.max(1, parseInt(document.getElementById('setup-num')?.value) || 1);
  const date = document.getElementById('setup-date')?.value || localToday();

  const timeBaseActive = document.querySelector('#time-base-seg .segment-btn.active');
  const timeBase = timeBaseActive?.dataset.val || 'zero';

  let timecodeStart = 0;
  if (timeBase === 'timecode') {
    timecodeStart = timeEntrySeconds('tc-time') || 0;
  } else if (timeBase === 'realtime') {
    const now = new Date();
    timecodeStart = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  }

  const offSign = parseInt(document.getElementById('offset-sign')?.value) || 1;
  const offset = offSign * (timeEntrySeconds('off-time') || 0);

  const params = {
    p_folder_id: targetFid,
    p_number: num,
    p_recorded_on: date,
    p_time_base: timeBase,
    p_timecode_start: timecodeStart,
    p_offset_seconds: offset,
  };

  // 圏外でも収録は止めない。端末で始めて、つながったらサーバーに登録する
  let serverSession = null;
  try {
    serverSession = await window.ShotLogAuth.callStartRecording(params);
  } catch (e) {
    console.error('[shotlog] start_recording failed', e);
    if (!window.ShotLogAuth.isNetworkError(e)) {
      showToast('収録を開始できませんでした。残り回数をご確認ください');
      return;
    }
  }

  const session = {
    id: serverSession ? serverSession.id : uid(),
    folderId: targetFid,
    number: num,
    date,
    name: '',
    timeBase,
    timecodeStart,
    offset,
    startedAt: null,
    endedAt: null,
    status: 'recording',
    logs: [],
    createdAt: new Date().toISOString(),
  };
  if (!serverSession) session.pendingStart = true;

  appData.sessions.push(session);
  saveData();
  // 設定画面は履歴に残さない(STOP後の「戻る」で設定画面に戻らないように)
  navStack = navStack.filter(f => f.view !== 'session-setup');
  navStack.push({ view: 'recording', sessionId: session.id });
  render();
  startTimer(session);
  if (!serverSession) {
    window.ShotLogAuth.sync.queueStartRecording(session.id, params);
    showToast('圏外のため端末に記録します。つながったら自動で送信します');
  }
}

// ============================================================
// CREATE FOLDER(ログイン中はサーバー側で作成・件数上限を判定)
// ============================================================
async function saveNewFolder(name, parentFid) {
  if (window.ShotLogAuth.isLoggedIn()) {
    const { data, error } = await window.ShotLogAuth.sync.createFolder(name, parentFid);
    if (error) {
      closeSheet();
      if (error === 'Folder limit reached') {
        navigate({ view: 'folder-quota-blocked' });
      } else {
        showToast('フォルダを作成できませんでした');
      }
      return;
    }
    appData.folders.push({ id: data.id, name: data.name, parentId: data.parentId, createdAt: new Date().toISOString() });
  } else {
    appData.folders.push({ id: uid(), name, parentId: parentFid, createdAt: new Date().toISOString() });
  }
  saveData();
  closeSheet();
  render();
}

function handleAction(action, el) {
  if (action.indexOf('account-') === 0 || action.indexOf('checkout-') === 0) { window.ShotLogAuth.handleAction(action, el); return; }

  const sid = el.dataset.sid;
  const fid = el.dataset.fid;

  switch (action) {

    // ── Navigation ──────────────────────────────────────────
    case 'back': goBack(); break;
    case 'close-sheet': requestCloseSheet(); break;

    case 'open-account':
      navigate({ view: 'account' });
      break;

    case 'open-folder': {
      // ダブルクリックの2回目で、開き直しの記録を上書きしない
      const cur = currentFrame();
      if (cur.view === 'folder' && cur.folderId === fid) break;
      openFolder(fid);
      break;
    }

    case 'toggle-sidebar-folder':
      if (expandedSidebarFolders.has(fid)) closeFolder(fid);
      else openFolder(fid);
      break;

    case 'open-session': {
      const s = getSessionById(sid);
      if (!s) return;
      if (s.status === 'recording') {
        navigate({ view: 'recording',      sessionId: sid });
      } else {
        navigate({ view: 'session-review', sessionId: sid });
      }
      break;
    }

    case 'go-export':
      navigate({ view: 'export', sessionId: sid });
      break;

    // ── Create folders ───────────────────────────────────────
    case 'add-folder': {
      openSheet(`
        <div class="sheet-title">フォルダを追加</div>
        <div class="form-group">
          <label class="form-label">フォルダ名</label>
          <input class="form-input" type="text" id="new-folder-name" placeholder="例：企業名など">
        </div>
        <button class="btn btn-primary" data-action="save-folder">追加</button>
      `);
      setTimeout(() => document.getElementById('new-folder-name')?.focus(), 300);
      break;
    }

    case 'add-subfolder': {
      const pFid = el.dataset.parentFid;
      openSheet(`
        <div class="sheet-title">フォルダを追加</div>
        <div class="form-group">
          <label class="form-label">フォルダ名</label>
          <input class="form-input" type="text" id="new-folder-name" placeholder="例：フォルダ名など">
        </div>
        <button class="btn btn-primary" data-action="save-folder" data-parent-fid="${pFid}">追加</button>
      `);
      setTimeout(() => document.getElementById('new-folder-name')?.focus(), 300);
      break;
    }

    case 'save-folder': {
      const name = document.getElementById('new-folder-name')?.value.trim();
      if (!name) { showToast('名前を入力してください'); return; }
      const parentFid = el.dataset.parentFid || null;
      saveNewFolder(name, parentFid);
      break;
    }

    // ── Start session ────────────────────────────────────────
    case 'new-quick-session':
    case 'new-session-in-folder': {
      const running = recordingInProgress();
      if (running) {
        showToast('収録中です。先に STOP してください');
        navigate({ view: 'recording', sessionId: running.id });
        break;
      }
      const folderId = action === 'new-session-in-folder' ? fid : null;
      window.ShotLogAuth.requireLogin(() => navigate({ view: 'session-setup', folderId }));
      break;
    }

    case 'start-recording': {
      const targetFid = el.dataset.fid || null;
      const billing = window.ShotLogAuth.getBilling();

      if (!billing) {
        // 圏外でプラン情報がなくても収録は始められる(回数はつながったときに確認する)
        if (window.ShotLogAuth.billingChecked()) beginRecordingSession(targetFid);
        else showToast('プラン情報を確認中です。少し待ってから再度お試しください');
        break;
      }

      if (billing.plan === 'pro') {
        beginRecordingSession(targetFid);
        break;
      }

      const remaining = Math.max(0, 3 - (billing.free_recordings_used || 0)) + (billing.purchased_recordings_remaining || 0);

      if (remaining <= 0) {
        navigate({ view: 'quota-blocked' });
        break;
      }

      const title = remaining === 1 ? 'これが最後の無料枠です' : `残り${remaining}回です`;
      showConfirm(title, '開始しますか？', () => beginRecordingSession(targetFid), '開始する', 'btn-primary');
      break;
    }

    // ── Stop recording ───────────────────────────────────────
    case 'stop-recording': {
      const session = getSessionById(sid);
      if (!session) return;
      showConfirm('収録を終了しますか？', '終了後は閲覧・編集モードに切り替わります。',
        () => {
          stopTimer();
          session.status = 'completed';
          session.endedAt = Date.now();
          resolveAutoDurations(session);
          saveData();
          window.ShotLogAuth.sync.updateSession(session.id, {
            status: 'completed',
            ended_at: new Date(session.endedAt).toISOString(),
          });
          navStack[navStack.length-1] = { view: 'session-review', sessionId: session.id };
          render();
        }, '終了する', 'btn-danger'
      );
      break;
    }

    // ── Log buttons ──────────────────────────────────────────
    case 'tap-log': {
      const type     = el.dataset.type;
      const tapTime  = Date.now();
      const session  = getSessionById(sid);
      if (!session) return;
      const startOffset = (tapTime - session.startedAt) / 1000;
      openLogForm(type, session, null, { type, startOffset, sessionId: sid });
      break;
    }

    case 'save-log': {
      const ctx = formState._tapContext;
      if (!ctx) { saveEditedLog(); return; }

      const { type, startOffset, sessionId: ctxSid } = ctx;
      const session = getSessionById(ctxSid);
      if (!session) return;

      const log = buildLogFromForm(type, startOffset, false, session);
      if (!log) return;

      session.logs.push(log);
      session.logs.sort((a, b) => a.startOffset - b.startOffset);
      window.ShotLogAuth.sync.insertLog(log, session.id);
      renumberVideos(session);
      resolveAutoDurations(session);
      saveData();

      closeSheet();
      const ll = document.getElementById('log-list');
      if (ll) {
        ll.innerHTML = session.logs.map(l => renderLogRow(l, session)).join('');
        ll.scrollTop = ll.scrollHeight;
      }
      showToast(!navigator.onLine || window.ShotLogAuth.isOffline() ? `${LOG_TYPES[type].label}を端末に記録しました（未送信）` : `${LOG_TYPES[type].label}を記録しました`);
      break;
    }

    case 'edit-log': {
      const logId   = el.dataset.logId;
      const session = getSessionById(sid);
      if (!session) break;
      const log = session.logs.find(l => l.id === logId);
      if (!log) break;
      openLogForm(log.type, session, log);
      formState._editContext = { logId, sessionId: sid };
      break;
    }

    case 'delete-log': {
      const logId   = el.dataset.logId;
      const session = getSessionById(sid);
      if (!session) return;
      showConfirm('この記録を削除しますか？', '削除すると元に戻せません。',
        () => {
          session.logs = session.logs.filter(l => l.id !== logId);
          window.ShotLogAuth.sync.deleteLog(logId);
          renumberVideos(session);
          resolveAutoDurations(session);
          saveData();
          closeSheet();
          render();
        }
      );
      break;
    }

    // ── Missed log ───────────────────────────────────────────
    case 'tap-missed-log':
    case 'add-missed-log': {
      const session = getSessionById(sid);
      if (!session) return;
      openMissedForm(session);                        // openMissedForm overwrites formState → set _editContext AFTER
      formState._editContext = { sessionId: sid };
      break;
    }

    case 'save-missed-log': {
      const ctx     = formState._editContext;
      if (!ctx) return;
      const session = getSessionById(ctx.sessionId);
      if (!session) return;

      const missedAt = timeEntrySeconds('missed-time');
      if (missedAt === null) { showToast('発生した時間を入力してください'); return; }
      const startOffset = missedAt - (session.timecodeStart||0) - (session.offset||0);
      const type = formState.selectedType || 'other';
      const memo = document.getElementById('f-memo')?.value.trim() || '';

      const durSec = timeEntrySeconds('missed-dur') || 0;

      const log = {
        id: uid(),
        type,
        startOffset: Math.max(0, startOffset),
        duration:     durSec > 0 ? durSec : null,
        durationMode: durSec > 0 ? 'preset' : 'unknown',
        videoNumber:  type === 'video' ? nextVideoNumber(session) : null,
        filename: '',
        memo,
        troubleCategory: '', troubleSubcategory: '',
        photos: [],
        isMissed: true,
        createdAt: Date.now(),
      };

      session.logs.push(log);
      session.logs.sort((a,b) => a.startOffset - b.startOffset);
      window.ShotLogAuth.sync.insertLog(log, session.id);
      // 挿入位置によって既存の動画番号が変わる分も同期する
      renumberVideos(session);
      resolveAutoDurations(session);
      saveData();
      closeSheet();
      render();
      showToast('入力し忘れを追加しました');
      break;
    }

    // ── Duration preset ──────────────────────────────────────
    case 'select-preset':
    case 'select-auto':
    case 'select-unknown': {
      formState.durationMode = action === 'select-preset' ? 'preset' : action === 'select-auto' ? 'auto' : 'unknown';
      formState.duration = action === 'select-preset' ? parseInt(el.dataset.sec) : null;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('selected', b === el));
      // 自由入力の数字が残っていると、保存のときにそちらが優先されてしまう
      document.querySelectorAll('.custom-duration input').forEach(i => { i.value = ''; i.classList.remove('active'); });
      break;
    }

    // ── Trouble ──────────────────────────────────────────────
    case 'select-trouble-cat': {
      const cat = el.dataset.cat;
      formState.troubleCategory    = cat;
      formState.troubleSubcategory = '';
      document.querySelectorAll('.category-btn').forEach(b =>
        b.classList.toggle('selected', b.dataset.cat === cat)
      );
      const row  = document.getElementById('sub-cat-row');
      if (row) {
        const subs = TROUBLE_CATEGORIES[cat]?.subs || [];
        if (subs.length > 0) {
          row.className = 'sub-category-row';
          row.innerHTML = subs.map(s =>
            `<button class="sub-cat-btn" data-action="select-trouble-sub" data-sub="${s}">${s}</button>`
          ).join('');
        } else if (cat === 'equipment') {
          row.className = 'sub-category-row';
          row.innerHTML = `<input class="form-input" type="text" id="f-equipment-detail" placeholder="機材の詳細">`;
        } else {
          row.className = '';
          row.innerHTML = '';
        }
      }
      break;
    }

    case 'select-trouble-sub': {
      const sub = el.dataset.sub;
      formState.troubleSubcategory = sub;
      document.querySelectorAll('.sub-cat-btn').forEach(b =>
        b.classList.toggle('selected', b.dataset.sub === sub)
      );
      break;
    }

    // ── Missed type ──────────────────────────────────────────
    case 'missed-type': {
      const mtype = el.dataset.mtype;
      formState.selectedType = mtype;
      document.querySelectorAll('[data-action="missed-type"]').forEach(b =>
        b.classList.toggle('selected', b.dataset.mtype === mtype)
      );
      break;
    }

    // ── Photo ────────────────────────────────────────────────
    case 'remove-photo': {
      const idx = parseInt(el.dataset.index);
      formState.photos.splice(idx, 1);
      const row = document.getElementById('photo-row');
      if (row) {
        const thumbs = formState.photos.map((p, i) =>
          `<div style="position:relative">
            <img class="photo-thumb" src="${p}" alt="photo">
            <button data-action="remove-photo" data-index="${i}"
              style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer">×</button>
          </div>`
        ).join('');
        const addBtn = row.querySelector('label');
        row.innerHTML = thumbs;
        if (addBtn) row.appendChild(addBtn);
      }
      break;
    }

    // ── Offset ───────────────────────────────────────────────
    case 'edit-offset': {
      const session = getSessionById(sid);
      if (!session) return;
      openOffsetEdit(session);
      break;
    }

    case 'save-offset': {
      const session = getSessionById(sid);
      if (!session) return;
      const sign = parseInt(document.getElementById('off-sign')?.value) || 1;
      session.offset = sign * (timeEntrySeconds('off-time2') || 0);
      saveData();
      window.ShotLogAuth.sync.updateSession(session.id, { offset_seconds: session.offset });
      closeSheet();
      render();
      showToast('オフセットを更新しました');
      break;
    }

    // ── Export ───────────────────────────────────────────────
    case 'download-csv': {
      const session = getSessionById(sid);
      downloadFile(generateCSV(session), `shotlog_${session.date}_${sessionFolderName(session)}_${sessionTitle(session)}.csv`, 'text/csv');
      break;
    }
    case 'copy-csv': {
      copyText(generateCSV(getSessionById(sid)));
      break;
    }
    case 'download-txt': {
      const session = getSessionById(sid);
      downloadFile(generateText(session), `shotlog_${session.date}_${sessionFolderName(session)}_${sessionTitle(session)}.txt`, 'text/plain');
      break;
    }
    case 'copy-txt': {
      copyText(generateText(getSessionById(sid)));
      break;
    }
    case 'download-json': {
      const session = getSessionById(sid);
      const exportData = { version: 2, exportedAt: new Date().toISOString(), session };
      downloadFile(JSON.stringify(exportData, null, 2), `shotlog_export_${session.date}.json`, 'application/json');
      break;
    }
    case 'import-json': {
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = '.json';
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try   { handleImport(JSON.parse(ev.target.result)); }
          catch { showToast('JSONの読み込みに失敗しました'); }
        };
        reader.readAsText(file);
      };
      input.click();
      break;
    }

    // ── FOLDER ··· MENU ─────────────────────────────────────
    case 'folder-opts': {
      const folder = getFolder(fid);
      if (!folder) return;
      openSheet(`
        <div class="sheet-title">${esc(folder.name)}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-secondary" data-action="add-subfolder" data-parent-fid="${fid}">フォルダ追加</button>
          <button class="btn btn-secondary" data-action="move-folder" data-fid="${fid}">移動</button>
          <button class="btn btn-secondary" data-action="rename-folder" data-fid="${fid}">名前を変更</button>
          <button class="btn btn-secondary" style="color:var(--delete)" data-action="delete-folder" data-fid="${fid}">削除する</button>
        </div>
      `);
      break;
    }

    case 'move-folder': {
      const moveFid  = fid;
      const folder   = getFolder(moveFid);
      if (!folder) return;
      const curParent = folder.parentId || null;

      // Root option
      const rootCurrent = !curParent;
      let pickerHtml = `<button class="list-item" style="border-radius:var(--r-sm)"
        data-action="confirm-move-folder" data-fid="${moveFid}" data-target-fid="">
        <span class="list-item-icon" style="color:var(--text2);margin-right:8px">${icon('home', 18)}</span>
        <span class="list-item-body"><span class="list-item-title">トップレベル</span></span>
        ${rootCurrent ? '<span style="color:var(--primary);font-size:12px;flex-shrink:0">現在地</span>' : ''}
      </button>`;
      pickerHtml += buildFolderPickerHtml('confirm-move-folder', `data-fid="${moveFid}"`, moveFid, curParent);

      openSheet(`
        <div class="sheet-title">移動先を選択</div>
        <div class="list-group" style="margin:0">${pickerHtml}</div>
      `);
      break;
    }

    case 'confirm-move-folder': {
      const moveFid    = fid;
      const targetFid  = el.dataset.targetFid || null;  // '' means top level
      const folder     = getFolder(moveFid);
      if (!folder) return;

      // Cycle detection
      if (targetFid && (targetFid === moveFid || isFolderDescendantOf(targetFid, moveFid))) {
        showToast('自分自身または子フォルダには移動できません');
        return;
      }

      folder.parentId = targetFid || null;
      saveData();
      window.ShotLogAuth.sync.updateFolder(moveFid, { parent_id: targetFid || null });
      closeSheet();
      render();
      showToast('移動しました');
      break;
    }

    case 'rename-folder': {
      const folder = getFolder(fid);
      if (!folder) return;
      openSheet(`
        <div class="sheet-title">フォルダ名を変更</div>
        <div class="form-group">
          <label class="form-label">フォルダ名</label>
          <input class="form-input" type="text" id="rename-folder-input" value="${esc(folder.name)}">
        </div>
        <button class="btn btn-primary" data-action="save-rename-folder" data-fid="${fid}">保存</button>
      `);
      setTimeout(() => {
        const input = document.getElementById('rename-folder-input');
        if (input) { input.focus(); input.select(); }
      }, 300);
      break;
    }

    case 'save-rename-folder': {
      const folder = getFolder(fid);
      if (!folder) return;
      const name = document.getElementById('rename-folder-input')?.value.trim();
      if (!name) { showToast('名前を入力してください'); return; }
      folder.name = name;
      saveData();
      window.ShotLogAuth.sync.updateFolder(fid, { name });
      closeSheet();
      render();
      showToast('名前を変更しました');
      break;
    }

    case 'delete-folder': {
      const folder = getFolder(fid);
      if (!folder) return;
      showConfirm(
        `「${esc(folder.name)}」を削除しますか？`,
        '中のフォルダ・収録データもすべて削除されます。',
        () => {
          const toDelete = new Set([fid, ...getFolderDescendants(fid)]);
          const sessionsToDelete = appData.sessions.filter(s => toDelete.has(s.folderId));
          appData.folders  = appData.folders.filter(f => !toDelete.has(f.id));
          appData.sessions = appData.sessions.filter(s => !toDelete.has(s.folderId));
          saveData();
          // サーバー側:セッション(→配下のログはcascadeで自動削除)を先に、次にフォルダを削除
          sessionsToDelete.forEach(s => window.ShotLogAuth.sync.deleteSession(s.id));
          toDelete.forEach(id => window.ShotLogAuth.sync.deleteFolder(id));
          // 削除されたフォルダ（またはその祖先）を表示中なら navStack をクリアしてホームへ
          const wasViewing = navStack.some(f => f.view === 'folder' && toDelete.has(f.folderId));
          if (wasViewing) goHome();
          else render();
          showToast('削除しました');
        }
      );
      break;
    }

    // ── SESSION ··· MENU ─────────────────────────────────────
    case 'session-opts': {
      const session = getSessionById(sid);
      if (!session) return;
      const title = session.name || `第${session.number}回収録`;
      openSheet(`
        <div class="sheet-title">${esc(title)}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-secondary" data-action="move-session" data-sid="${sid}">移動</button>
          <button class="btn btn-secondary" data-action="rename-session" data-sid="${sid}">名前を変更</button>
          <button class="btn btn-secondary" style="color:var(--delete)" data-action="delete-session" data-sid="${sid}">削除する</button>
        </div>
      `);
      break;
    }

    case 'move-session': {
      const session = getSessionById(sid);
      if (!session) return;
      const curFid = session.folderId || null;

      // Unfiled option
      const unfiledCurrent = !curFid;
      let pickerHtml = `<button class="list-item" style="border-radius:var(--r-sm)"
        data-action="confirm-move-session" data-sid="${sid}" data-target-fid="">
        <span class="list-item-icon" style="color:var(--text2);margin-right:8px">${icon('file', 18)}</span>
        <span class="list-item-body"><span class="list-item-title">未分類</span></span>
        ${unfiledCurrent ? '<span style="color:var(--primary);font-size:12px;flex-shrink:0">現在地</span>' : ''}
      </button>`;
      pickerHtml += buildFolderPickerHtml('confirm-move-session', `data-sid="${sid}"`, null, curFid);

      openSheet(`
        <div class="sheet-title">移動先を選択</div>
        <div class="list-group" style="margin:0">${pickerHtml}</div>
      `);
      break;
    }

    case 'confirm-move-session': {
      const session = getSessionById(sid);
      if (!session) return;
      const targetFid = el.dataset.targetFid || null;
      session.folderId = targetFid || null;
      saveData();
      window.ShotLogAuth.sync.updateSession(sid, { folder_id: targetFid || null });
      closeSheet();
      render();
      showToast('移動しました');
      break;
    }

    case 'rename-session': {
      const session = getSessionById(sid);
      if (!session) return;
      openSheet(`
        <div class="sheet-title">収録名を変更</div>
        <div class="form-group">
          <label class="form-label">収録名</label>
          <input class="form-input" type="text" id="rename-session-input"
            value="${esc(session.name || '')}" placeholder="第${session.number}回収録">
        </div>
        <button class="btn btn-primary" data-action="save-rename-session" data-sid="${sid}">保存</button>
      `);
      setTimeout(() => {
        const input = document.getElementById('rename-session-input');
        if (input) { input.focus(); input.select(); }
      }, 300);
      break;
    }

    case 'save-rename-session': {
      const session = getSessionById(sid);
      if (!session) return;
      const name = document.getElementById('rename-session-input')?.value.trim();
      session.name = name || '';
      saveData();
      window.ShotLogAuth.sync.updateSession(sid, { name: session.name });
      closeSheet();
      render();
      showToast('名前を変更しました');
      break;
    }

    case 'delete-session': {
      const session = getSessionById(sid);
      if (!session) return;
      showConfirm(
        `${esc(sessionTitle(session))}を削除しますか？`,
        'この収録のすべてのログが削除されます。',
        () => {
          const id = session.id;
          if (session.status === 'recording') stopTimer();
          appData.sessions = appData.sessions.filter(s => s.id !== id);
          saveData();
          window.ShotLogAuth.sync.deleteSession(id);
          // 削除した収録の画面を開いていなければ、今の一覧に留まる
          navStack = navStack.filter(f => !(f.sessionId && !getSessionById(f.sessionId)));
          render();
          showToast('削除しました');
        }
      );
      break;
    }
  }
}

// ============================================================
// BUILD LOG FROM FORM
// ============================================================
function buildLogFromForm(type, startOffset, isMissed, session) {
  let duration     = formState.duration;
  let durationMode = formState.durationMode;

  const custom = timeEntrySeconds('custom-time');
  if (custom > 0) { duration = custom; durationMode = 'custom'; }

  if (type === 'talk' || type === 'trouble') {
    duration = null; durationMode = 'unknown';
  }

  const memo     = document.getElementById('f-memo')?.value.trim() || '';
  const filename = document.getElementById('f-filename')?.value.trim() || '';

  let troubleCategory    = formState.troubleCategory;
  let troubleSubcategory = formState.troubleSubcategory;
  const equipDetail = document.getElementById('f-equipment-detail');
  if (equipDetail) troubleSubcategory = equipDetail.value.trim();

  const videoNumber = type === 'video' && session ? nextVideoNumber(session) : null;

  return {
    id: uid(),
    type,
    startOffset,
    duration,
    durationMode,
    videoNumber,
    filename,
    memo,
    troubleCategory,
    troubleSubcategory,
    photos: [...(formState.photos || [])],
    isMissed,
    createdAt: Date.now(),
  };
}

// ============================================================
// SAVE EDITED LOG
// ============================================================
function saveEditedLog() {
  const ctx = formState._editContext;
  if (!ctx) return;
  const session = getSessionById(ctx.sessionId);
  if (!session) return;
  const log = session.logs.find(l => l.id === ctx.logId);
  if (!log) return;

  let duration     = formState.duration;
  let durationMode = formState.durationMode;
  const custom = timeEntrySeconds('custom-time');
  if (custom > 0) { duration = custom; durationMode = 'custom'; }
  if (log.type === 'talk' || log.type === 'trouble') { duration = null; durationMode = 'unknown'; }

  log.duration     = duration;
  log.durationMode = durationMode;
  const memoEl     = document.getElementById('f-memo');
  const filenameEl = document.getElementById('f-filename');
  if (memoEl)     log.memo     = memoEl.value.trim();
  if (filenameEl) log.filename = filenameEl.value.trim();
  log.troubleCategory = formState.troubleCategory || log.troubleCategory;
  const equipDetail   = document.getElementById('f-equipment-detail');
  log.troubleSubcategory = equipDetail
    ? equipDetail.value.trim()
    : (formState.troubleSubcategory || log.troubleSubcategory);
  log.photos = [...(formState.photos || [])];

  saveData();
  window.ShotLogAuth.sync.updateLog(log.id, {
    duration_seconds: log.duration,
    duration_mode: log.durationMode,
    memo: log.memo,
    filename: log.filename,
    trouble_category: log.troubleCategory,
    trouble_subcategory: log.troubleSubcategory,
    photos: log.photos,
  });
  resolveAutoDurations(session);
  saveData();
  closeSheet();
  render();
  showToast('変更を保存しました');
}

// ============================================================
// IMPORT
// ============================================================
function handleImport(data) {
  // Support both v1 and v2 export formats
  let importSession = null;
  if (data.version === 2 && data.session) {
    importSession = data.session;
  } else if (data.session) {
    importSession = data.session;
  }
  if (!importSession) { showToast('不正なデータ形式です'); return; }

  // 必須フィールドの検証
  if (typeof importSession.number === 'undefined' ||
      !Array.isArray(importSession.logs)) {
    showToast('データが壊れています'); return;
  }

  openSheet(`
    <div class="sheet-title">インポート</div>
    <div style="margin-bottom:16px;color:var(--text2);font-size:14px">
      第${parseInt(importSession.number)||1}回収録 (${esc(String(importSession.date||''))})<br>
      ${importSession.logs.length}件の記録
    </div>
    <div class="form-group">
      <label class="form-label">保存先フォルダ</label>
      <select class="form-select" id="import-dest">
        <option value="">未分類</option>
        ${appData.folders.map(f =>
          `<option value="${f.id}">${esc(f.name)}</option>`
        ).join('')}
      </select>
    </div>
    <button class="btn btn-primary" id="import-confirm-btn">インポート</button>
  `);

  document.getElementById('import-confirm-btn').onclick = async () => {
    const destFid = document.getElementById('import-dest')?.value || null;
    if (window.ShotLogAuth.isLoggedIn()) {
      const { error } = await window.ShotLogAuth.importSession(importSession, destFid);
      if (error) {
        console.error('[shotlog] import failed', error);
        showToast('インポートできませんでした。通信状態をご確認ください');
        return;
      }
    } else {
      appData.sessions.push({ ...importSession, id: uid(), folderId: destFid || null, status: 'completed' });
      saveData();
    }
    closeSheet();
    goHome();
    showToast('インポートしました');
  };
}

// ============================================================
// FILE UTILITIES
// ============================================================
function downloadFile(content, filename, mimeType) {
  const blob = new Blob(['﻿'+content], { type: mimeType+';charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('ダウンロードしました');
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => showToast('コピーしました'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('コピーしました');
    });
}

// ============================================================
// EVENT DELEGATION
// ============================================================
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  handleAction(el.dataset.action, el);
});

// 左の一覧：フォルダをダブルクリックすると開閉する。
// 1回目のクリックで開いた直後なら、開いたままにする（閉じていたものを開く操作なので）
document.addEventListener('dblclick', e => {
  const fid = e.target.closest('.sidebar-folder-open')?.dataset.fid;
  if (!fid) return;
  const justOpened = lastFolderOpen.fid === fid && !lastFolderOpen.wasOpen && Date.now() - lastFolderOpen.at < 600;
  if (justOpened) return;
  if (expandedSidebarFolders.has(fid)) closeFolder(fid);
  else openFolder(fid);
});

// Segment buttons (time base)
document.addEventListener('click', e => {
  const btn = e.target.closest('.segment-btn');
  if (!btn) return;
  const seg = btn.closest('.segment');
  if (!seg) return;
  seg.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (seg.id === 'time-base-seg') {
    const tcRow = document.getElementById('timecode-row');
    if (tcRow) tcRow.style.display = btn.dataset.val === 'timecode' ? 'block' : 'none';
  }
});

const TIME_DIGITS_MS  = 5; // 分:秒の欄の桁数（999:59 まで）
const TIME_DIGITS_HMS = 6; // 時:分:秒の欄の桁数（99:59:59 まで）

// Custom duration input / ホームの検索
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'home-search') {
    homeQuery = e.target.value;
    const list = document.getElementById('home-list');
    if (list) list.innerHTML = renderHomeList();
    return;
  }
  if (e.target.classList.contains('time-entry')) {
    const hours  = e.target.dataset.hours === '1';
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, hours ? TIME_DIGITS_HMS : TIME_DIGITS_MS);
    e.target.value = timeEntryText(digits, hours);
    e.target.setSelectionRange(e.target.value.length, e.target.value.length);
  }
  if (id === 'custom-time') {
    // 全部消したら「自動」に戻す
    if (!e.target.value) { document.querySelector('[data-action="select-auto"]')?.click(); return; }
    formState.durationMode = 'custom';
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
    e.target.classList.add('active');
  }
});

// 時間の欄を開いたら全選択にする（入っている値は、打った数字で置き換わる）
document.addEventListener('focusin', e => {
  if (e.target.classList?.contains('time-entry')) e.target.select();
});

// Photo input
document.addEventListener('change', e => {
  if (e.target.id === 'photo-input') {
    const files = Array.from(e.target.files);
    files.forEach(async file => {
      const giveUp = new Promise(resolve => setTimeout(() => resolve(null), 8000));
      const dataUrl = await Promise.race([shrinkPhoto(file).catch(() => null), giveUp]);
      if (!dataUrl) { showToast('写真を読み込めませんでした'); return; }
      formState.photos = formState.photos || [];
      formState.photos.push(dataUrl);
      const row = document.getElementById('photo-row');
      if (row) {
        const div = document.createElement('div');
        div.style.position = 'relative';
        const idx = formState.photos.length - 1;
        div.innerHTML = `<img class="photo-thumb" src="${dataUrl}" alt="photo">
          <button data-action="remove-photo" data-index="${idx}"
            style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer">×</button>`;
        const addBtn = row.querySelector('label');
        row.insertBefore(div, addBtn);
      }
    });
  }
});

// スマホの写真は数MBあり端末の保存容量をすぐ超えるので、長辺1600pxのJPEGに縮めてから持つ
const PHOTO_MAX_SIDE = 1600;
async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.7);
}

// Close sheet on overlay tap
document.getElementById('overlay').addEventListener('click', requestCloseSheet);

// ============================================================
// SIDEBAR: フォルダ/ファイルのドラッグ&ドロップ移動
// ============================================================
let dropTargetEl = null;

function clearDropTarget() {
  if (dropTargetEl) { dropTargetEl.classList.remove('is-drop-over'); dropTargetEl = null; }
}

document.addEventListener('dragstart', e => {
  const el = e.target.closest('[draggable="true"]');
  if (!el) return;
  draggedItem = { type: el.dataset.dragType, id: el.dataset.dragId };
  el.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', el.dataset.dragId);
});

document.addEventListener('dragend', e => {
  const el = e.target.closest('[draggable="true"]');
  if (el) el.classList.remove('is-dragging');
  clearDropTarget();
  draggedItem = null;
});

document.addEventListener('dragover', e => {
  if (!draggedItem) return;
  const folderRow = e.target.closest('.sidebar-folder-row, .list-row[data-drop-fid]');
  const rootZone  = e.target.closest('.app-sidebar-drop-root');
  if (!folderRow && !rootZone) return;

  e.preventDefault();
  const target = folderRow || rootZone;
  if (dropTargetEl !== target) {
    clearDropTarget();
    if (folderRow) { dropTargetEl = target; dropTargetEl.classList.add('is-drop-over'); }
  }
});

document.addEventListener('dragleave', e => {
  const folderRow = e.target.closest('.sidebar-folder-row, .list-row[data-drop-fid]');
  if (folderRow && folderRow === dropTargetEl && !folderRow.contains(e.relatedTarget)) {
    clearDropTarget();
  }
});

document.addEventListener('drop', e => {
  if (!draggedItem) return;
  const folderRow = e.target.closest('.sidebar-folder-row, .list-row[data-drop-fid]');
  const rootZone  = e.target.closest('.app-sidebar-drop-root');
  if (!folderRow && !rootZone) return;
  e.preventDefault();

  const targetFolderId = folderRow ? folderRow.dataset.dropFid : null;
  moveItem(draggedItem, targetFolderId);
  clearDropTarget();
});

// フォルダ / 収録を別のフォルダへ移す(PCのドラッグ・スマホのドラッグ共通)
function moveItem(item, targetFolderId) {
  const target = targetFolderId || null;
  if (item.type === 'folder') {
    const folder = getFolder(item.id);
    if (!folder || target === item.id || folder.parentId === target) return false;
    if (target && isFolderDescendantOf(target, item.id)) {
      showToast('自分自身または子フォルダには移動できません');
      return false;
    }
    folder.parentId = target;
    window.ShotLogAuth.sync.updateFolder(item.id, { parent_id: target });
  } else {
    const session = getSessionById(item.id);
    if (!session || session.folderId === target) return false;
    session.folderId = target;
    window.ShotLogAuth.sync.updateSession(session.id, { folder_id: target });
  }
  saveData();
  render();
  showToast('移動しました');
  return true;
}

// ============================================================
// スマホ：一覧の行を長押ししてドラッグで移動
// ============================================================
const TOUCH_HOLD_MS = 350;   // 長押しと判定する時間
const TOUCH_SLOP_PX = 10;    // これ以上動いたらスクロールとみなして取り消す
let touchDrag = null;        // { row, item, x, y, timer, active, ghost, upZone, over }

function touchDragStart(row, x, y) {
  const title = row.querySelector('.list-item-title')?.textContent.trim() || '';
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = title;
  document.body.appendChild(ghost);
  touchDrag.ghost = ghost;
  touchDrag.active = true;
  row.classList.add('is-dragging');
  navigator.vibrate?.(15);

  // フォルダの中で動かしているときは、1つ上へ出す場所を上に表示する
  const frame = currentFrame();
  if (frame.view === 'folder') {
    const parentId = getFolder(frame.folderId)?.parentId || null;
    const zone = document.createElement('div');
    zone.className = 'drop-up-zone';
    zone.dataset.dropFid = parentId || '';
    zone.textContent = `↑ ${parentId ? getFolder(parentId)?.name : 'ホーム'} へ移動`;
    document.body.appendChild(zone);
    touchDrag.upZone = zone;
  }
  touchDragMove(x, y);
}

function touchDragMove(x, y) {
  const d = touchDrag;
  d.ghost.style.transform = `translate(${x + 12}px, ${y - 28}px)`;
  const hit = document.elementFromPoint(x, y);
  let over = hit?.closest('.drop-up-zone') || hit?.closest('.list-row[data-drop-fid]') || null;
  if (over && over === d.row) over = null;
  if (over !== d.over) {
    d.over?.classList.remove('is-drop-over');
    over?.classList.add('is-drop-over');
    d.over = over;
  }
  // 画面の端では一覧をスクロールする
  const list = document.querySelector('.app-main .content');
  if (list) {
    const r = list.getBoundingClientRect();
    if (y < r.top + 48) list.scrollTop -= 8;
    else if (y > r.bottom - 48) list.scrollTop += 8;
  }
}

function touchDragEnd(commit) {
  const d = touchDrag;
  touchDrag = null;
  if (!d) return;
  clearTimeout(d.timer);
  if (!d.active) return;
  d.ghost.remove();
  d.upZone?.remove();
  d.row.classList.remove('is-dragging');
  d.over?.classList.remove('is-drop-over');
  // 指を離した直後の click で画面が開かないようにする
  suppressClickUntil = Date.now() + 400;
  if (commit && d.over) moveItem(d.item, d.over.dataset.dropFid || null);
}

let suppressClickUntil = 0;
document.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); }
}, true);

document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || touchDrag) return;
  const row = e.target.closest('.list-row[data-drag-id]');
  if (!row || e.target.closest('.list-item-opts')) return;
  const t = e.touches[0];
  touchDrag = {
    row, x: t.clientX, y: t.clientY, active: false,
    item: { type: row.dataset.dragType, id: row.dataset.dragId },
    timer: setTimeout(() => touchDragStart(row, t.clientX, t.clientY), TOUCH_HOLD_MS),
  };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!touchDrag) return;
  const t = e.touches[0];
  if (touchDrag.active) {
    e.preventDefault();  // ドラッグ中は画面をスクロールさせない
    touchDragMove(t.clientX, t.clientY);
  } else if (Math.hypot(t.clientX - touchDrag.x, t.clientY - touchDrag.y) > TOUCH_SLOP_PX) {
    touchDragEnd(false);
  }
}, { passive: false });

document.addEventListener('touchend', () => touchDragEnd(true));
document.addEventListener('touchcancel', () => touchDragEnd(false));
// 長押しで出る画像・文字のメニューを止める
document.addEventListener('contextmenu', e => { if (touchDrag) e.preventDefault(); });

// ============================================================
// SIDEBAR: 幅のドラッグリサイズ
// ============================================================
document.addEventListener('mousedown', e => {
  if (!e.target.closest('#sidebar-resize-handle')) return;
  e.preventDefault();
  const handle = e.target.closest('#sidebar-resize-handle');
  handle.classList.add('is-active');
  const onMove = me => {
    sidebarRatio = Math.min(SIDEBAR_MAX_RATIO, Math.max(SIDEBAR_MIN_PX, me.clientX) / innerWidth);
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) sidebar.style.setProperty('--sidebar-width', `${sidebarRatio * 100}vw`);
  };
  const onUp = () => {
    handle.classList.remove('is-active');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    localStorage.setItem('shotlog_sidebar_ratio', String(sidebarRatio));
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

// ハンドルをダブルクリック：広げきった状態（初期の幅）に戻す
document.addEventListener('dblclick', e => {
  if (!e.target.closest('#sidebar-resize-handle')) return;
  sidebarRatio = SIDEBAR_MAX_RATIO;
  localStorage.removeItem('shotlog_sidebar_ratio');
  document.querySelector('.app-sidebar')?.style.setProperty('--sidebar-width', `${sidebarRatio * 100}vw`);
});

// ============================================================
// INIT
// ============================================================
resumeTimerIfNeeded();
render();

// 圏外でもアプリを開けるよう、画面のファイルを端末に保存しておく
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(e => console.error('[shotlog] sw failed', e));
}
