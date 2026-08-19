-- ============================================================
-- migration-001: 課金Webhook用関数・localStorage移行用関数
--
-- schema.sql に対する追加分。Supabase Dashboard の SQL Editor で
-- schema.sql の後に実行する。
-- ============================================================

-- ------------------------------------------------------------
-- migrate_local_data
--
-- ログイン前にブラウザのlocalStorageに溜まっていたフォルダ・
-- セッション・ログを、初回ログイン時に一括でこのユーザーの
-- アカウントへ移行する。
--
-- 決定事項:
--   - 移行したセッションは無料枠(free_recordings_used)を一切
--     消費しない。billing_accounts には触れず、folders/sessions/
--     shot_logs へ直接INSERTするだけなので、これは自然に満たされる。
--   - 移行時のみ、無料プランのフォルダ数上限(1件)は適用しない。
--     過去に複数フォルダを使っていたユーザーの持ち込みデータを
--     欠落させないため。
--   - 移行後のセッションは端末をまたいだ「収録中」の再開ができない
--     ため、ステータスは常に completed にする。
--   - 二重移行防止:このユーザーに既にfolders/sessionsが1件でも
--     あれば何もせず migrated=false を返す。
-- ------------------------------------------------------------
create or replace function public.migrate_local_data(p_folders jsonb, p_sessions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_folder jsonb;
  v_session jsonb;
  v_log jsonb;
  v_new_folder_id uuid;
  v_new_session_id uuid;
  v_folder_count integer := 0;
  v_session_count integer := 0;
  v_log_count integer := 0;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if exists (select 1 from public.folders where user_id = v_user)
     or exists (select 1 from public.sessions where user_id = v_user) then
    return jsonb_build_object('migrated', false, 'reason', 'already_has_data');
  end if;

  create temporary table tmp_folder_map (
    local_id text primary key,
    new_id uuid not null
  ) on commit drop;

  -- Pass 1: フォルダを親子付けせずに作成し、local_id -> new_id を記録
  for v_folder in select * from jsonb_array_elements(coalesce(p_folders, '[]'::jsonb))
  loop
    insert into public.folders (user_id, parent_id, name)
    values (v_user, null, coalesce(nullif(trim(v_folder->>'name'), ''), '無題フォルダ'))
    returning id into v_new_folder_id;

    insert into tmp_folder_map (local_id, new_id) values (v_folder->>'id', v_new_folder_id);
    v_folder_count := v_folder_count + 1;
  end loop;

  -- Pass 2: parent_id をローカルIDのマップで解決
  for v_folder in select * from jsonb_array_elements(coalesce(p_folders, '[]'::jsonb))
  loop
    if v_folder->>'parentId' is not null then
      update public.folders
      set parent_id = (select new_id from tmp_folder_map where local_id = v_folder->>'parentId')
      where id = (select new_id from tmp_folder_map where local_id = v_folder->>'id');
    end if;
  end loop;

  -- セッション + ログを挿入
  for v_session in select * from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb))
  loop
    insert into public.sessions (
      user_id, folder_id, number, recorded_on, name, time_base, timecode_start,
      offset_seconds, started_at, ended_at, status
    )
    values (
      v_user,
      (select new_id from tmp_folder_map where local_id = v_session->>'folderId'),
      greatest(coalesce((v_session->>'number')::integer, 1), 1),
      coalesce((v_session->>'date')::date, current_date),
      coalesce(v_session->>'name', ''),
      coalesce(v_session->>'timeBase', 'zero'),
      coalesce((v_session->>'timecodeStart')::numeric, 0),
      coalesce((v_session->>'offset')::numeric, 0),
      case when v_session->>'startedAt' is not null
           then to_timestamp((v_session->>'startedAt')::double precision / 1000)
           else null end,
      case when v_session->>'endedAt' is not null
           then to_timestamp((v_session->>'endedAt')::double precision / 1000)
           else now() end,
      'completed'
    )
    returning id into v_new_session_id;

    v_session_count := v_session_count + 1;

    for v_log in select * from jsonb_array_elements(coalesce(v_session->'logs', '[]'::jsonb))
    loop
      insert into public.shot_logs (
        user_id, session_id, type, start_offset_seconds, duration_seconds, duration_mode,
        video_number, filename, memo, trouble_category, trouble_subcategory, photos, is_missed
      )
      values (
        v_user,
        v_new_session_id,
        v_log->>'type',
        coalesce((v_log->>'startOffset')::numeric, 0),
        (v_log->>'duration')::numeric,
        coalesce(v_log->>'durationMode', 'auto'),
        (v_log->>'videoNumber')::integer,
        coalesce(v_log->>'filename', ''),
        coalesce(v_log->>'memo', ''),
        coalesce(v_log->>'troubleCategory', ''),
        coalesce(v_log->>'troubleSubcategory', ''),
        coalesce(v_log->'photos', '[]'::jsonb),
        coalesce((v_log->>'isMissed')::boolean, false)
      );
      v_log_count := v_log_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'migrated', true,
    'folders', v_folder_count,
    'sessions', v_session_count,
    'logs', v_log_count
  );
end;
$$;

grant execute on function public.migrate_local_data(jsonb, jsonb) to authenticated;


-- ------------------------------------------------------------
-- set_stripe_customer_id
-- Checkout Session作成時、初めてStripe顧客を作った直後に
-- Edge Functions(service_role)から呼ぶ。既に設定済みなら上書きしない。
-- ------------------------------------------------------------
create or replace function public.set_stripe_customer_id(p_user_id uuid, p_customer_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.billing_accounts
  set stripe_customer_id = p_customer_id, updated_at = now()
  where user_id = p_user_id and stripe_customer_id is null;
$$;

revoke all on function public.set_stripe_customer_id(uuid, text) from public, anon, authenticated;
grant execute on function public.set_stripe_customer_id(uuid, text) to service_role;


-- ------------------------------------------------------------
-- apply_stripe_checkout_completed
-- checkout.session.completed(都度払い/one_time_recording)を
-- 反映する。billing_transactionsのstripe_checkout_session_id
-- がuniqueなので、同一イベントの重複適用も二重に加算しない。
-- ------------------------------------------------------------
create or replace function public.apply_stripe_checkout_completed(
  p_user_id uuid,
  p_customer_id text,
  p_checkout_session_id text,
  p_kind text,
  p_quantity integer default 1,
  p_amount integer default null,
  p_currency text default 'jpy'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.billing_transactions
    where stripe_checkout_session_id = p_checkout_session_id
  ) then
    return;
  end if;

  update public.billing_accounts
  set stripe_customer_id = p_customer_id,
      purchased_recordings_remaining = case
        when p_kind = 'one_time_recording'
        then purchased_recordings_remaining + p_quantity
        else purchased_recordings_remaining
      end,
      updated_at = now()
  where user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Billing account not found';
  end if;

  insert into public.billing_transactions (
    user_id, kind, quantity, stripe_customer_id, stripe_checkout_session_id, amount, currency
  )
  values (
    p_user_id, p_kind, p_quantity, p_customer_id, p_checkout_session_id, p_amount, coalesce(p_currency, 'jpy')
  );
end;
$$;

revoke all on function public.apply_stripe_checkout_completed(uuid, text, text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.apply_stripe_checkout_completed(uuid, text, text, text, integer, integer, text) to service_role;


-- ------------------------------------------------------------
-- apply_stripe_subscription_status
-- customer.subscription.created/updated/deleted を反映する。
-- active/trialing なら plan='pro'、それ以外は plan='free' に戻す。
-- ------------------------------------------------------------
create or replace function public.apply_stripe_subscription_status(
  p_customer_id text,
  p_subscription_id text,
  p_status text,
  p_current_period_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  v_plan := case when p_status in ('active', 'trialing') then 'pro' else 'free' end;

  update public.billing_accounts
  set plan = v_plan,
      stripe_subscription_id = p_subscription_id,
      subscription_status = p_status,
      current_period_end = p_current_period_end,
      updated_at = now()
  where stripe_customer_id = p_customer_id;
end;
$$;

revoke all on function public.apply_stripe_subscription_status(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_status(text, text, text, timestamptz) to service_role;
