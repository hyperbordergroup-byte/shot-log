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

const DURATION_PRESETS_LONG = [30,60,90,120,150,180,210,240,270,300,600,900,1200,1800,2700,3600];
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
// STORAGE
// ============================================================
function loadData() {
  try {
    const raw = localStorage.getItem('shotlog_v1');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { version: 1, clients: [] };
}

function saveData() {
  localStorage.setItem('shotlog_v1', JSON.stringify(appData));
}

// ============================================================
// STATE
// ============================================================
let appData = loadData();

let navStack = [{ view: 'home' }];

let timerInterval = null;
let timerStartedAt = null;   // Date.now() when REC started
let timerBase = 0;           // initial seconds (for timecode mode)

// Temporary form state stored in memory
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
  const base = session.timecodeStart || 0;
  const offset = session.offset || 0;
  return log.startOffset + base + offset;
}

// ============================================================
// DATA HELPERS
// ============================================================
function getClient(id) { return appData.clients.find(c => c.id === id); }
function getProject(clientId, projectId) {
  return getClient(clientId)?.projects.find(p => p.id === projectId);
}
function getSession(clientId, projectId, sessionId) {
  return getProject(clientId, projectId)?.sessions.find(s => s.id === sessionId);
}

// 未分類（フォルダなし）の収録を格納する専用プロジェクト
function getInboxProject() {
  let inbox = appData.clients.find(c => c.id === '__inbox__');
  if (!inbox) {
    inbox = { id: '__inbox__', name: '未分類', createdAt: new Date().toISOString(),
      projects: [{ id: '__inbox__', name: '未分類', createdAt: new Date().toISOString(), sessions: [] }] };
    appData.clients.push(inbox);
    saveData();
  }
  return inbox.projects[0];
}
function getInboxSessions() {
  return appData.clients.find(c => c.id === '__inbox__')?.projects[0]?.sessions || [];
}
function getFolders() {
  return appData.clients.filter(c => c.id !== '__inbox__');
}
function getActiveSession() {
  const frame = navStack.find(f => f.sessionId);
  if (!frame) return null;
  return getSession(frame.clientId, frame.projectId, frame.sessionId);
}
function currentFrame() { return navStack[navStack.length - 1]; }

function nextVideoNumber(session) {
  const vids = session.logs.filter(l => l.type === 'video');
  return vids.length + 1;
}

// After adding a new log, auto-calculate prev log's duration if it was 'auto'
function resolveAutoDurations(session) {
  const logs = session.logs;
  for (let i = 0; i < logs.length - 1; i++) {
    if (logs[i].durationMode === 'auto' && logs[i].duration == null) {
      logs[i].duration = logs[i+1].startOffset - logs[i].startOffset;
    }
  }
}

function sessionSummary(session) {
  const logs = session.logs;
  let totalDur = 0;
  let videoDur = 0; let videoCount = 0;
  let workDur = 0;  let workCount = 0;
  let breakDur = 0; let breakCount = 0;
  let troubleCount = 0;

  logs.forEach(l => {
    const d = typeof l.duration === 'number' ? l.duration : 0;
    totalDur += d;
    if (l.type === 'video')   { videoDur += d; videoCount++; }
    if (l.type === 'work')    { workDur  += d; workCount++;  }
    if (l.type === 'break')   { breakDur += d; breakCount++; }
    if (l.type === 'trouble') { troubleCount++; }
  });

  return { totalDur, videoDur, videoCount, workDur, workCount, breakDur, breakCount, troubleCount };
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(frame) {
  navStack.push(frame);
  render();
}
function goBack() {
  if (navStack.length > 1) { navStack.pop(); render(); }
}
function goHome() {
  navStack = [{ view: 'home' }];
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
  div.querySelector('#dlg-ok').onclick = () => { div.remove(); onOk(); };
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
    const el = document.getElementById('timer-display');
    if (el) el.textContent = formatHMS(getElapsedSeconds());
    const clk = document.getElementById('timer-clock');
    if (clk) {
      const n = new Date();
      clk.textContent = String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0') + ':' + String(n.getSeconds()).padStart(2,'0');
    }
  }, 200);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resumeTimerIfNeeded() {
  // Called on app init - resume timer if a session was recording
  for (const c of appData.clients) {
    for (const p of c.projects) {
      for (const s of p.sessions) {
        if (s.status === 'recording') {
          // Restore timer
          timerStartedAt = s.startedAt;
          timerBase = s.timecodeStart || 0;
          timerInterval = setInterval(() => {
            const el = document.getElementById('timer-display');
            if (el) el.textContent = formatHMS(getElapsedSeconds());
            const clk = document.getElementById('timer-clock');
            if (clk) {
              const n = new Date();
              clk.textContent = String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0') + ':' + String(n.getSeconds()).padStart(2,'0');
            }
          }, 200);
          // Navigate to recording view
          if (c.id === '__inbox__') {
            navStack = [
              { view: 'home' },
              { view: 'recording', clientId: c.id, projectId: p.id, sessionId: s.id },
            ];
          } else {
            navStack = [
              { view: 'home' },
              { view: 'project-list', clientId: c.id },
              { view: 'session-list', clientId: c.id, projectId: p.id },
              { view: 'recording', clientId: c.id, projectId: p.id, sessionId: s.id },
            ];
          }
          return;
        }
      }
    }
  }
}

// ============================================================
// RENDER DISPATCHER
// ============================================================
function render() {
  const frame = currentFrame();
  const app = document.getElementById('app');
  closeSheet();

  switch (frame.view) {
    case 'home':          app.innerHTML = renderHome();         break;
    case 'project-list':  app.innerHTML = renderProjectList();  break;
    case 'session-list':  app.innerHTML = renderSessionList();  break;
    case 'session-setup': app.innerHTML = renderSessionSetup(); break;
    case 'recording':     app.innerHTML = renderRecording();    break;
    case 'session-review':app.innerHTML = renderSessionReview();break;
    case 'export':        app.innerHTML = renderExport();       break;
    default:              app.innerHTML = renderHome();
  }

  // Restart timer display after re-render
  if (frame.view === 'recording' && timerInterval) {
    const el = document.getElementById('timer-display');
    if (el) el.textContent = formatHMS(getElapsedSeconds());
  }
}

// ============================================================
// VIEW: HOME
// ============================================================
function renderHome() {
  const folders = getFolders();
  const inboxSessions = getInboxSessions();

  // 未分類セクション
  let inboxHtml = '';
  if (inboxSessions.length > 0) {
    const rows = inboxSessions.map(s => {
      const isRec = s.status === 'recording';
      const sum = sessionSummary(s);
      return `<div class="list-row">
        <button class="list-item" data-action="open-inbox-session" data-sid="${s.id}">
          <span class="list-item-icon" style="color:${isRec ? 'var(--danger)' : 'var(--text2)'}">${isRec ? icon('record', 16) : icon('file', 22)}</span>
          <span class="list-item-body">
            <span class="list-item-title">第${s.number}回収録${isRec ? ' <span style="color:var(--danger);font-size:12px">REC中</span>' : ''}</span>
            <span class="list-item-sub">${s.date}・${s.logs.length}件 動画${sum.videoCount}本</span>
          </span>
          <span class="list-item-chevron">›</span>
        </button>
        <button class="list-item-opts" data-action="session-options" data-cid="__inbox__" data-pid="__inbox__" data-sid="${s.id}">···</button>
      </div>`;
    }).join('');
    inboxHtml = `<div class="section-label">未分類</div><div class="list-group">${rows}</div>`;
  }

  // フォルダセクション
  let foldersHtml = '';
  if (folders.length === 0 && inboxSessions.length === 0) {
    foldersHtml = `<div class="empty-state">
      <div class="empty-state-icon" style="opacity:0.4">${icon('folder', 48)}</div>
      <div class="empty-state-text">上のボタンで収録を開始するか<br>フォルダを作成してください</div>
    </div>`;
  } else if (folders.length > 0) {
    foldersHtml = `<div class="section-label">フォルダ</div><div class="list-group">` +
      folders.map(c => {
        const pCount = c.projects.length;
        return `<div class="list-row">
          <button class="list-item" data-action="open-client" data-id="${c.id}">
            <span class="list-item-icon" style="color:var(--text2)">${icon('folder', 22)}</span>
            <span class="list-item-body">
              <span class="list-item-title">${esc(c.name)}</span>
              <span class="list-item-sub">フォルダ ${pCount}件</span>
            </span>
            <span class="list-item-chevron">›</span>
          </button>
          <button class="list-item-opts" data-action="folder-options" data-id="${c.id}">···</button>
        </div>`;
      }).join('') + `</div>`;
  }

  return `<div class="header">
    <span class="header-title" style="text-align:left;padding-left:8px">Shot Log</span>
  </div>
  <div class="content">
    <div style="padding:16px 16px 8px;display:flex;gap:10px">
      <button class="btn btn-primary" style="flex:1;width:auto" data-action="new-quick-session">新規収録</button>
      <button class="btn btn-secondary" style="flex:1;width:auto" data-action="add-client">＋ フォルダ</button>
    </div>
    ${inboxHtml}
    ${foldersHtml}
  </div>`;
}

// ============================================================
// VIEW: PROJECT LIST
// ============================================================
function renderProjectList() {
  const { clientId } = currentFrame();
  const client = getClient(clientId);
  if (!client) { goHome(); return ''; }

  const projects = client.projects;
  let listHtml = '';
  if (projects.length === 0) {
    listHtml = `<div class="empty-state">
      <div class="empty-state-icon" style="opacity:0.4">${icon('folder', 48)}</div>
      <div class="empty-state-text">フォルダがありません<br>上のボタンから追加してください</div>
    </div>`;
  } else {
    listHtml = `<div class="list-group">` +
      projects.map(p => {
        const sCount = p.sessions.length;
        return `<div class="list-row">
          <button class="list-item" data-action="open-project" data-cid="${clientId}" data-pid="${p.id}">
            <span class="list-item-icon" style="color:var(--text2)">${icon('folder', 22)}</span>
            <span class="list-item-body">
              <span class="list-item-title">${esc(p.name)}</span>
              <span class="list-item-sub">収録 ${sCount}回</span>
            </span>
            <span class="list-item-chevron">›</span>
          </button>
          <button class="list-item-opts" data-action="project-options" data-cid="${clientId}" data-pid="${p.id}">···</button>
        </div>`;
      }).join('') + `</div>`;
  }

  return `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">${esc(client.name)}</span>
    <span style="width:44px"></span>
  </div>
  <div class="content">
    <div style="padding:16px 16px 8px;display:flex;gap:10px">
      <button class="btn btn-primary" style="flex:1;width:auto" data-action="new-session-for-folder" data-cid="${clientId}">⏺ 新規収録</button>
      <button class="btn btn-secondary" style="flex:1;width:auto" data-action="add-project" data-cid="${clientId}">＋ フォルダ</button>
    </div>
    <div class="section-label">フォルダ</div>
    ${listHtml}
  </div>`;
}

// ============================================================
// VIEW: SESSION LIST
// ============================================================
function renderSessionList() {
  const { clientId, projectId } = currentFrame();
  const project = getProject(clientId, projectId);
  if (!project) { goBack(); return ''; }

  const sessions = [...project.sessions].reverse();
  let listHtml = '';
  if (sessions.length === 0) {
    listHtml = `<div class="empty-state">
      <div class="empty-state-icon" style="opacity:0.4">${icon('film', 48)}</div>
      <div class="empty-state-text">収録記録がありません<br>上のボタンから新しい収録を開始してください</div>
    </div>`;
  } else {
    listHtml = `<div class="list-group">` +
      sessions.map(s => {
        const isRec = s.status === 'recording';
        const summary = sessionSummary(s);
        return `<div class="list-row">
          <button class="list-item" data-action="open-session"
              data-cid="${clientId}" data-pid="${projectId}" data-sid="${s.id}">
            <span class="list-item-icon" style="color:${isRec ? 'var(--danger)' : 'var(--text2)'}">${isRec ? icon('record', 16) : icon('file', 22)}</span>
            <span class="list-item-body">
              <span class="list-item-title">第${s.number}回収録${isRec ? ' <span style="color:var(--danger);font-size:12px">REC中</span>' : ''}</span>
              <span class="list-item-sub">${s.date}・${s.logs.length}件 動画${summary.videoCount}本</span>
            </span>
            <span class="list-item-chevron">›</span>
          </button>
          <button class="list-item-opts" data-action="session-options" data-cid="${clientId}" data-pid="${projectId}" data-sid="${s.id}">···</button>
        </div>`;
      }).join('') + `</div>`;
  }

  const client = getClient(clientId);
  return `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">${esc(project.name)}</span>
    <span style="width:44px"></span>
  </div>
  <div class="content">
    <div style="padding:16px 16px 8px;display:flex;gap:10px">
      <button class="btn btn-primary" style="flex:1;width:auto" data-action="new-session"
        data-cid="${clientId}" data-pid="${projectId}">⏺ 新規収録</button>
      <button class="btn btn-secondary" style="flex:1;width:auto" data-action="add-project" data-cid="${clientId}">＋ フォルダ</button>
    </div>
    <div class="section-label">収録一覧</div>
    ${listHtml}
  </div>`;
}

// ============================================================
// VIEW: SESSION SETUP
// ============================================================
function renderSessionSetup() {
  const { clientId, projectId, isInbox } = currentFrame();
  const project = isInbox ? getInboxProject() : getProject(clientId, projectId);
  if (!project) { goBack(); return ''; }

  const nextNum = project.sessions.length + 1;
  const today = new Date().toISOString().slice(0,10);

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
      <button class="btn btn-rec" data-action="start-recording"
        data-cid="${isInbox ? '__inbox__' : clientId}" data-pid="${isInbox ? '__inbox__' : projectId}">
        REC 開始
      </button>
    </div>
  </div>`;
}

// ============================================================
// VIEW: RECORDING
// ============================================================
function renderRecording() {
  const { clientId, projectId, sessionId } = currentFrame();
  const session = getSession(clientId, projectId, sessionId);
  const project = getProject(clientId, projectId);
  if (!session) { goBack(); return ''; }

  const logs = session.logs;
  const logListHtml = logs.length === 0
    ? `<div class="empty-state" style="padding:32px 16px">
        <div class="empty-state-text">下のボタンをタップして記録を開始</div>
       </div>`
    : logs.map(l => renderLogRow(l, session)).join('');

  const elapsed = session.startedAt ? (Date.now() - session.startedAt) / 1000 + (session.timecodeStart||0) : (session.timecodeStart||0);

  return `<div class="recording-screen">
    <div class="header">
      <div class="rec-header-info">
        <div class="rec-header-name">${esc(project.name)} 第${session.number}回</div>
        <div class="rec-header-sub">${session.date}</div>
      </div>
      <button class="stop-btn" data-action="stop-recording"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">${icon('stop', 12)} STOP</button>
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
      <button class="rec-btn" data-type="video" data-action="tap-log"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('video', 26)}</span>
        <span class="rec-btn-label">動画</span>
      </button>
      <button class="rec-btn" data-type="work" data-action="tap-log"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('message', 26)}</span>
        <span class="rec-btn-label">ワーク</span>
      </button>
      <button class="rec-btn" data-type="break" data-action="tap-log"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('coffee', 26)}</span>
        <span class="rec-btn-label">休憩</span>
      </button>
      <button class="rec-btn" data-type="talk" data-action="tap-log"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('mic', 26)}</span>
        <span class="rec-btn-label">トーク</span>
      </button>
      <button class="rec-btn" data-type="trouble" data-action="tap-log"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('alertTriangle', 26)}</span>
        <span class="rec-btn-label">トラブル</span>
      </button>
      <button class="rec-btn" data-type="other" data-action="tap-log"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">
        <span class="rec-btn-emoji">${icon('list', 26)}</span>
        <span class="rec-btn-label">その他</span>
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
  const memo = log.memo ? `<div class="log-entry-memo">${esc(log.memo)}</div>` : '';
  const isTrouble = log.type === 'trouble';
  const isMissed = log.isMissed;

  return `<div class="log-entry ${isTrouble?'log-entry-trouble':''} ${isMissed?'log-entry-missed':''}"
      data-action="edit-log" data-log-id="${log.id}"
      data-cid="${session._clientId||''}" data-pid="${session._projectId||''}">
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
  const { clientId, projectId, sessionId } = currentFrame();
  const session = getSession(clientId, projectId, sessionId);
  const project = getProject(clientId, projectId);
  if (!session) { goBack(); return ''; }

  const sum = sessionSummary(session);

  const logsHtml = session.logs.length === 0
    ? `<div class="empty-state"><div class="empty-state-text">記録がありません</div></div>`
    : `<div class="list-group" style="margin-bottom:16px">` +
        session.logs.map(l => renderReviewEntry(l, session, clientId, projectId)).join('') +
      `</div>`;

  return `<div class="header">
    <button class="header-btn" data-action="back">‹</button>
    <span class="header-title">第${session.number}回収録</span>
    <button class="header-action" data-action="go-export"
      data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">出力</button>
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
      <button class="btn btn-secondary" style="color:var(--primary);border:1px solid var(--primary)"
        data-action="move-to-folder"
        data-sid="${sessionId}" data-src-cid="${clientId}" data-src-pid="${projectId}">
        📁 フォルダに移動
      </button>
      <button class="btn btn-secondary" data-action="add-missed-log"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">
        入力し忘れを追加
      </button>
      <button class="btn btn-secondary btn-sm" data-action="edit-offset"
        data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}"
        style="color:var(--text2)">
        オフセット補正 ${session.offset ? (session.offset>0?'+':'')+formatHMS(Math.abs(session.offset)) : '0:00:00'}
      </button>
    </div>
  </div>`;
}

function renderReviewEntry(log, session, clientId, projectId) {
  const t = LOG_TYPES[log.type] || LOG_TYPES.other;
  const displaySec = logDisplayTime(log, session);
  const typeLabel = log.type === 'video' ? `動画${log.videoNumber}` : t.label;
  const dur = log.durationMode === 'unknown' ? '不明'
            : log.durationMode === 'auto' && log.duration == null ? '自動計測'
            : formatDuration(log.duration);
  const isTrouble = log.type === 'trouble';

  return `<div class="review-log-entry ${isTrouble?'trouble-badge':''}"
      data-action="edit-log" data-log-id="${log.id}"
      data-cid="${clientId}" data-pid="${projectId}" data-sid="${session.id}">
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
  const { clientId, projectId, sessionId } = currentFrame();
  const session = getSession(clientId, projectId, sessionId);
  const project = getProject(clientId, projectId);
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
        <button class="btn btn-secondary btn-sm" data-action="download-csv"
          data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">↓ ダウンロード</button>
        <button class="btn btn-secondary btn-sm" data-action="copy-csv"
          data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">コピー</button>
      </div>
      <div class="export-preview">${esc(generateCSV(session, project))}</div>
    </div>

    <div class="form-group">
      <div class="form-label">テキスト</div>
      <div class="export-btn-row">
        <button class="btn btn-secondary btn-sm" data-action="download-txt"
          data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">↓ ダウンロード</button>
        <button class="btn btn-secondary btn-sm" data-action="copy-txt"
          data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">コピー</button>
      </div>
      <div class="export-preview">${esc(generateText(session, project))}</div>
    </div>

    <div class="form-group">
      <div class="form-label">JSONデータ（共有・バックアップ）</div>
      <div class="export-btn-row">
        <button class="btn btn-secondary btn-sm" data-action="download-json"
          data-cid="${clientId}" data-pid="${projectId}" data-sid="${sessionId}">↓ エクスポート</button>
        <button class="btn btn-secondary btn-sm" data-action="import-json">↑ インポート</button>
      </div>
    </div>

  </div>`;
}

// ============================================================
// EXPORT GENERATORS
// ============================================================
function generateCSV(session, project) {
  const header = ['✔', '開始', '終了', '所要時間', '項目', 'メモ', '備考'].join(',');
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
      note
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function generateText(session, project) {
  const sum = sessionSummary(session);
  const lines = [
    `【${project.name} 第${session.number}回収録】 ${session.date}`,
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
    const startSec = logDisplayTime(l, session);
    const typeLabel = l.type === 'video' ? `動画${l.videoNumber}` : t.label;
    const dur = l.durationMode === 'unknown' ? '不明'
              : l.durationMode === 'auto' && l.duration == null ? '自動'
              : formatDuration(l.duration);
    const memo = l.memo || l.filename || '';
    lines.push(`${formatHMS(startSec)} [${typeLabel}] ${dur} ${memo}${l.isMissed?' ※入力し忘れ':''}`);
  });

  return lines.join('\n');
}

// ============================================================
// LOG ENTRY FORMS (BOTTOM SHEET)
// ============================================================
function openLogForm(type, session, editLog = null, tapContext = null) {
  formState = {
    type,
    editLog,
    duration: editLog?.duration ?? null,
    durationMode: editLog?.durationMode ?? 'auto',
    memo: editLog?.memo ?? '',
    filename: editLog?.filename ?? '',
    troubleCategory: editLog?.troubleCategory ?? '',
    troubleSubcategory: editLog?.troubleSubcategory ?? '',
    photos: editLog?.photos ? [...editLog.photos] : [],
    startOffsetOverride: editLog?.startOffset ?? null,
    isMissed: editLog?.isMissed ?? false,
    videoNumber: editLog?.videoNumber ?? null,
  };
  if (tapContext) formState._tapContext = tapContext;

  const presets = type === 'break' ? DURATION_PRESETS_BREAK : DURATION_PRESETS_LONG;
  const t = LOG_TYPES[type] || LOG_TYPES.other;
  const isEdit = !!editLog;
  const title = isEdit ? `${t.label}を編集` : `${t.label}を記録`;

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

  const photoHtml = type === 'trouble' ? renderPhotoField(formState.photos) : '';

  const deleteHtml = isEdit ? `
    <button class="btn btn-danger btn-sm" style="margin-top:8px" data-action="delete-log" data-log-id="${editLog.id}">
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
  const isCustom = currentMode === 'custom';

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
      <label class="form-label">大まかな時間</label>
      <div class="timecode-input">
        <input type="number" id="missed-h" placeholder="0" min="0">
        <span class="sep">:</span>
        <input type="number" id="missed-m" placeholder="00" min="0" max="59">
        <span class="sep">:</span>
        <input type="number" id="missed-s" placeholder="00" min="0" max="59">
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

function openOffsetEdit(session, clientId, projectId) {
  const abs = Math.abs(session.offset || 0);
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
    <button class="btn btn-primary" data-action="save-offset"
      data-cid="${clientId}" data-pid="${projectId}" data-sid="${session.id}">保存</button>
  `);
}

// ============================================================
// ESCAPE HTML
// ============================================================
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// ACTION HANDLERS
// ============================================================
function handleAction(action, el) {
  const cid = el.dataset.cid;
  const pid = el.dataset.pid;
  const sid = el.dataset.sid;

  switch (action) {

    // Navigation
    case 'back': goBack(); break;

    case 'open-client':
      navigate({ view: 'project-list', clientId: el.dataset.id });
      break;

    case 'open-project':
      navigate({ view: 'session-list', clientId: cid, projectId: pid });
      break;

    case 'open-session': {
      const s = getSession(cid, pid, sid);
      if (s?.status === 'recording') {
        navigate({ view: 'recording', clientId: cid, projectId: pid, sessionId: sid });
      } else {
        navigate({ view: 'session-review', clientId: cid, projectId: pid, sessionId: sid });
      }
      break;
    }

    case 'new-session':
      navigate({ view: 'session-setup', clientId: cid, projectId: pid });
      break;

    case 'go-export':
      navigate({ view: 'export', clientId: cid, projectId: pid, sessionId: sid });
      break;

    // Add Client
    case 'add-client': {
      openSheet(`
        <div class="sheet-title">📁 フォルダを追加</div>
        <div class="form-group">
          <label class="form-label">フォルダ名</label>
          <input class="form-input" type="text" id="new-client-name" placeholder="例：企業名など" autofocus>
        </div>
        <button class="btn btn-primary" data-action="save-client">追加</button>
      `);
      setTimeout(() => document.getElementById('new-client-name')?.focus(), 300);
      break;
    }

    case 'save-client': {
      const name = document.getElementById('new-client-name')?.value.trim();
      if (!name) { showToast('名前を入力してください'); return; }
      const client = { id: uid(), name, createdAt: new Date().toISOString(), projects: [] };
      appData.clients.push(client);
      saveData();
      closeSheet();
      render();
      break;
    }

    // Add Project
    case 'add-project': {
      const _cid = el.dataset.cid;
      openSheet(`
        <div class="sheet-title">フォルダを追加</div>
        <div class="form-group">
          <label class="form-label">フォルダ名</label>
          <input class="form-input" type="text" id="new-project-name" placeholder="例：フォルダ名など" autofocus>
        </div>
        <button class="btn btn-primary" data-action="save-project" data-cid="${_cid}">追加</button>
      `);
      setTimeout(() => document.getElementById('new-project-name')?.focus(), 300);
      break;
    }

    case 'save-project': {
      const name = document.getElementById('new-project-name')?.value.trim();
      if (!name) { showToast('フォルダ名を入力してください'); return; }
      const c = getClient(el.dataset.cid);
      if (!c) return;
      c.projects.push({ id: uid(), name, createdAt: new Date().toISOString(), sessions: [] });
      saveData();
      closeSheet();
      render();
      break;
    }

    // Start Recording
    case 'start-recording': {
      const num = parseInt(document.getElementById('setup-num')?.value) || 1;
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
      const offSec = parseTimecode(
        document.getElementById('off-h')?.value,
        document.getElementById('off-m')?.value,
        document.getElementById('off-s')?.value
      );
      const offset = offSign * offSec;

      const project = cid === '__inbox__' ? getInboxProject() : getProject(cid, pid);
      if (!project) return;

      const session = {
        id: uid(),
        number: num,
        date,
        timeBase,
        timecodeStart,
        offset,
        startedAt: null,
        endedAt: null,
        status: 'recording',
        logs: [],
      };

      project.sessions.push(session);
      saveData();

      navStack.push({ view: 'recording', clientId: cid, projectId: pid, sessionId: session.id });
      render();
      startTimer(session);
      break;
    }

    // Stop Recording
    case 'stop-recording': {
      const session = getSession(cid, pid, sid);
      if (!session) return;

      showConfirm('収録を終了しますか？', '終了後は閲覧・編集モードに切り替わります。',
        () => {
          stopTimer();
          session.status = 'completed';
          session.endedAt = Date.now();
          resolveAutoDurations(session);
          saveData();
          navStack[navStack.length-1] = { view: 'session-review', clientId: cid, projectId: pid, sessionId: sid };
          render();
        }, '終了する', 'btn-danger'
      );
      break;
    }

    // Tap log button during recording
    case 'tap-log': {
      const type = el.dataset.type;
      const tapTime = Date.now();
      const session = getSession(cid, pid, sid);
      if (!session) return;

      const startOffset = (tapTime - session.startedAt) / 1000;
      const tapContext = { type, startOffset, clientId: cid, projectId: pid, sessionId: sid };
      openLogForm(type, session, null, tapContext);
      break;
    }

    // Save log from recording
    case 'save-log': {
      const ctx = formState._tapContext;
      if (!ctx) {
        // Edit mode
        saveEditedLog();
        return;
      }
      const { type, startOffset, clientId, projectId, sessionId } = ctx;
      const session = getSession(clientId, projectId, sessionId);
      if (!session) return;

      const log = buildLogFromForm(type, startOffset, false);
      if (!log) return;

      session.logs.push(log);
      resolveAutoDurations(session);
      saveData();

      closeSheet();
      // Refresh log list without full re-render
      const ll = document.getElementById('log-list');
      if (ll) {
        ll.innerHTML = session.logs.map(l => renderLogRow(l, session)).join('');
        ll.scrollTop = ll.scrollHeight;
      }
      showToast(`${LOG_TYPES[type].label}を記録しました`);
      break;
    }

    // Edit log (from review or recording)
    case 'edit-log': {
      const logId = el.dataset.logId;
      // Find session
      let foundSession = null, foundClientId = null, foundProjectId = null;
      const frame = currentFrame();
      if (frame.sessionId) {
        foundSession = getSession(frame.clientId, frame.projectId, frame.sessionId);
        foundClientId = frame.clientId;
        foundProjectId = frame.projectId;
      }
      if (!foundSession) break;
      const log = foundSession.logs.find(l => l.id === logId);
      if (!log) break;

      formState._editContext = { logId, clientId: foundClientId, projectId: foundProjectId, sessionId: frame.sessionId };
      openLogForm(log.type, foundSession, log);
      break;
    }

    case 'delete-log': {
      const logId = el.dataset.logId;
      const frame = currentFrame();
      const session = getSession(frame.clientId, frame.projectId, frame.sessionId);
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

    // Add missed log
    case 'add-missed-log': {
      const session = getSession(cid, pid, sid);
      if (!session) return;
      formState._editContext = { clientId: cid, projectId: pid, sessionId: sid };
      openMissedForm(session);
      break;
    }

    case 'save-missed-log': {
      const ctx = formState._editContext;
      const session = getSession(ctx.clientId, ctx.projectId, ctx.sessionId);
      if (!session) return;

      const h = document.getElementById('missed-h')?.value || 0;
      const m = document.getElementById('missed-m')?.value || 0;
      const s = document.getElementById('missed-s')?.value || 0;
      const startOffset = parseTimecode(h, m, s) - (session.timecodeStart||0) - (session.offset||0);
      const type = formState.selectedType || 'other';
      const memo = document.getElementById('f-memo')?.value.trim() || '';

      const log = {
        id: uid(),
        type,
        startOffset: Math.max(0, startOffset),
        duration: null,
        durationMode: 'unknown',
        videoNumber: type === 'video' ? nextVideoNumber(session) : null,
        filename: '',
        memo,
        troubleCategory: '', troubleSubcategory: '',
        photos: [],
        isMissed: true,
        createdAt: Date.now(),
      };

      session.logs.push(log);
      session.logs.sort((a,b) => a.startOffset - b.startOffset);
      // Re-number videos
      let vn = 1;
      session.logs.forEach(l => { if (l.type==='video') l.videoNumber = vn++; });
      saveData();
      closeSheet();
      render();
      showToast('入力し忘れを追加しました');
      break;
    }

    // Preset duration selection
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

    // Trouble category
    case 'select-trouble-cat': {
      const cat = el.dataset.cat;
      formState.troubleCategory = cat;
      formState.troubleSubcategory = '';
      document.querySelectorAll('.category-btn').forEach(b =>
        b.classList.toggle('selected', b.dataset.cat === cat)
      );
      const row = document.getElementById('sub-cat-row');
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

    // Missed type selection
    case 'missed-type': {
      const mtype = el.dataset.mtype;
      formState.selectedType = mtype;
      document.querySelectorAll('[data-action="missed-type"]').forEach(b =>
        b.classList.toggle('selected', b.dataset.mtype === mtype)
      );
      break;
    }

    // Remove photo
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

    // Offset edit
    case 'edit-offset': {
      const session = getSession(cid, pid, sid);
      if (!session) return;
      openOffsetEdit(session, cid, pid);
      break;
    }

    case 'save-offset': {
      const session = getSession(cid, pid, sid);
      if (!session) return;
      const sign = parseInt(document.getElementById('off-sign')?.value) || 1;
      const sec = parseTimecode(
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

    // Export
    case 'download-csv': {
      const session = getSession(cid, pid, sid);
      const project = getProject(cid, pid);
      downloadFile(generateCSV(session, project), `shotlog_${session.date}_${project.name}.csv`, 'text/csv');
      break;
    }
    case 'copy-csv': {
      const session = getSession(cid, pid, sid);
      const project = getProject(cid, pid);
      copyText(generateCSV(session, project));
      break;
    }
    case 'download-txt': {
      const session = getSession(cid, pid, sid);
      const project = getProject(cid, pid);
      downloadFile(generateText(session, project), `shotlog_${session.date}_${project.name}.txt`, 'text/plain');
      break;
    }
    case 'copy-txt': {
      const session = getSession(cid, pid, sid);
      const project = getProject(cid, pid);
      copyText(generateText(session, project));
      break;
    }
    case 'download-json': {
      const session = getSession(cid, pid, sid);
      const project = getProject(cid, pid);
      const client = getClient(cid);
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        client: { id: client.id, name: client.name },
        project: { id: project.id, name: project.name },
        session,
      };
      downloadFile(JSON.stringify(exportData, null, 2), `shotlog_export_${session.date}.json`, 'application/json');
      break;
    }
    case 'import-json': {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const data = JSON.parse(ev.target.result);
            handleImport(data);
          } catch { showToast('JSONの読み込みに失敗しました'); }
        };
        reader.readAsText(file);
      };
      input.click();
      break;
    }

    // Segment buttons for time base
    case 'time-base-change': break; // handled in input handler

    // 案件一覧画面から新規収録（案件が1つなら直接、複数ならシートで選択）
    case 'new-session-for-folder': {
      const folder = getClient(cid);
      if (!folder) return;
      const projects = folder.projects;
      if (projects.length === 0) {
        showToast('先に案件を追加してください');
      } else if (projects.length === 1) {
        navigate({ view: 'session-setup', clientId: cid, projectId: projects[0].id });
      } else {
        const rows = projects.map(p =>
          `<button class="list-item" style="border-radius:var(--r-sm)"
            data-action="new-session" data-cid="${cid}" data-pid="${p.id}">
            <span class="list-item-icon" style="color:var(--text2)">${icon('folder', 22)}</span>
            <span class="list-item-body">
              <span class="list-item-title">${esc(p.name)}</span>
            </span>
          </button>`
        ).join('');
        openSheet(`
          <div class="sheet-title">収録するフォルダを選択</div>
          <div class="list-group" style="margin:0">${rows}</div>
        `);
      }
      break;
    }

    // フォルダなしで即収録
    case 'new-quick-session':
      navigate({ view: 'session-setup', isInbox: true });
      break;

    // 未分類セッションを開く
    case 'open-inbox-session': {
      const inboxSid = el.dataset.sid;
      const s = getInboxSessions().find(s => s.id === inboxSid);
      if (!s) return;
      if (s.status === 'recording') {
        navigate({ view: 'recording', clientId: '__inbox__', projectId: '__inbox__', sessionId: inboxSid });
      } else {
        navigate({ view: 'session-review', clientId: '__inbox__', projectId: '__inbox__', sessionId: inboxSid });
      }
      break;
    }

    // フォルダに移動シートを開く
    case 'move-to-folder': {
      const moveSid = el.dataset.sid;
      const srcCid = el.dataset.srcCid;
      const srcPid = el.dataset.srcPid;
      const folders = getFolders();
      // 移動先候補：現在の案件を除外（inbox含む全フォルダ）
      const allDests = [
        // 未分類（inbox）を先頭に
        ...(srcCid !== '__inbox__' ? [{
          fId: '__inbox__', fName: '未分類', pId: '__inbox__', pName: '未分類'
        }] : []),
        // 通常フォルダ
        ...folders.flatMap(f => f.projects
          .filter(p => !(f.id === srcCid && p.id === srcPid))
          .map(p => ({ fId: f.id, fName: f.name, pId: p.id, pName: p.name }))
        )
      ];
      let optionsHtml = '';
      if (allDests.length === 0) {
        optionsHtml = `<p style="color:var(--text2);font-size:14px;padding:8px 0 16px">移動先がありません。新しいフォルダを作成してください。</p>`;
      } else {
        const rows = allDests.map(d =>
          `<button class="list-item" style="border-radius:var(--r-sm)"
            data-action="confirm-move-to-folder"
            data-cid="${d.fId}" data-pid="${d.pId}" data-sid="${moveSid}"
            data-src-cid="${srcCid}" data-src-pid="${srcPid}">
            <span class="list-item-icon" style="color:var(--text2)">${icon(d.fId === '__inbox__' ? 'file' : 'folder', 22)}</span>
            <span class="list-item-body">
              <span class="list-item-title">${esc(d.fName)}</span>
              ${d.fId !== '__inbox__' ? `<span class="list-item-sub">${esc(d.pName)}</span>` : ''}
            </span>
          </button>`
        ).join('');
        optionsHtml = `<div class="list-group" style="margin:0 0 12px">${rows}</div>`;
      }
      openSheet(`
        <div class="sheet-title">📁 フォルダに移動</div>
        ${optionsHtml}
        <button class="btn btn-secondary" data-action="create-folder-and-move"
          data-sid="${moveSid}" data-src-cid="${srcCid}" data-src-pid="${srcPid}">
          ＋ 新しいフォルダを作成して移動
        </button>
      `);
      break;
    }

    // 既存フォルダ・案件に移動を確定
    case 'confirm-move-to-folder': {
      const { cid: tCid, pid: tPid, sid: tSid } = el.dataset;
      const srcCid2 = el.dataset.srcCid;
      const srcPid2 = el.dataset.srcPid;
      // 移動元を動的に特定（inboxでも通常フォルダでも対応）
      const srcProject = srcCid2 === '__inbox__' ? getInboxProject() : getProject(srcCid2, srcPid2);
      if (!srcProject) return;
      const idx = srcProject.sessions.findIndex(s => s.id === tSid);
      if (idx === -1) return;
      const [movedSession] = srcProject.sessions.splice(idx, 1);
      // 移動先
      const targetProject = tCid === '__inbox__' ? getInboxProject() : getProject(tCid, tPid);
      if (!targetProject) return;
      targetProject.sessions.push(movedSession);
      saveData();
      closeSheet();
      // スタック深さを変えず現在フレームだけ更新（ページ遷移なし）
      const d = navStack.length;
      navStack[d - 1] = { view: 'session-review', clientId: tCid, projectId: tPid, sessionId: tSid };
      if (d >= 2) navStack[d - 2] = { view: 'session-list', clientId: tCid, projectId: tPid };
      if (d >= 3) navStack[d - 3] = { view: 'project-list', clientId: tCid };
      if (d >= 4) navStack[d - 4] = { view: 'home' };
      render();
      showToast('フォルダに移動しました');
      break;
    }

    // 新しいフォルダを作成して移動
    case 'create-folder-and-move': {
      const cfSid = el.dataset.sid;
      const cfSrcCid = el.dataset.srcCid;
      const cfSrcPid = el.dataset.srcPid;
      openSheet(`
        <div class="sheet-title">📁 新しいフォルダに移動</div>
        <div class="form-group">
          <label class="form-label">フォルダ名</label>
          <input class="form-input" type="text" id="new-folder-name" placeholder="例：企業名など">
        </div>
        <div class="form-group">
          <label class="form-label">案件名 <span style="font-weight:400;color:var(--text3);text-transform:none;letter-spacing:0">（任意）</span></label>
          <input class="form-input" type="text" id="new-project-name2" placeholder="例：案件名など（省略可）">
        </div>
        <button class="btn btn-primary" data-action="save-folder-and-move"
          data-sid="${cfSid}" data-src-cid="${cfSrcCid}" data-src-pid="${cfSrcPid}">作成して移動</button>
      `);
      break;
    }

    case 'save-folder-and-move': {
      const sfSid = el.dataset.sid;
      const sfSrcCid = el.dataset.srcCid;
      const sfSrcPid = el.dataset.srcPid;
      const folderName = document.getElementById('new-folder-name')?.value.trim();
      const projectName = document.getElementById('new-project-name2')?.value.trim() || folderName;
      if (!folderName) { showToast('フォルダ名を入力してください'); return; }

      const newFolder = { id: uid(), name: folderName, createdAt: new Date().toISOString(),
        projects: [{ id: uid(), name: projectName, createdAt: new Date().toISOString(), sessions: [] }] };
      appData.clients.push(newFolder);

      // 移動元を動的に特定
      const sfSrcProject = sfSrcCid === '__inbox__' ? getInboxProject() : getProject(sfSrcCid, sfSrcPid);
      if (!sfSrcProject) return;
      const idx = sfSrcProject.sessions.findIndex(s => s.id === sfSid);
      if (idx === -1) return;
      const [movedSession] = sfSrcProject.sessions.splice(idx, 1);
      newFolder.projects[0].sessions.push(movedSession);
      saveData();
      closeSheet();
      // スタック深さを変えず現在フレームだけ更新（ページ遷移なし）
      const sfD = navStack.length;
      const nfCid = newFolder.id, nfPid = newFolder.projects[0].id;
      navStack[sfD - 1] = { view: 'session-review', clientId: nfCid, projectId: nfPid, sessionId: sfSid };
      if (sfD >= 2) navStack[sfD - 2] = { view: 'session-list', clientId: nfCid, projectId: nfPid };
      if (sfD >= 3) navStack[sfD - 3] = { view: 'project-list', clientId: nfCid };
      if (sfD >= 4) navStack[sfD - 4] = { view: 'home' };
      render();
      showToast('フォルダに移動しました');
      break;
    }

    // フォルダ options
    case 'folder-options': {
      const fid = el.dataset.id;
      const folder = getClient(fid);
      if (!folder) return;
      openSheet(`
        <div class="sheet-title">${esc(folder.name)}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-secondary" data-action="rename-folder" data-id="${fid}">名前を変更</button>
          <button class="btn btn-secondary" style="color:var(--danger)" data-action="delete-folder" data-id="${fid}">削除</button>
        </div>
      `);
      break;
    }

    case 'rename-folder': {
      const fid = el.dataset.id;
      const folder = getClient(fid);
      if (!folder) return;
      openSheet(`
        <div class="sheet-title">フォルダ名を変更</div>
        <div class="form-group">
          <label class="form-label">フォルダ名</label>
          <input class="form-input" type="text" id="rename-folder-input" value="${esc(folder.name)}">
        </div>
        <button class="btn btn-primary" data-action="save-rename-folder" data-id="${fid}">保存</button>
      `);
      setTimeout(() => {
        const input = document.getElementById('rename-folder-input');
        if (input) { input.focus(); input.select(); }
      }, 300);
      break;
    }

    case 'save-rename-folder': {
      const fid = el.dataset.id;
      const folder = getClient(fid);
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
      const fid = el.dataset.id;
      const folder = getClient(fid);
      if (!folder) return;
      showConfirm(
        `「${folder.name}」を削除しますか？`,
        '中の案件・収録データもすべて削除されます。',
        () => {
          appData.clients = appData.clients.filter(c => c.id !== fid);
          saveData();
          closeSheet();
          render();
          showToast('削除しました');
        }
      );
      break;
    }

    // 案件 options
    case 'project-options': {
      const project = getProject(cid, pid);
      if (!project) return;
      openSheet(`
        <div class="sheet-title">${esc(project.name)}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-secondary" data-action="rename-project" data-cid="${cid}" data-pid="${pid}">名前を変更</button>
          <button class="btn btn-secondary" style="color:var(--danger)" data-action="delete-project" data-cid="${cid}" data-pid="${pid}">削除</button>
        </div>
      `);
      break;
    }

    case 'rename-project': {
      const project = getProject(cid, pid);
      if (!project) return;
      openSheet(`
        <div class="sheet-title">フォルダ名を変更</div>
        <div class="form-group">
          <label class="form-label">フォルダ名</label>
          <input class="form-input" type="text" id="rename-project-input" value="${esc(project.name)}">
        </div>
        <button class="btn btn-primary" data-action="save-rename-project" data-cid="${cid}" data-pid="${pid}">保存</button>
      `);
      setTimeout(() => {
        const input = document.getElementById('rename-project-input');
        if (input) { input.focus(); input.select(); }
      }, 300);
      break;
    }

    case 'save-rename-project': {
      const project = getProject(cid, pid);
      if (!project) return;
      const name = document.getElementById('rename-project-input')?.value.trim();
      if (!name) { showToast('名前を入力してください'); return; }
      project.name = name;
      saveData();
      closeSheet();
      render();
      showToast('名前を変更しました');
      break;
    }

    case 'delete-project': {
      const client = getClient(cid);
      const project = getProject(cid, pid);
      if (!client || !project) return;
      showConfirm(
        `「${project.name}」を削除しますか？`,
        '中の収録データもすべて削除されます。',
        () => {
          client.projects = client.projects.filter(p => p.id !== pid);
          saveData();
          closeSheet();
          render();
          showToast('削除しました');
        }
      );
      break;
    }

    // 収録 options
    case 'session-options': {
      const session = getSession(cid, pid, sid);
      if (!session) return;
      const isInboxSession = cid === '__inbox__';
      openSheet(`
        <div class="sheet-title">第${session.number}回収録</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${isInboxSession ? `<button class="btn btn-secondary" data-action="move-to-folder" data-sid="${sid}">📁 フォルダに移動</button>` : ''}
          <button class="btn btn-secondary" style="color:var(--danger)" data-action="delete-session" data-cid="${cid}" data-pid="${pid}" data-sid="${sid}">削除</button>
        </div>
      `);
      break;
    }

    case 'delete-session': {
      const project = getProject(cid, pid);
      const session = getSession(cid, pid, sid);
      if (!project || !session) return;
      showConfirm(
        `第${session.number}回収録を削除しますか？`,
        'この収録のすべてのログが削除されます。',
        () => {
          project.sessions = project.sessions.filter(s => s.id !== sid);
          saveData();
          closeSheet();
          goBack();
          showToast('削除しました');
        }
      );
      break;
    }

  }
}

function buildLogFromForm(type, startOffset, isMissed) {
  // Read duration from form
  let duration = formState.duration;
  let durationMode = formState.durationMode;

  // Check custom input
  const customMin = document.getElementById('custom-min');
  const customSec = document.getElementById('custom-sec');
  if (customMin && customSec) {
    const mVal = customMin.value.trim();
    const sVal = customSec.value.trim();
    if (mVal !== '' || sVal !== '') {
      const d = (parseInt(mVal)||0)*60 + (parseInt(sVal)||0);
      if (d > 0) {
        duration = d;
        durationMode = 'custom';
      }
    }
  }

  // For types that don't have duration
  if (type === 'talk' || type === 'trouble') {
    duration = null;
    durationMode = 'auto';
  }

  // Memo / filename
  const memo = document.getElementById('f-memo')?.value.trim() || '';
  const filename = document.getElementById('f-filename')?.value.trim() || '';

  // Trouble fields
  let troubleCategory = formState.troubleCategory;
  let troubleSubcategory = formState.troubleSubcategory;
  const equipDetail = document.getElementById('f-equipment-detail');
  if (equipDetail) troubleSubcategory = equipDetail.value.trim();

  const frame = currentFrame();
  const session = frame.sessionId ? getSession(frame.clientId, frame.projectId, frame.sessionId) : null;

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
    photos: [...formState.photos],
    isMissed,
    createdAt: Date.now(),
  };
}

function saveEditedLog() {
  const ctx = formState._editContext;
  if (!ctx) return;
  const session = getSession(ctx.clientId, ctx.projectId, ctx.sessionId);
  if (!session) return;
  const log = session.logs.find(l => l.id === ctx.logId);
  if (!log) return;

  // Duration
  let duration = formState.duration;
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
  if (log.type === 'talk' || log.type === 'trouble') { duration = null; durationMode = 'auto'; }

  log.duration = duration;
  log.durationMode = durationMode;
  log.memo = document.getElementById('f-memo')?.value.trim() || log.memo;
  log.filename = document.getElementById('f-filename')?.value.trim() || log.filename;
  log.troubleCategory = formState.troubleCategory || log.troubleCategory;
  const equipDetail = document.getElementById('f-equipment-detail');
  log.troubleSubcategory = equipDetail ? equipDetail.value.trim() : (formState.troubleSubcategory || log.troubleSubcategory);
  log.photos = [...formState.photos];

  saveData();
  closeSheet();
  render();
  showToast('変更を保存しました');
}

// ============================================================
// IMPORT
// ============================================================
function handleImport(data) {
  if (!data.session || !data.project || !data.client) {
    showToast('不正なデータ形式です'); return;
  }
  openSheet(`
    <div class="sheet-title">📥 インポート</div>
    <div style="margin-bottom:16px;color:var(--text2);font-size:14px">
      <b style="color:var(--text)">${esc(data.client.name)}</b> /
      <b style="color:var(--text)">${esc(data.project.name)}</b><br>
      第${data.session.number}回収録 (${data.session.date})<br>
      ${data.session.logs.length}件の記録
    </div>
    <div class="form-group">
      <label class="form-label">保存先</label>
      <select class="form-select" id="import-dest">
        <option value="new-client">新しいクライアントとして保存</option>
        ${appData.clients.map(c =>
          c.projects.map(p =>
            `<option value="${c.id}|${p.id}">${esc(c.name)} / ${esc(p.name)}</option>`
          ).join('')
        ).join('')}
      </select>
    </div>
    <button class="btn btn-primary" id="import-confirm-btn">インポート</button>
  `);

  document.getElementById('import-confirm-btn').onclick = () => {
    const dest = document.getElementById('import-dest')?.value;
    if (dest === 'new-client') {
      let client = appData.clients.find(c => c.name === data.client.name);
      if (!client) {
        client = { id: uid(), name: data.client.name, createdAt: new Date().toISOString(), projects: [] };
        appData.clients.push(client);
      }
      let project = client.projects.find(p => p.name === data.project.name);
      if (!project) {
        project = { id: uid(), name: data.project.name, createdAt: new Date().toISOString(), sessions: [] };
        client.projects.push(project);
      }
      const session = { ...data.session, id: uid() };
      project.sessions.push(session);
    } else {
      const [cid, pid] = dest.split('|');
      const project = getProject(cid, pid);
      if (project) {
        const session = { ...data.session, id: uid() };
        project.sessions.push(session);
      }
    }
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
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
  // Show/hide timecode row
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
  // Only close if not recording (prevent accidental dismiss)
  const frame = currentFrame();
  if (frame.view !== 'recording') closeSheet();
  else closeSheet();
});

// ============================================================
// INIT
// ============================================================
resumeTimerIfNeeded();
render();
