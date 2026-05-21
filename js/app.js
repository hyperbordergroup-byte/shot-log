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

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// ============================================================
// STATE
// ============================================================
let appData = loadData();

let navStack = [{ view: 'home' }];

let timerInterval  = null;
let timerStartedAt = null;
let timerBase      = 0;

let formState = {};

// ============================================================
// UUID
// ============================================================
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

function parseTimecode(h, m, s) {
  return (parseInt(h)||0)*3600 + (parseInt(m)||0)*60 + (parseInt(s)||0);
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
function getSessionById(id)     { return appData.sessions.find(s => s.id === id); }
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

function currentFrame() { return navStack[navStack.length - 1]; }

function nextVideoNumber(session) {
  return session.logs.filter(l => l.type === 'video').length + 1;
}

function resolveAutoDurations(session) {
  const logs = session.logs;
  for (let i = 0; i < logs.length - 1; i++) {
    if (logs[i].durationMode === 'auto' && logs[i].duration == null) {
      logs[i].duration = logs[i+1].startOffset - logs[i].startOffset;
    }
  }
}

function sessionSummary(session) {
  let totalDur=0, videoDur=0, videoCount=0, workDur=0, workCount=0,
      breakDur=0, breakCount=0, troubleCount=0;
  session.logs.forEach(l => {
    const d = typeof l.duration === 'number' ? l.duration : 0;
    totalDur += d;
    if (l.type==='video')   { videoDur+=d; videoCount++; }
    if (l.type==='work')    { workDur+=d;  workCount++;  }
    if (l.type==='break')   { breakDur+=d; breakCount++; }
    if (l.type==='trouble') { troubleCount++; }
  });
  return { totalDur, videoDur, videoCount, workDur, workCount, breakDur, breakCount, troubleCount };
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(frame) { navStack.push(frame); render(); }
function goBack()        { if (navStack.length > 1) { navStack.pop(); render(); } }
function goHome()        { navStack = [{ view: 'home' }]; render(); }

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
  document.getElementById('sheet-body').innerHTML = html;
  document.getElementById('bottom-sheet').classList.add('open');
  document.getElementById('overlay').classList.add('visible');
}
function closeSheet() {
  document.getElementById('bottom-sheet').classList.remove('open');
  document.getElementById('overlay').classList.remove('visible');
  formState = {};
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
    if (clk) {
      const n = new Date();
      clk.textContent = String(n.getHours()).padStart(2,'0') + ':' +
                        String(n.getMinutes()).padStart(2,'0') + ':' +
                        String(n.getSeconds()).padStart(2,'0');
    }
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
        if (clk) {
          const n = new Date();
          clk.textContent = String(n.getHours()).padStart(2,'0') + ':' +
                            String(n.getMinutes()).padStart(2,'0') + ':' +
                            String(n.getSeconds()).padStart(2,'0');
        }
      }, 200);
      navStack = [{ view: 'home' }, { view: 'recording', sessionId: s.id }];
      return;
    }
  }
}

// ============================================================
// RENDER DISPATCHER
// ============================================================
function render() {
  const frame = currentFrame();
  const app   = document.getElementById('app');
  closeSheet();

  switch (frame.view) {
    case 'home':           app.innerHTML = renderHome();                    break;
    case 'folder':         app.innerHTML = renderFolder(frame.folderId);   break;
    case 'session-setup':  app.innerHTML = renderSessionSetup();            break;
    case 'recording':      app.innerHTML = renderRecording();               break;
    case 'session-review': app.innerHTML = renderSessionReview();           break;
    case 'export':         app.innerHTML = renderExport();                  break;
    default:               app.innerHTML = renderHome();
  }

  if (frame.view === 'recording' && timerInterval) {
    const el = document.getElementById('timer-display');
    if (el) el.textContent = formatHMS(getElapsedSeconds());
  }
}

// ============================================================
// SHARED ROW RENDERERS
// ============================================================
function renderFolderRow(folder) {
  const childCount   = getChildFolders(folder.id).length;
  const sessionCount = getSessionsInFolder(folder.id).length;
  const sub = [
    childCount   > 0 ? `フォルダ ${childCount}件`  : '',
    sessionCount > 0 ? `収録 ${sessionCount}回` : '',
  ].filter(Boolean).join('・') || '空';

  return `<div class="list-row">
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

function renderSessionRow(session) {
  const isRec = session.status === 'recording';
  const sum   = sessionSummary(session);
  return `<div class="list-row">
    <button class="list-item" data-action="open-session" data-sid="${session.id}">
      <span class="list-item-icon" style="color:${isRec ? 'var(--danger)' : 'var(--text2)'}">${isRec ? icon('record', 16) : icon('file', 22)}</span>
      <span class="list-item-body">
        <span class="list-item-title">${esc(session.name || `第${session.number}回収録`)}${isRec ? ' <span style="color:var(--danger);font-size:12px">REC中</span>' : ''}</span>
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
function renderHome() {
  const folders  = getTopLevelFolders();
  const unfiled  = getUnfiledSessions();

  let unfiledHtml = '';
  if (unfiled.length > 0) {
    const rows = [...unfiled].reverse().map(s => renderSessionRow(s)).join('');
    unfiledHtml = `<div class="section-label">未分類</div><div class="list-group">${rows}</div>`;
  }

  let foldersHtml = '';
  if (folders.length === 0 && unfiled.length === 0) {
    foldersHtml = `<div class="empty-state">
      <div class="empty-state-icon" style="opacity:0.4">${icon('folder', 48)}</div>
      <div class="empty-state-text">上のボタンで収録を開始するか<br>フォルダを作成してください</div>
    </div>`;
  } else if (folders.length > 0) {
    foldersHtml = `<div class="section-label">フォルダ</div>
      <div class="list-group">${folders.map(f => renderFolderRow(f)).join('')}</div>`;
  }

  return `<div class="header">
    <span class="header-title" style="text-align:left;padding-left:8px">Shot Log</span>
  </div>
  <div class="content">
    <div style="padding:16px 16px 8px;display:flex;gap:10px">
      <button class="btn btn-primary" style="flex:1;width:auto" data-action="new-quick-session">新規収録</button>
      <button class="btn btn-secondary" style="flex:1;width:auto" data-action="add-folder">＋ フォルダ</button>
    </div>
    ${unfiledHtml}
    ${foldersHtml}
  </div>`;
}

// ============================================================
// VIEW: FOLDER (any depth)
// ============================================================
function renderFolder(folderId) {
  const folder = getFolder(folderId);
  if (!folder) { goHome(); return ''; }

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
  }

  return `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">${esc(folder.name)}</span>
    <span style="width:44px"></span>
  </div>
  <div class="content">
    <div style="padding:16px 16px 8px;display:flex;gap:10px">
      <button class="btn btn-primary" style="flex:1;width:auto"
        data-action="new-session-in-folder" data-fid="${folderId}">新規収録</button>
      <button class="btn btn-secondary" style="flex:1;width:auto"
        data-action="add-subfolder" data-parent-fid="${folderId}">＋ フォルダ</button>
    </div>
    ${content}
  </div>`;
}

// ============================================================
// VIEW: SESSION SETUP
// ============================================================
function renderSessionSetup() {
  const { folderId } = currentFrame();
  const sessionsHere = folderId ? getSessionsInFolder(folderId) : getUnfiledSessions();
  const nextNum = sessionsHere.length + 1;
  const today   = new Date().toISOString().slice(0,10);
  const fidAttr = folderId ? `data-fid="${folderId}"` : '';

  return `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">収録設定</span>
    <span style="width:44px"></span>
  </div>
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
        <div class="timecode-input">
          <input type="number" id="tc-h" placeholder="00" min="0" max="99">
          <span class="sep">:</span>
          <input type="number" id="tc-m" placeholder="00" min="0" max="59">
          <span class="sep">:</span>
          <input type="number" id="tc-s" placeholder="00" min="0" max="59">
        </div>
      </div>
    </div>

    <div class="setup-section">
      <div class="setup-section-title">オフセット補正（後から調整可）</div>
      <div style="display:flex;align-items:center;gap:8px">
        <select class="form-select" id="offset-sign" style="width:72px;flex-shrink:0">
          <option value="1">＋</option>
          <option value="-1">－</option>
        </select>
        <div class="timecode-input timecode-sm" style="flex:1">
          <input type="number" id="off-h" placeholder="00" min="0" max="99">
          <span class="sep">:</span>
          <input type="number" id="off-m" placeholder="00" min="0" max="59">
          <span class="sep">:</span>
          <input type="number" id="off-s" placeholder="00" min="0" max="59">
        </div>
      </div>
    </div>

    <div style="margin:0 16px 32px">
      <button class="btn btn-rec" data-action="start-recording" ${fidAttr}>REC 開始</button>
    </div>
  </div>`;
}

// ============================================================
// VIEW: RECORDING
// ============================================================
function renderRecording() {
  const { sessionId } = currentFrame();
  const session = getSessionById(sessionId);
  if (!session) { goBack(); return ''; }

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

  return `<div class="recording-screen">
    <div class="header">
      <div class="rec-header-info">
        <div class="rec-header-name">${esc(folderName)} 第${session.number}回</div>
        <div class="rec-header-sub">${esc(session.date)}</div>
      </div>
      <button class="stop-btn" data-action="stop-recording" data-sid="${sessionId}">${icon('stop', 12)} STOP</button>
    </div>

    <div class="timer-area">
      <div class="timer-clock" id="timer-clock"></div>
      <div class="timer-display recording" id="timer-display">${formatHMS(elapsed)}</div>
      <div class="timer-session-info"><span class="rec-dot"></span>REC</div>
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
  </div>`;
}

function renderLogRow(log, session) {
  const t = LOG_TYPES[log.type] || LOG_TYPES.other;
  const displaySec = logDisplayTime(log, session);
  const dur = log.durationMode === 'auto' && log.duration == null
    ? '<span style="color:var(--text3)">自動</span>'
    : `<span>${formatDuration(log.durationMode === 'unknown' ? 'unknown' : log.duration)}</span>`;

  const typeLabel = log.type === 'video' ? `動画${log.videoNumber}` : t.label;
  const memo    = log.memo ? `<div class="log-entry-memo">${esc(log.memo)}</div>` : '';
  const isTrouble = log.type === 'trouble';
  const isMissed  = log.isMissed;

  return `<div class="log-entry ${isTrouble?'log-entry-trouble':''} ${isMissed?'log-entry-missed':''}"
      data-action="edit-log" data-log-id="${log.id}" data-sid="${session.id}">
    <div class="log-type-dot" style="background:${t.color}"></div>
    <div class="log-entry-body">
      <div class="log-entry-header">
        <span class="log-entry-type" style="color:${t.color}">${typeLabel}</span>
        <span class="log-entry-time">${formatHMS(displaySec)}</span>
        ${dur}
      </div>
      ${memo}
    </div>
  </div>`;
}

// ============================================================
// VIEW: SESSION REVIEW
// ============================================================
function renderSessionReview() {
  const { sessionId } = currentFrame();
  const session = getSessionById(sessionId);
  if (!session) { goBack(); return ''; }

  const sum = sessionSummary(session);

  const logsHtml = session.logs.length === 0
    ? `<div class="empty-state"><div class="empty-state-text">記録がありません</div></div>`
    : `<div class="list-group" style="margin-bottom:16px">` +
        session.logs.map(l => renderReviewEntry(l, session)).join('') +
      `</div>`;

  return `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">${esc(session.name || `第${session.number}回収録`)}</span>
    <button class="header-action" data-action="go-export" data-sid="${sessionId}">出力</button>
  </div>
  <div class="content">

    <div class="summary-card">
      <div class="summary-title">収録サマリー</div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-item-label">総収録時間</div>
          <div class="summary-item-value" style="font-size:16px">${formatHMS(sum.totalDur)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item-label">動画</div>
          <div class="summary-item-value">${sum.videoCount}<span style="font-size:14px;font-weight:400;color:var(--text2)">本</span></div>
          <div class="summary-item-sub">${formatDuration(sum.videoDur)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item-label">ワーク</div>
          <div class="summary-item-value">${sum.workCount}<span style="font-size:14px;font-weight:400;color:var(--text2)">回</span></div>
          <div class="summary-item-sub">${formatDuration(sum.workDur)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item-label">休憩</div>
          <div class="summary-item-value">${sum.breakCount}<span style="font-size:14px;font-weight:400;color:var(--text2)">回</span></div>
          <div class="summary-item-sub">${formatDuration(sum.breakDur)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item-label">トラブル</div>
          <div class="summary-item-value" style="color:${sum.troubleCount>0?'var(--danger)':'inherit'}">${sum.troubleCount}<span style="font-size:14px;font-weight:400;color:var(--text2)">件</span></div>
        </div>
      </div>
    </div>

    <div class="section-label">タイムライン</div>
    ${logsHtml}

    <div style="padding:0 16px 16px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-secondary" data-action="add-missed-log" data-sid="${sessionId}">
        入力し忘れを追加
      </button>
      <button class="btn btn-secondary btn-sm" data-action="edit-offset" data-sid="${sessionId}"
        style="color:var(--text2)">
        オフセット補正 ${session.offset ? (session.offset>0?'+':'')+formatHMS(Math.abs(session.offset)) : '0:00:00'}
      </button>
    </div>
  </div>`;
}

function renderReviewEntry(log, session) {
  const t = LOG_TYPES[log.type] || LOG_TYPES.other;
  const displaySec = logDisplayTime(log, session);
  const typeLabel  = log.type === 'video' ? `動画${log.videoNumber}` : t.label;
  const dur = log.durationMode === 'unknown'                           ? '不明'
            : log.durationMode === 'auto' && log.duration == null      ? '自動計測'
            : formatDuration(log.duration);
  const isTrouble = log.type === 'trouble';

  return `<div class="review-log-entry ${isTrouble?'trouble-badge':''}"
      data-action="edit-log" data-log-id="${log.id}" data-sid="${session.id}">
    <div class="review-log-left">
      <div class="review-log-start">${formatHMS(displaySec)}</div>
      <div class="review-log-dur">${dur}</div>
    </div>
    <div class="review-log-body">
      <div class="review-log-type">
        <span style="color:${t.color}">${icon(t.icon, 18)}</span>
        <span style="color:${t.color}">${typeLabel}</span>
        ${log.isMissed ? '<span class="missed-flag">※忘れ</span>' : ''}
      </div>
      ${log.memo ? `<div class="review-log-memo">${esc(log.memo)}</div>` : ''}
      ${log.troubleCategory ? `<div class="review-log-memo" style="color:var(--danger)">${TROUBLE_CATEGORIES[log.troubleCategory]?.label||''} ${log.troubleSubcategory ? '／ '+log.troubleSubcategory : ''}</div>` : ''}
    </div>
    <span style="color:var(--text3);font-size:18px">›</span>
  </div>`;
}

// ============================================================
// VIEW: EXPORT
// ============================================================
function renderExport() {
  const { sessionId } = currentFrame();
  const session = getSessionById(sessionId);
  if (!session) { goBack(); return ''; }

  return `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">出力</span>
    <span style="width:44px"></span>
  </div>
  <div class="content content-pad">

    <div class="form-group">
      <div class="form-label">CSV（スプレッドシート）</div>
      <div class="export-btn-row">
        <button class="btn btn-secondary btn-sm" data-action="download-csv" data-sid="${sessionId}">↓ ダウンロード</button>
        <button class="btn btn-secondary btn-sm" data-action="copy-csv" data-sid="${sessionId}">コピー</button>
      </div>
      <div class="export-preview">${esc(generateCSV(session))}</div>
    </div>

    <div class="form-group">
      <div class="form-label">テキスト</div>
      <div class="export-btn-row">
        <button class="btn btn-secondary btn-sm" data-action="download-txt" data-sid="${sessionId}">↓ ダウンロード</button>
        <button class="btn btn-secondary btn-sm" data-action="copy-txt" data-sid="${sessionId}">コピー</button>
      </div>
      <div class="export-preview">${esc(generateText(session))}</div>
    </div>

    <div class="form-group">
      <div class="form-label">JSONデータ（共有・バックアップ）</div>
      <div class="export-btn-row">
        <button class="btn btn-secondary btn-sm" data-action="download-json" data-sid="${sessionId}">↓ エクスポート</button>
        <button class="btn btn-secondary btn-sm" data-action="import-json">↑ インポート</button>
      </div>
    </div>

  </div>`;
}

// ============================================================
// EXPORT GENERATORS
// ============================================================
function sessionFolderName(session) {
  return session.folderId ? (getFolder(session.folderId)?.name || '未分類') : '未分類';
}

function generateCSV(session) {
  const header = ['✔','開始','終了','所要時間','項目','メモ','備考'].join(',');
  const rows = session.logs.map(l => {
    const t = LOG_TYPES[l.type] || LOG_TYPES.other;
    const startSec = logDisplayTime(l, session);
    const dur = l.durationMode === 'unknown' ? null
              : (l.durationMode === 'auto' && l.duration == null ? null : l.duration);
    const endSec = dur != null ? startSec + dur : null;
    const typeLabel = l.type === 'video' ? `動画 ${l.videoNumber}` : t.label;
    const note = l.isMissed ? '※入力し忘れ' : '';
    return [
      '□',
      formatHMS(startSec),
      endSec != null ? formatHMS(endSec) : '—',
      dur != null ? formatDuration(dur) : (l.durationMode === 'unknown' ? '不明' : '—'),
      typeLabel,
      `"${(l.memo||l.filename||'').replace(/"/g,'""')}"`,
      note,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function generateText(session) {
  const folderName = sessionFolderName(session);
  const sum = sessionSummary(session);
  const lines = [
    `【${folderName} 第${session.number}回収録】 ${session.date}`,
    '',
    `総収録時間: ${formatHMS(sum.totalDur)}`,
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
    const memo = l.memo || l.filename || '';
    lines.push(`${formatHMS(startSec)} [${typeLabel}] ${dur} ${memo}${l.isMissed?' ※入力し忘れ':''}`);
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
    durationMode:       editLog?.durationMode       ?? 'auto',
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
}

function renderDurationPicker(presets, currentMode, currentDuration) {
  const isUnknown = currentMode === 'unknown';
  const isCustom  = currentMode === 'custom';

  const presetBtns = presets.map(sec => {
    const selected = currentMode === 'preset' && currentDuration === sec ? 'selected' : '';
    return `<button class="preset-btn ${selected}" data-action="select-preset" data-sec="${sec}">
      ${formatDuration(sec)}
    </button>`;
  }).join('');

  const unknownBtn = `<button class="preset-btn unknown ${isUnknown?'selected':''}" data-action="select-unknown">
    不明
  </button>`;

  const customMin = isCustom ? Math.floor(currentDuration/60) : '';
  const customSec = isCustom ? currentDuration%60 : '';

  return `<div class="form-group">
    <label class="form-label">所要時間</label>
    <div class="preset-grid" id="preset-grid">
      ${presetBtns}
      ${unknownBtn}
    </div>
    <div class="custom-duration" style="margin-top:10px">
      <input type="number" id="custom-min" placeholder="0" min="0" max="999"
        value="${customMin}" class="${isCustom?'active':''}">
      <span>分</span>
      <input type="number" id="custom-sec" placeholder="00" min="0" max="59"
        value="${customSec}" class="${isCustom?'active':''}">
      <span>秒</span>
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
        style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer">✕</button>
    </div>`
  ).join('');
  return `<div class="form-group">
    <label class="form-label">写真（任意）</label>
    <div class="photo-row" id="photo-row">
      ${thumbs}
      <label class="photo-add-btn">
        📷<span style="font-size:11px">追加</span>
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
      <div class="timecode-input">
        <input type="number" id="missed-h" placeholder="0" min="0">
        <span class="sep">:</span>
        <input type="number" id="missed-m" placeholder="00" min="0" max="59">
        <span class="sep">:</span>
        <input type="number" id="missed-s" placeholder="00" min="0" max="59">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">所要時間（任意）</label>
      <div class="timecode-input">
        <input type="number" id="missed-dur-h" placeholder="0" min="0">
        <span class="sep">:</span>
        <input type="number" id="missed-dur-m" placeholder="00" min="0" max="59">
        <span class="sep">:</span>
        <input type="number" id="missed-dur-s" placeholder="00" min="0" max="59">
      </div>
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
}

function openOffsetEdit(session) {
  const abs  = Math.abs(session.offset || 0);
  const sign = (session.offset || 0) < 0 ? -1 : 1;
  const h = Math.floor(abs/3600);
  const m = Math.floor((abs%3600)/60);
  const s = abs%60;

  openSheet(`
    <div class="sheet-title">オフセット補正</div>
    <div class="form-group">
      <label class="form-label">全タイムスタンプをずらす量</label>
      <div style="display:flex;align-items:center;gap:8px">
        <select class="form-select" id="off-sign" style="width:72px;flex-shrink:0">
          <option value="1" ${sign===1?'selected':''}>＋</option>
          <option value="-1" ${sign===-1?'selected':''}>－</option>
        </select>
        <div class="timecode-input timecode-sm" style="flex:1">
          <input type="number" id="off-h2" value="${h}" placeholder="00" min="0">
          <span class="sep">:</span>
          <input type="number" id="off-m2" value="${m}" placeholder="00" min="0" max="59">
          <span class="sep">:</span>
          <input type="number" id="off-s2" value="${s}" placeholder="00" min="0" max="59">
        </div>
      </div>
    </div>
    <button class="btn btn-primary" data-action="save-offset" data-sid="${session.id}">保存</button>
  `);
}

// ============================================================
// ACTION HANDLERS
// ============================================================
function handleAction(action, el) {
  const sid = el.dataset.sid;
  const fid = el.dataset.fid;

  switch (action) {

    // ── Navigation ──────────────────────────────────────────
    case 'back': goBack(); break;

    case 'open-folder':
      navigate({ view: 'folder', folderId: fid });
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
        <div class="sheet-title">📁 フォルダを追加</div>
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
        <div class="sheet-title">📁 フォルダを追加</div>
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
      appData.folders.push({ id: uid(), name, parentId: parentFid, createdAt: new Date().toISOString() });
      saveData();
      closeSheet();
      render();
      break;
    }

    // ── Start session ────────────────────────────────────────
    case 'new-quick-session':
      navigate({ view: 'session-setup', folderId: null });
      break;

    case 'new-session-in-folder':
      navigate({ view: 'session-setup', folderId: fid });
      break;

    case 'start-recording': {
      const targetFid = el.dataset.fid || null;
      const num  = Math.max(1, parseInt(document.getElementById('setup-num')?.value) || 1);
      const date = document.getElementById('setup-date')?.value || new Date().toISOString().slice(0,10);

      const timeBaseActive = document.querySelector('#time-base-seg .segment-btn.active');
      const timeBase = timeBaseActive?.dataset.val || 'zero';

      let timecodeStart = 0;
      if (timeBase === 'timecode') {
        timecodeStart = parseTimecode(
          document.getElementById('tc-h')?.value,
          document.getElementById('tc-m')?.value,
          document.getElementById('tc-s')?.value
        );
      } else if (timeBase === 'realtime') {
        const now = new Date();
        timecodeStart = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
      }

      const offSign = parseInt(document.getElementById('offset-sign')?.value) || 1;
      const offSec  = parseTimecode(
        document.getElementById('off-h')?.value,
        document.getElementById('off-m')?.value,
        document.getElementById('off-s')?.value
      );
      const offset = offSign * offSec;

      const session = {
        id: uid(),
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

      appData.sessions.push(session);
      saveData();
      navStack.push({ view: 'recording', sessionId: session.id });
      render();
      startTimer(session);
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
          navStack[navStack.length-1] = { view: 'session-review', sessionId: sid };
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
      resolveAutoDurations(session);
      saveData();

      closeSheet();
      const ll = document.getElementById('log-list');
      if (ll) {
        ll.innerHTML = session.logs.map(l => renderLogRow(l, session)).join('');
        ll.scrollTop = ll.scrollHeight;
      }
      showToast(`${LOG_TYPES[type].label}を記録しました`);
      break;
    }

    case 'edit-log': {
      const logId   = el.dataset.logId;
      const session = getSessionById(sid);
      if (!session) break;
      const log = session.logs.find(l => l.id === logId);
      if (!log) break;
      formState._editContext = { logId, sessionId: sid };
      openLogForm(log.type, session, log);
      break;
    }

    case 'delete-log': {
      const logId   = el.dataset.logId;
      const session = getSessionById(sid);
      if (!session) return;
      showConfirm('この記録を削除しますか？', '削除すると元に戻せません。',
        () => {
          session.logs = session.logs.filter(l => l.id !== logId);
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

      const h  = document.getElementById('missed-h')?.value || 0;
      const m  = document.getElementById('missed-m')?.value || 0;
      const s  = document.getElementById('missed-s')?.value || 0;
      const startOffset = parseTimecode(h, m, s) - (session.timecodeStart||0) - (session.offset||0);
      const type = formState.selectedType || 'other';
      const memo = document.getElementById('f-memo')?.value.trim() || '';

      const dh = parseInt(document.getElementById('missed-dur-h')?.value) || 0;
      const dm = parseInt(document.getElementById('missed-dur-m')?.value) || 0;
      const ds = parseInt(document.getElementById('missed-dur-s')?.value) || 0;
      const durSec = dh*3600 + dm*60 + ds;

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
      let vn = 1;
      session.logs.forEach(l => { if (l.type==='video') l.videoNumber = vn++; });
      saveData();
      closeSheet();
      render();
      showToast('入力し忘れを追加しました');
      break;
    }

    // ── Duration preset ──────────────────────────────────────
    case 'select-preset': {
      const sec = parseInt(el.dataset.sec);
      formState.durationMode = 'preset';
      formState.duration = sec;
      document.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.toggle('selected', b.dataset.sec == sec && !b.classList.contains('unknown'));
      });
      document.querySelectorAll('.custom-duration input').forEach(i => i.classList.remove('active'));
      break;
    }

    case 'select-unknown': {
      formState.durationMode = 'unknown';
      formState.duration = null;
      document.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.toggle('selected', b.classList.contains('unknown'));
      });
      document.querySelectorAll('.custom-duration input').forEach(i => i.classList.remove('active'));
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
              style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer">✕</button>
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
      const sec  = parseTimecode(
        document.getElementById('off-h2')?.value,
        document.getElementById('off-m2')?.value,
        document.getElementById('off-s2')?.value
      );
      session.offset = sign * sec;
      saveData();
      closeSheet();
      render();
      showToast('オフセットを更新しました');
      break;
    }

    // ── Export ───────────────────────────────────────────────
    case 'download-csv': {
      const session = getSessionById(sid);
      downloadFile(generateCSV(session), `shotlog_${session.date}_${sessionFolderName(session)}.csv`, 'text/csv');
      break;
    }
    case 'copy-csv': {
      copyText(generateCSV(getSessionById(sid)));
      break;
    }
    case 'download-txt': {
      const session = getSessionById(sid);
      downloadFile(generateText(session), `shotlog_${session.date}_${sessionFolderName(session)}.txt`, 'text/plain');
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
          <button class="btn btn-secondary" data-action="move-folder" data-fid="${fid}">📁 移動</button>
          <button class="btn btn-secondary" data-action="rename-folder" data-fid="${fid}">名前を変更</button>
          <button class="btn btn-secondary" style="color:var(--danger)" data-action="delete-folder" data-fid="${fid}">削除する</button>
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
        <div class="sheet-title">📁 移動先を選択</div>
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
      closeSheet();
      render();
      showToast('名前を変更しました');
      break;
    }

    case 'delete-folder': {
      const folder = getFolder(fid);
      if (!folder) return;
      showConfirm(
        `「${folder.name}」を削除しますか？`,
        '中のフォルダ・収録データもすべて削除されます。',
        () => {
          const toDelete = new Set([fid, ...getFolderDescendants(fid)]);
          appData.folders  = appData.folders.filter(f => !toDelete.has(f.id));
          appData.sessions = appData.sessions.filter(s => !toDelete.has(s.folderId));
          saveData();
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
          <button class="btn btn-secondary" data-action="move-session" data-sid="${sid}">📁 移動</button>
          <button class="btn btn-secondary" data-action="rename-session" data-sid="${sid}">名前を変更</button>
          <button class="btn btn-secondary" style="color:var(--danger)" data-action="delete-session" data-sid="${sid}">削除する</button>
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
        <div class="sheet-title">📁 移動先を選択</div>
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
      closeSheet();
      render();
      showToast('名前を変更しました');
      break;
    }

    case 'delete-session': {
      const session = getSessionById(sid);
      if (!session) return;
      showConfirm(
        `第${session.number}回収録を削除しますか？`,
        'この収録のすべてのログが削除されます。',
        () => {
          appData.sessions = appData.sessions.filter(s => s.id !== sid);
          saveData();
          goBack();
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

  const customMin = document.getElementById('custom-min');
  const customSec = document.getElementById('custom-sec');
  if (customMin && customSec) {
    const mVal = customMin.value.trim();
    const sVal = customSec.value.trim();
    if (mVal !== '' || sVal !== '') {
      const d = (parseInt(mVal)||0)*60 + (parseInt(sVal)||0);
      if (d > 0) { duration = d; durationMode = 'custom'; }
    }
  }

  if (type === 'talk' || type === 'trouble') {
    duration = null; durationMode = 'auto';
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
  const customMin  = document.getElementById('custom-min');
  const customSec  = document.getElementById('custom-sec');
  if (customMin && customSec) {
    const mVal = customMin.value.trim();
    const sVal = customSec.value.trim();
    if (mVal !== '' || sVal !== '') {
      const d = (parseInt(mVal)||0)*60 + (parseInt(sVal)||0);
      if (d > 0) { duration = d; durationMode = 'custom'; }
    }
  }
  if (log.type === 'talk' || log.type === 'trouble') { duration = null; durationMode = 'auto'; }

  log.duration     = duration;
  log.durationMode = durationMode;
  log.memo         = document.getElementById('f-memo')?.value.trim()      || log.memo;
  log.filename     = document.getElementById('f-filename')?.value.trim()  || log.filename;
  log.troubleCategory = formState.troubleCategory || log.troubleCategory;
  const equipDetail   = document.getElementById('f-equipment-detail');
  log.troubleSubcategory = equipDetail
    ? equipDetail.value.trim()
    : (formState.troubleSubcategory || log.troubleSubcategory);
  log.photos = [...(formState.photos || [])];

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
    <div class="sheet-title">📥 インポート</div>
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

  document.getElementById('import-confirm-btn').onclick = () => {
    const destFid   = document.getElementById('import-dest')?.value || null;
    const newSession = { ...importSession, id: uid(), folderId: destFid || null };
    appData.sessions.push(newSession);
    saveData();
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

// Custom duration input
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'custom-min' || id === 'custom-sec') {
    formState.durationMode = 'custom';
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('custom-min')?.classList.add('active');
    document.getElementById('custom-sec')?.classList.add('active');
  }
});

// Photo input
document.addEventListener('change', e => {
  if (e.target.id === 'photo-input') {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        formState.photos = formState.photos || [];
        formState.photos.push(ev.target.result);
        const row = document.getElementById('photo-row');
        if (row) {
          const div = document.createElement('div');
          div.style.position = 'relative';
          const idx = formState.photos.length - 1;
          div.innerHTML = `<img class="photo-thumb" src="${ev.target.result}" alt="photo">
            <button data-action="remove-photo" data-index="${idx}"
              style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer">✕</button>`;
          const addBtn = row.querySelector('label');
          row.insertBefore(div, addBtn);
        }
      };
      reader.readAsDataURL(file);
    });
  }
});

// Close sheet on overlay tap
document.getElementById('overlay').addEventListener('click', () => {
  closeSheet();
});

// ============================================================
// INIT
// ============================================================
resumeTimerIfNeeded();
render();
