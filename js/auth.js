'use strict';

// ============================================================
// SHOT LOG — アカウント(ログイン・初回データ移行・プラン表示)
//
// ログイン方式: メールに届く6桁コードを入力する方式。
// マジックリンクだとメールのセキュリティスキャンに先読みされ
// 無効化されることがあるため採用しない(budget-cycleと同じ判断)。
//
// ここでは「ログインできる」「ログイン後に旧localStorageデータを
// 一度だけ自動移行する」「プラン状態を表示する」「収録開始のログイン
// 必須ゲート・Stripe Checkout起動」までを扱う。
// ============================================================
(function () {
  const isConfigured =
    window.SHOTLOG_SUPABASE_URL &&
    window.SHOTLOG_SUPABASE_ANON_KEY &&
    window.SHOTLOG_SUPABASE_URL.indexOf('YOUR-PROJECT-REF') === -1;

  const client = isConfigured
    ? window.supabase.createClient(window.SHOTLOG_SUPABASE_URL, window.SHOTLOG_SUPABASE_ANON_KEY)
    : null;

  const FUNCTIONS_URL = isConfigured
    ? window.SHOTLOG_SUPABASE_URL.replace('.supabase.co', '.supabase.co/functions/v1')
    : null;

  const MIGRATION_DONE_KEY = 'shotlog_migrated_v1';
  const OUTBOX_KEY = 'shotlog_outbox';
  const BILLING_KEY = 'shotlog_billing';
  const USER_KEY = 'shotlog_user';

  const state = {
    step: isConfigured ? 'loading' : 'unconfigured', // loading | unconfigured | email | code | account
    email: '',
    busy: false,
    message: '',
    session: null,
    billing: null,
    billingChecked: false, // プラン情報の取得を一度試したか(圏外で失敗しても再試行し続けない)
    offline: false,        // 直近の送信が通信エラーだったか
  };

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── セッション初期化 ─────────────────────────────────────
  // 圏外でトークンを更新できないときも、最後にログインしたユーザーのまま記録を続ける
  async function readSession() {
    const { data, error } = await client.auth.getSession();
    if (data.session) {
      try { localStorage.setItem(USER_KEY, JSON.stringify({ id: data.session.user.id, email: data.session.user.email })); } catch (e) {}
      return data.session;
    }
    if (error && !error.status) {
      try {
        const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        if (user) return state.session || { user };
      } catch (e) {}
    }
    return null;
  }

  async function refreshSession() {
    if (!client) return;
    state.session = await readSession();
    if (state.session) {
      await onLoggedIn();
    } else {
      state.step = 'email';
    }
  }

  async function onLoggedIn() {
    state.step = 'account';
    await migrateIfNeeded();
    await loadBillingStatus();
    await pullRemoteIntoLocal();
    handleCheckoutReturn();
  }

  // app.jsの読み込み完了をポーリングで待つ。ページ読み込み直後の
  // refreshSession()は、auth.jsがapp.jsより先に評価されるため、
  // ネットワークが速いと appData 等がまだ未定義な状態で呼ばれうる。
  function waitForAppReady(timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (typeof appData !== 'undefined' && typeof saveData === 'function' && typeof render === 'function') {
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 50);
        }
      })();
    });
  }

  // ── ログイン中は、サーバー側のフォルダ・収録・ログを正として
  //    ローカルデータを置き換える(複数端末で同じ内容を見られるように) ──
  async function pullRemoteIntoLocal() {
    await flushOutbox();
    if (outbox.length) return; // 未送信が残っている間は、サーバーの内容で上書きしない
    const remote = await pullAll();
    if (!remote || outbox.length) return;
    const ready = await waitForAppReady(5000);
    if (!ready) {
      console.error('[shotlog] pullRemoteIntoLocal: app.js not ready in time');
      return;
    }
    try {
      appData.folders = remote.folders;
      appData.sessions = [...remote.sessions, ...appData.sessions.filter((s) => s.localOnly)];
      saveData();
      // 入力中のシートを閉じて内容を消さないよう、開いている間は描き直さない
      if (!document.getElementById('bottom-sheet').classList.contains('open')) render();
    } catch (e) {
      console.error('[shotlog] pullRemoteIntoLocal failed', e);
    }
  }

  async function pullAll() {
    if (!client || !state.session) return null;
    const userId = state.session.user.id;
    const [foldersRes, sessionsRes, logsRes] = await Promise.all([
      client.from('folders').select('id, parent_id, name, created_at').eq('user_id', userId),
      client.from('sessions')
        .select('id, folder_id, number, recorded_on, name, time_base, timecode_start, offset_seconds, started_at, ended_at, status, created_at')
        .eq('user_id', userId),
      client.from('shot_logs')
        .select('id, session_id, type, start_offset_seconds, duration_seconds, duration_mode, video_number, filename, memo, trouble_category, trouble_subcategory, photos, is_missed, created_at')
        .eq('user_id', userId),
    ]);
    if (foldersRes.error || sessionsRes.error || logsRes.error) {
      console.error('[shotlog] pullAll failed', foldersRes.error || sessionsRes.error || logsRes.error);
      return null;
    }

    const logsBySession = {};
    (logsRes.data || []).forEach((l) => {
      if (!logsBySession[l.session_id]) logsBySession[l.session_id] = [];
      logsBySession[l.session_id].push({
        id: l.id,
        type: l.type,
        startOffset: Number(l.start_offset_seconds) || 0,
        duration: l.duration_seconds == null ? null : Number(l.duration_seconds),
        durationMode: l.duration_mode,
        videoNumber: l.video_number,
        filename: l.filename || '',
        memo: l.memo || '',
        troubleCategory: l.trouble_category || '',
        troubleSubcategory: l.trouble_subcategory || '',
        photos: l.photos || [],
        isMissed: !!l.is_missed,
        createdAt: l.created_at ? new Date(l.created_at).getTime() : Date.now(),
      });
    });

    // サーバーの返す順番は決まっていないので、作成順に並べる
    const byCreated = (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''));
    const folders = [...(foldersRes.data || [])].sort(byCreated).map((f) => ({
      id: f.id,
      parentId: f.parent_id || null,
      name: f.name,
      createdAt: f.created_at || new Date().toISOString(),
    }));

    const sessions = [...(sessionsRes.data || [])].sort(byCreated).map((s) => ({
      id: s.id,
      folderId: s.folder_id || null,
      number: s.number,
      date: s.recorded_on,
      name: s.name || '',
      timeBase: s.time_base,
      timecodeStart: Number(s.timecode_start) || 0,
      offset: Number(s.offset_seconds) || 0,
      startedAt: s.started_at ? new Date(s.started_at).getTime() : null,
      endedAt: s.ended_at ? new Date(s.ended_at).getTime() : null,
      status: s.status,
      logs: (logsBySession[s.id] || []).sort((a, b) => a.startOffset - b.startOffset),
      createdAt: s.created_at || new Date().toISOString(),
    }));

    return { folders, sessions };
  }

  // ── フォルダ・収録・ログの同期API(app.jsの各操作から呼ばれる) ──────
  // 未ログイン時は何もしない(ローカルのみで動作する)。
  async function createFolder(name, parentId) {
    if (!client || !state.session) return { data: null, error: 'not_logged_in' };
    const { data, error } = await client.rpc('create_folder', { p_name: name, p_parent_id: parentId || null });
    if (error) {
      console.error('[shotlog] createFolder failed', error);
      return { data: null, error: error.message || 'error' };
    }
    return { data: { id: data.id, name: data.name, parentId: data.parent_id || null }, error: null };
  }

  // ── 送信待ちの列 ────────────────────────────────────
  // 変更はまず端末に貯めて、順番にサーバーへ送る。圏外で失敗しても消さず、
  // つながったら続きから送る。通信エラー以外(権限など)は再送しても通らないので諦めて知らせる。
  let outbox = [];
  try { outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch (e) { outbox = []; }
  let flushing = false;

  function saveOutbox() {
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); } catch (e) { console.error('[shotlog] saveOutbox failed', e); }
  }
  function notifySync() {
    if (typeof updateSyncBadge === 'function') updateSyncBadge();
  }
  // Supabaseは通信エラーのとき code が空になる
  function isNetworkError(error) {
    return !!error && !error.code;
  }
  function enqueue(op) {
    if (!client || !state.session) return;
    outbox.push(op);
    saveOutbox();
    notifySync();
    flushOutbox();
  }
  function runOp(op) {
    if (op.k === 'update') return client.from(op.table).update(op.fields).eq('id', op.id);
    if (op.k === 'delete') return client.from(op.table).delete().eq('id', op.id);
    if (op.k === 'log') return client.from('shot_logs').upsert({ ...op.row, user_id: state.session.user.id });
    return runStartOp(op);
  }
  // 圏外で始めた収録をサーバーに登録する。サーバーの発行したIDへ置き換え、開始時刻は端末の時刻に合わせる
  async function runStartOp(op) {
    const { data, error } = await client.rpc('start_recording', op.params);
    if (error) return { error };
    remapSessionId(op.tempId, data.id);
    outbox.forEach((o) => {
      if (o.id === op.tempId) o.id = data.id;
      if (o.row && o.row.session_id === op.tempId) o.row.session_id = data.id;
    });
    const session = getSessionById(data.id);
    if (session && session.startedAt) {
      outbox.splice(1, 0, { k: 'update', table: 'sessions', id: data.id, fields: { started_at: new Date(session.startedAt).toISOString() } });
    }
    if (state.billing) {
      state.billing = { ...state.billing, free_recordings_used: data.free_recordings_used, purchased_recordings_remaining: data.purchased_recordings_remaining };
    }
    return { error: null };
  }
  // 送れなかった収録はこの端末だけに残す(関連する送信待ちも取り下げる)
  function dropStartOp(op) {
    const session = getSessionById(op.tempId);
    if (session) { session.localOnly = true; delete session.pendingStart; saveData(); }
    outbox = outbox.filter((o) => o === op || (o.id !== op.tempId && !(o.row && o.row.session_id === op.tempId)));
    showToast('回数の上限のため、この収録は端末にのみ保存されています');
  }
  async function flushOutbox() {
    if (flushing || !client || !state.session) return;
    flushing = true;
    try {
      while (outbox.length) {
        const op = outbox[0];
        const { error } = await runOp(op);
        if (error && isNetworkError(error)) {
          state.offline = true;
          break;
        }
        state.offline = false;
        if (error) {
          console.error('[shotlog] sync failed', op.k, op.table, error);
          if (op.k === 'start') dropStartOp(op);
          else showToast('送信できなかった変更がありました');
        }
        outbox.shift();
        saveOutbox();
        notifySync();
      }
    } finally {
      flushing = false;
      notifySync();
    }
  }
  window.addEventListener('online', flushOutbox);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) flushOutbox(); });
  setInterval(flushOutbox, 15000);

  function updateFolder(id, fields) { enqueue({ k: 'update', table: 'folders', id, fields }); }
  function deleteFolder(id) { enqueue({ k: 'delete', table: 'folders', id }); }
  function updateSession(id, fields) { enqueue({ k: 'update', table: 'sessions', id, fields }); }
  function deleteSession(id) { enqueue({ k: 'delete', table: 'sessions', id }); }
  function updateLog(id, fields) { enqueue({ k: 'update', table: 'shot_logs', id, fields }); }
  function deleteLog(id) { enqueue({ k: 'delete', table: 'shot_logs', id }); }
  function insertLog(log, sessionId) {
    enqueue({ k: 'log', row: {
      id: log.id,
      session_id: sessionId,
      type: log.type,
      start_offset_seconds: log.startOffset,
      duration_seconds: log.duration,
      duration_mode: log.durationMode,
      video_number: log.videoNumber,
      filename: log.filename || '',
      memo: log.memo || '',
      trouble_category: log.troubleCategory || '',
      trouble_subcategory: log.troubleSubcategory || '',
      photos: log.photos || [],
      is_missed: !!log.isMissed,
    } });
  }
  function queueStartRecording(tempId, params) { enqueue({ k: 'start', tempId, params }); }

  // ── Stripe Checkoutから戻ってきた直後の後処理 ─────────────────
  function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if (!status) return;
    history.replaceState(null, '', window.location.pathname);
    if (status === 'success' && typeof showToast === 'function') {
      showToast('お支払いが完了しました');
    }
  }

  // ── ログイン前ローカルデータの初回移行(1回限り・無言) ─────────
  async function migrateIfNeeded() {
    if (localStorage.getItem(MIGRATION_DONE_KEY) === '1') return;
    await waitForAppReady(5000);
    if (!localDataHasContent()) {
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
      return;
    }
    try {
      const payload = buildMigrationPayload();
      const { data, error } = await client.rpc('migrate_local_data', {
        p_folders: payload.folders,
        p_sessions: payload.sessions,
      });
      if (error) throw error;
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
      if (data && data.migrated && typeof showToast === 'function') {
        showToast(`過去の記録(フォルダ${data.folders}件・収録${data.sessions}件)を引き継ぎました`);
      }
    } catch (e) {
      // 移行に失敗してもログイン自体は継続する。次回ログイン時に再試行される。
      console.error('[shotlog] migration failed', e);
    }
  }

  function localDataHasContent() {
    try {
      return typeof appData !== 'undefined' && (appData.folders.length > 0 || appData.sessions.length > 0);
    } catch (e) {
      return false;
    }
  }

  function buildMigrationPayload() {
    return {
      folders: appData.folders.map((f) => ({ id: f.id, parentId: f.parentId || null, name: f.name })),
      sessions: appData.sessions.map((s) => ({
        id: s.id,
        folderId: s.folderId || null,
        number: s.number,
        date: s.date,
        name: s.name || '',
        timeBase: s.timeBase,
        timecodeStart: s.timecodeStart,
        offset: s.offset,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        logs: (s.logs || []).map((l) => ({
          type: l.type,
          startOffset: l.startOffset,
          duration: l.duration,
          durationMode: l.durationMode,
          videoNumber: l.videoNumber,
          filename: l.filename,
          memo: l.memo,
          troubleCategory: l.troubleCategory,
          troubleSubcategory: l.troubleSubcategory,
          photos: [], // 画像はDataURLで大きいため今回は移行対象外
          isMissed: l.isMissed,
        })),
      })),
    };
  }

  // ── プラン状態の取得 ───────────────────────────────────
  async function loadBillingStatus() {
    if (!client || !state.session) return;
    const { data, error } = await client
      .from('billing_accounts')
      .select('plan, free_recordings_used, purchased_recordings_remaining, subscription_status, current_period_end')
      .eq('user_id', state.session.user.id)
      .maybeSingle();
    state.billingChecked = true;
    if (error) {
      console.error('[shotlog] loadBillingStatus failed', error);
      // 圏外では前回のプラン情報を使う
      try { state.billing = state.billing || JSON.parse(localStorage.getItem(BILLING_KEY) || 'null'); } catch (e) {}
    } else {
      state.billing = data;
      try { localStorage.setItem(BILLING_KEY, JSON.stringify(data)); } catch (e) {}
    }
  }

  // ── ログイン操作 ───────────────────────────────────────
  async function sendCode() {
    const input = document.getElementById('account-email');
    const email = (input && input.value || '').trim();
    if (!email) return;
    state.email = email;
    state.busy = true;
    state.message = '';
    rerender();

    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    state.busy = false;
    if (error) {
      state.message = error.message;
    } else {
      state.step = 'code';
    }
    rerender();
  }

  async function verifyCode() {
    const input = document.getElementById('account-code');
    const code = (input && input.value || '').trim();
    if (code.length < 6) return;
    state.busy = true;
    state.message = '';
    rerender();

    const { error } = await client.auth.verifyOtp({ email: state.email, token: code, type: 'email' });
    if (error) {
      state.busy = false;
      state.message = 'コードが違うか、期限が切れています';
      rerender();
      return;
    }

    state.session = await readSession();
    await onLoggedIn();
    state.busy = false;
    rerender();
  }

  function logout() {
    if (!client) return;
    if (outbox.length) {
      showConfirm('未送信の記録があります', `${outbox.length}件の変更がまだ送信されていません。ログアウトすると失われます。`, doLogout, 'ログアウト');
      return;
    }
    doLogout();
  }

  async function doLogout() {
    await client.auth.signOut();
    state.session = null;
    state.billing = null;
    state.billingChecked = false;
    state.step = 'email';
    state.email = '';
    state.message = '';
    outbox = [];
    saveOutbox();
    [BILLING_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k));
    // 共有の端末で次の人に案件名が見えないよう、手元のデータも消す
    clearLocalData();
    rerender();
  }

  function backToEmail() {
    state.step = 'email';
    state.message = '';
    rerender();
  }

  function rerender() {
    if (typeof currentFrame === 'function' && currentFrame().view === 'account' && typeof render === 'function') {
      render();
    }
  }

  // ── 描画 ──────────────────────────────────────────────
  function renderAccountView() {
    if (state.step === 'loading') {
      refreshSession().then(rerender);
      return accountShell('<div class="empty-state"><div class="empty-state-text">読み込み中…</div></div>');
    }
    if (state.step === 'unconfigured') {
      return accountShell(
        '<div class="empty-state"><div class="empty-state-text">' +
        'Supabaseの接続設定が未完了です。<br>js/supabase-config.js にプロジェクトの' +
        'URLとanon keyを設定してください。</div></div>'
      );
    }
    if (state.step === 'account') return accountShell(renderAccountInfo());
    if (state.step === 'code') return accountShell(renderCodeForm());
    return accountShell(renderEmailForm());
  }

  function accountShell(inner) {
    return {
      header:
        '<div class="header">' +
        '<button class="header-btn" data-action="back">‹</button>' +
        '<span class="header-title">アカウント</span>' +
        '<span style="width:44px"></span>' +
        '</div>',
      content: '<div class="content" style="padding:20px 16px">' + inner + '</div>',
    };
  }

  function renderEmailForm() {
    return (
      '<div class="form-group">' +
      '<label class="form-label">メールアドレス</label>' +
      '<input class="form-input" type="email" id="account-email" inputmode="email" autocomplete="email" ' +
      'placeholder="you@example.com" value="' + esc(state.email) + '">' +
      '</div>' +
      '<button class="btn btn-primary" style="width:100%" data-action="account-send-code" ' + (state.busy ? 'disabled' : '') + '>' +
      (state.busy ? '送信中…' : '確認コードを送る') +
      '</button>' +
      '<p style="font-size:12px;color:var(--text3);margin-top:14px;line-height:1.6">' +
      'パスワードは不要です。メールに届く数字を入力するとログインできます。</p>' +
      (state.message ? '<p style="font-size:12px;color:var(--danger);margin-top:10px">' + esc(state.message) + '</p>' : '')
    );
  }

  function renderCodeForm() {
    return (
      '<p style="font-size:13px;color:var(--text2);margin-bottom:16px;word-break:break-all">' +
      esc(state.email) + ' に送りました</p>' +
      '<div class="form-group">' +
      '<label class="form-label">届いたコード</label>' +
      '<input class="form-input" type="text" id="account-code" inputmode="numeric" autocomplete="one-time-code" ' +
      'maxlength="8" placeholder="123456" style="letter-spacing:0.2em;text-align:center;font-size:20px">' +
      '</div>' +
      '<button class="btn btn-primary" style="width:100%" data-action="account-verify-code" ' + (state.busy ? 'disabled' : '') + '>' +
      (state.busy ? '確認中…' : 'ログイン') +
      '</button>' +
      (state.message ? '<p style="font-size:12px;color:var(--danger);margin-top:10px">' + esc(state.message) + '</p>' : '') +
      '<div style="display:flex;gap:20px;margin-top:16px">' +
      '<button data-action="account-back-to-email" style="font-size:13px;color:var(--text3);background:none;border:none;padding:0">アドレスを変える</button>' +
      '<button data-action="account-send-code" style="font-size:13px;color:var(--primary);background:none;border:none;padding:0">コードを再送する</button>' +
      '</div>'
    );
  }

  function renderAccountInfo() {
    const email = esc(state.session && state.session.user && state.session.user.email || '');
    const b = state.billing;
    let planLine = '読み込み中…';
    if (b) {
      if (b.plan === 'pro') {
        planLine = 'Pro(無制限)';
      } else {
        const freeLeft = Math.max(0, 3 - (b.free_recordings_used || 0));
        planLine = '無料プラン・残り' + (freeLeft + (b.purchased_recordings_remaining || 0)) + '回';
      }
    }
    return (
      '<div class="list-group" style="margin-bottom:20px">' +
      '<div class="list-row"><div class="list-item" style="cursor:default">' +
      '<span class="list-item-body">' +
      '<span class="list-item-title">' + email + '</span>' +
      '<span class="list-item-sub">' + planLine + '</span>' +
      '</span></div></div>' +
      '</div>' +
      (b && b.plan === 'pro'
        ? '<button class="btn btn-secondary" style="width:100%;margin-bottom:10px" data-action="account-portal">プラン・お支払いの管理(解約はこちら)</button>'
        : '') +
      '<button class="btn btn-secondary" style="width:100%" data-action="account-logout">ログアウト</button>'
    );
  }

  // ── ログイン必須ゲート(4章:収録開始の前段) ─────────────────
  // 収録設定画面を開く直前に呼ぶ。未ログインならアカウント画面へ誘導する。
  async function requireLogin(onSuccess) {
    if (!client) { navigate({ view: 'account' }); return; }
    state.session = await readSession();
    if (!state.session) {
      navigate({ view: 'account' });
      return;
    }
    if (!state.billing) await loadBillingStatus();
    onSuccess();
  }

  function getBilling() {
    return state.billing;
  }

  async function ensureBillingLoaded() {
    if (!state.billing) await loadBillingStatus();
    return state.billing;
  }

  // ── 収録開始:サーバー側で回数を確認・消費するRPCを呼ぶ ───────────
  async function callStartRecording(params) {
    const { data, error } = await client.rpc('start_recording', params);
    if (error) throw error;
    if (state.billing) {
      state.billing = {
        ...state.billing,
        free_recordings_used: data.free_recordings_used,
        purchased_recordings_remaining: data.purchased_recordings_remaining,
      };
    }
    return data;
  }

  // ── Stripe Checkoutセッションを作成して遷移 ─────────────────
  async function startCheckout(kind) {
    if (!client || !state.session) return;
    if (typeof showToast === 'function') showToast('決済ページを準備しています…');
    try {
      const res = await fetch(FUNCTIONS_URL + '/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + state.session.access_token,
        },
        body: JSON.stringify({ kind: kind, returnUrl: window.location.href }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error || 'checkout failed');
      window.location.href = body.url;
    } catch (e) {
      console.error('[shotlog] checkout failed', e);
      if (typeof showToast === 'function') showToast('決済ページを開けませんでした');
    }
  }

  // ── Stripeの顧客ポータル(解約・支払い方法の変更)を開く ───────────
  async function openBillingPortal() {
    if (!client || !state.session) return;
    if (typeof showToast === 'function') showToast('管理ページを準備しています…');
    try {
      const { data } = await client.auth.getSession();
      const res = await fetch(FUNCTIONS_URL + '/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + data.session.access_token,
        },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error || 'portal failed');
      window.location.href = body.url;
    } catch (e) {
      console.error('[shotlog] portal failed', e);
      if (typeof showToast === 'function') showToast('管理ページを開けませんでした');
    }
  }

  // ── 別の端末から書き出したJSONをサーバーへ取り込む ──────────────
  async function importSession(session, folderId) {
    const { error } = await client.rpc('import_session', { p_session: session, p_folder_id: folderId || null });
    if (error) return { error };
    await pullRemoteIntoLocal();
    return { error: null };
  }

  // ── アクション振り分け(app.jsのhandleActionから呼ばれる) ────────
  function handleAction(action) {
    switch (action) {
      case 'account-send-code':
        sendCode();
        break;
      case 'account-verify-code':
        verifyCode();
        break;
      case 'account-back-to-email':
        backToEmail();
        break;
      case 'account-logout':
        logout();
        break;
      case 'account-portal':
        openBillingPortal();
        break;
      case 'checkout-one-time':
        startCheckout('one_time');
        break;
      case 'checkout-subscription':
        startCheckout('subscription');
        break;
    }
  }

  window.ShotLogAuth = {
    renderAccountView: renderAccountView,
    handleAction: handleAction,
    requireLogin: requireLogin,
    getBilling: getBilling,
    ensureBillingLoaded: ensureBillingLoaded,
    callStartRecording: callStartRecording,
    isLoggedIn: function () { return !!state.session; },
    billingChecked: function () { return state.billingChecked; },
    pendingCount: function () { return outbox.length; },
    isOffline: function () { return state.offline; },
    isNetworkError: isNetworkError,
    importSession: importSession,
    sync: {
      createFolder: createFolder,
      updateFolder: updateFolder,
      deleteFolder: deleteFolder,
      updateSession: updateSession,
      deleteSession: deleteSession,
      insertLog: insertLog,
      updateLog: updateLog,
      deleteLog: deleteLog,
      queueStartRecording: queueStartRecording,
    },
  };

  // ページ読み込み直後からセッション確認を始めておく
  // (収録開始ゲートを開いた瞬間に判定できるようにするため)。
  // アカウント画面を開いたタイミングによっては、この処理が終わる前に
  // 「読み込み中」のまま描画されることがあるため、完了時に再描画する。
  refreshSession().then(rerender);
})();
