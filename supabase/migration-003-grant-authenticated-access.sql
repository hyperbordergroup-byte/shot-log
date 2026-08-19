-- ============================================================
-- migration-003: authenticatedロールへの明示的な権限付与
--
-- 見つかった不具合:
-- schema.sqlは「anon/authenticatedに全テーブルへのデフォルト権限が
-- 事前付与されている」というSupabaseの一般的な初期状態を前提に、
-- 不要な権限だけをrevokeする形で書かれていた。しかし実際にはこの
-- プロジェクトでSELECT等の権限が付与されておらず、ログイン済み
-- ユーザーが自分のbilling_accountsを読もうとすると
-- "permission denied for table billing_accounts"(403)で弾かれていた。
--
-- RLSポリシー(各テーブルの *_select_own 等)が許可している操作に
-- 対応する形で、テーブルレベルの権限を明示的に付与する。
-- ============================================================

grant select, update on public.profiles to authenticated;

grant select on public.billing_accounts to authenticated;

grant select, update, delete on public.folders to authenticated;

grant select, update, delete on public.sessions to authenticated;

grant select, insert, update, delete on public.shot_logs to authenticated;
