-- ============================================================
-- migration-006: import_session
--
-- JSONで書き出した収録を取り込む。migrate_local_data は「まだデータが
-- 無いユーザーの初回移行」専用で、既にデータがあると何もしないため別に用意する。
--
--   - 収録回数は消費しない(新しい収録ではなく既存の記録の持ち込みのため)
--   - 取り込んだ収録は常に completed にする(start_recording を経由しないため)
--   - 保存先フォルダは本人のものだけを許可する
-- ============================================================
create or replace function public.import_session(p_session jsonb, p_folder_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_new_session_id uuid;
  v_log jsonb;
  v_log_count integer := 0;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_folder_id is not null and not exists (
    select 1 from public.folders where id = p_folder_id and user_id = v_user
  ) then
    raise exception using errcode = '42501', message = 'Folder is not accessible';
  end if;

  insert into public.sessions (
    user_id, folder_id, number, recorded_on, name, time_base, timecode_start,
    offset_seconds, started_at, ended_at, status
  )
  values (
    v_user,
    p_folder_id,
    greatest(coalesce((p_session->>'number')::integer, 1), 1),
    coalesce((p_session->>'date')::date, current_date),
    coalesce(p_session->>'name', ''),
    coalesce(p_session->>'timeBase', 'zero'),
    coalesce((p_session->>'timecodeStart')::numeric, 0),
    coalesce((p_session->>'offset')::numeric, 0),
    case when p_session->>'startedAt' is not null
         then to_timestamp((p_session->>'startedAt')::double precision / 1000)
         else null end,
    case when p_session->>'endedAt' is not null
         then to_timestamp((p_session->>'endedAt')::double precision / 1000)
         else now() end,
    'completed'
  )
  returning id into v_new_session_id;

  for v_log in select * from jsonb_array_elements(coalesce(p_session->'logs', '[]'::jsonb))
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
      coalesce(v_log->>'durationMode', 'unknown'),
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

  return jsonb_build_object('id', v_new_session_id, 'logs', v_log_count);
end;
$$;

revoke execute on function public.import_session(jsonb, uuid) from public;
revoke execute on function public.import_session(jsonb, uuid) from anon;
grant execute on function public.import_session(jsonb, uuid) to authenticated;
