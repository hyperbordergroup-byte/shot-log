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

  const state = {
    step: isConfigured ? 'loading' : 'unconfigured', // loading | unconfigured | email | code | account
    email: '',
    busy: false,
    message: '',
    session: null,
    billing: null,
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
  async function refreshSession() {
    if (!client) return;
    const { data } = await client.auth.getSession();
    state.session = data.session || null;
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
    handleCheckoutReturn();
  }

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
    if (error) {
      console.error('[shotlog] loadBillingStatus failed', error);
    } else {
      state.billing = data;
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

    const { data } = await client.auth.getSession();
    state.session = data.session || null;
    await onLoggedIn();
    state.busy = false;
    rerender();
  }

  async function logout() {
    if (!client) return;
    await client.auth.signOut();
    state.session = null;
    state.billing = null;
    state.step = 'email';
    state.email = '';
    state.message = '';
    rerender();
  }

  function backToEmail() {
    state.step = 'email';
    state.message = '';
    rerender();
  }

  function rerender() {
    if (typeof currentFrame === 'function' && currentFrame().view === 'account') {
      const app = document.getElementById('app');
      if (app) app.innerHTML = renderAccountView();
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
    return (
      '<div class="header">' +
      '<button class="header-btn" data-action="back">‹</button>' +
      '<span class="header-title">アカウント</span>' +
      '<span style="width:44px"></span>' +
      '</div>' +
      '<div class="content" style="padding:20px 16px">' + inner + '</div>'
    );
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
      '<button class="btn btn-secondary" style="width:100%" data-action="account-logout">ログアウト</button>'
    );
  }

  // ── ログイン必須ゲート(4章:収録開始の前段) ─────────────────
  // 収録設定画面を開く直前に呼ぶ。未ログインならアカウント画面へ誘導する。
  async function requireLogin(onSuccess) {
    if (!client) { navigate({ view: 'account' }); return; }
    const { data } = await client.auth.getSession();
    state.session = data.session || null;
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
  };

  // ページ読み込み直後からセッション確認を始めておく
  // (収録開始ゲートを開いた瞬間に判定できるようにするため)。
  // アカウント画面を開いたタイミングによっては、この処理が終わる前に
  // 「読み込み中」のまま描画されることがあるため、完了時に再描画する。
  refreshSession().then(rerender);
})();
