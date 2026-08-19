-- ============================================================
-- migration-004: service_roleへの権限付与
--
-- migration-003でauthenticatedへの権限不足を修正したが、
-- Edge Functions(create-checkout-session/stripe-webhook)が使う
-- service_roleにも同様にテーブル権限が付与されておらず、
-- "permission denied for table billing_accounts" で失敗していた。
-- service_roleはRLSを迂回する前提の管理者ロールなので、
-- 全テーブルに対してフルアクセスを付与する。
-- ============================================================

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.billing_accounts to service_role;
grant select, insert, update, delete on public.folders to service_role;
grant select, insert, update, delete on public.sessions to service_role;
grant select, insert, update, delete on public.shot_logs to service_role;
grant select, insert, update, delete on public.billing_transactions to service_role;
grant select, insert, update, delete on public.stripe_events to service_role;
