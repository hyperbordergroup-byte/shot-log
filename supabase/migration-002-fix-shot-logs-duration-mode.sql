-- ============================================================
-- migration-002: shot_logs.duration_mode の値不足を修正
--
-- schema.sql確認時に見つかった不整合:
-- js/app.js の buildLogFromForm() は、カスタム秒数入力時に
-- durationMode = 'custom' を保存する(1739行目)。
-- しかし schema.sql の shot_logs テーブルの check制約は
-- 'auto' / 'preset' / 'unknown' の3値しか許可しておらず、
-- 'custom' の値を持つログをそのまま同期しようとすると弾かれる。
-- 'custom' を許可値に追加する。
-- ============================================================
alter table public.shot_logs
  drop constraint if exists shot_logs_duration_mode_check;

alter table public.shot_logs
  add constraint shot_logs_duration_mode_check
  check (duration_mode in ('auto', 'preset', 'unknown', 'custom'));
