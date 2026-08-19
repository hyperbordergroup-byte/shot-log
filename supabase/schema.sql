create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  free_recordings_used integer not null default 0 check (free_recordings_used between 0 and 3),
  purchased_recordings_remaining integer not null default 0 check (purchased_recordings_remaining >= 0),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.folders'::regclass
      and conname = 'folders_id_user_key'
  ) then
    alter table public.folders add constraint folders_id_user_key unique (id, user_id);
  end if;
end;
$$;
create index if not exists folders_user_idx on public.folders(user_id, created_at);
create index if not exists folders_parent_idx on public.folders(parent_id);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  number integer not null check (number > 0),
  recorded_on date not null,
  name text not null default '',
  time_base text not null default 'zero' check (time_base in ('zero', 'timecode', 'realtime')),
  timecode_start numeric not null default 0,
  offset_seconds numeric not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'recording' check (status in ('recording', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (folder_id, user_id) references public.folders(id, user_id) on delete set null (folder_id)
);
create index if not exists sessions_user_idx on public.sessions(user_id, recorded_on desc);
create index if not exists sessions_folder_idx on public.sessions(folder_id, recorded_on desc);

create table if not exists public.shot_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null check (type in ('video', 'work', 'break', 'talk', 'trouble', 'other', 'missed')),
  start_offset_seconds numeric not null default 0,
  duration_seconds numeric,
  duration_mode text not null default 'auto' check (duration_mode in ('auto', 'preset', 'unknown')),
  video_number integer,
  filename text not null default '',
  memo text not null default '',
  trouble_category text not null default '',
  trouble_subcategory text not null default '',
  photos jsonb not null default '[]'::jsonb,
  is_missed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shot_logs_session_idx on public.shot_logs(session_id, start_offset_seconds);
create index if not exists shot_logs_user_idx on public.shot_logs(user_id, created_at desc);

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('one_time_recording', 'subscription')),
  quantity integer not null default 1 check (quantity > 0),
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_subscription_id text,
  amount integer,
  currency text not null default 'jpy',
  created_at timestamptz not null default now()
);
create index if not exists billing_transactions_user_idx on public.billing_transactions(user_id, created_at desc);

create table if not exists public.stripe_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.billing_accounts (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists billing_accounts_set_updated_at on public.billing_accounts;
create trigger billing_accounts_set_updated_at
before update on public.billing_accounts
for each row execute function public.set_updated_at();

drop trigger if exists folders_set_updated_at on public.folders;
create trigger folders_set_updated_at
before update on public.folders
for each row execute function public.set_updated_at();

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

drop trigger if exists shot_logs_set_updated_at on public.shot_logs;
create trigger shot_logs_set_updated_at
before update on public.shot_logs
for each row execute function public.set_updated_at();

create or replace function public.create_folder(p_name text, p_parent_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account public.billing_accounts;
  new_folder public.folders;
  folder_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Folder name is invalid';
  end if;

  if p_parent_id is not null and not exists (
    select 1 from public.folders
    where id = p_parent_id and user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Parent folder is not accessible';
  end if;

  select * into account
  from public.billing_accounts
  where user_id = auth.uid()
  for update;

  if account.user_id is null then
    raise exception using errcode = 'P0001', message = 'Billing account is not initialized';
  end if;

  select count(*) into folder_count
  from public.folders
  where user_id = auth.uid();

  if account.plan <> 'pro' and folder_count >= 1 then
    raise exception using errcode = '42501', message = 'Folder limit reached';
  end if;

  insert into public.folders (user_id, parent_id, name)
  values (auth.uid(), p_parent_id, trim(p_name))
  returning * into new_folder;

  return to_jsonb(new_folder);
end;
$$;

create or replace function public.start_recording(
  p_folder_id uuid default null,
  p_number integer default 1,
  p_recorded_on date default current_date,
  p_time_base text default 'zero',
  p_timecode_start numeric default 0,
  p_offset_seconds numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account public.billing_accounts;
  new_session public.sessions;
  quota_source text;
  remaining_free integer;
  remaining_purchased integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_folder_id is not null and not exists (
    select 1 from public.folders
    where id = p_folder_id and user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Folder is not accessible';
  end if;

  select * into account
  from public.billing_accounts
  where user_id = auth.uid()
  for update;

  if account.user_id is null then
    raise exception using errcode = 'P0001', message = 'Billing account is not initialized';
  end if;

  if account.plan = 'pro' then
    quota_source := 'pro';
  elsif account.free_recordings_used < 3 then
    update public.billing_accounts
    set free_recordings_used = free_recordings_used + 1,
        updated_at = now()
    where user_id = auth.uid()
    returning free_recordings_used, purchased_recordings_remaining
    into remaining_free, remaining_purchased;
    quota_source := 'free';
  elsif account.purchased_recordings_remaining > 0 then
    update public.billing_accounts
    set purchased_recordings_remaining = purchased_recordings_remaining - 1,
        updated_at = now()
    where user_id = auth.uid()
    returning free_recordings_used, purchased_recordings_remaining
    into remaining_free, remaining_purchased;
    quota_source := 'purchased';
  else
    raise exception using errcode = '42501', message = 'Recording quota exhausted';
  end if;

  if quota_source = 'pro' then
    remaining_free := account.free_recordings_used;
    remaining_purchased := account.purchased_recordings_remaining;
  end if;

  insert into public.sessions (
    user_id, folder_id, number, recorded_on, time_base, timecode_start, offset_seconds,
    started_at, status
  )
  values (
    auth.uid(), p_folder_id, p_number, p_recorded_on, p_time_base, p_timecode_start,
    p_offset_seconds, now(), 'recording'
  )
  returning * into new_session;

  return to_jsonb(new_session) || jsonb_build_object(
    'quota_source', quota_source,
    'free_recordings_used', remaining_free,
    'purchased_recordings_remaining', remaining_purchased
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.folders enable row level security;
alter table public.sessions enable row level security;
alter table public.shot_logs enable row level security;
alter table public.billing_transactions enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists billing_accounts_select_own on public.billing_accounts;
create policy billing_accounts_select_own on public.billing_accounts
  for select using (auth.uid() = user_id);

drop policy if exists folders_select_own on public.folders;
create policy folders_select_own on public.folders
  for select using (auth.uid() = user_id);
drop policy if exists folders_update_own on public.folders;
create policy folders_update_own on public.folders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists folders_delete_own on public.folders;
create policy folders_delete_own on public.folders
  for delete using (auth.uid() = user_id);

drop policy if exists sessions_select_own on public.sessions;
create policy sessions_select_own on public.sessions
  for select using (auth.uid() = user_id);
drop policy if exists sessions_update_own on public.sessions;
create policy sessions_update_own on public.sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists sessions_delete_own on public.sessions;
create policy sessions_delete_own on public.sessions
  for delete using (auth.uid() = user_id);

drop policy if exists shot_logs_select_own on public.shot_logs;
create policy shot_logs_select_own on public.shot_logs
  for select using (auth.uid() = user_id);
drop policy if exists shot_logs_insert_own on public.shot_logs;
create policy shot_logs_insert_own on public.shot_logs
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.sessions
      where sessions.id = shot_logs.session_id
        and sessions.user_id = auth.uid()
    )
  );
drop policy if exists shot_logs_update_own on public.shot_logs;
create policy shot_logs_update_own on public.shot_logs
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.sessions
      where sessions.id = shot_logs.session_id
        and sessions.user_id = auth.uid()
    )
  );
drop policy if exists shot_logs_delete_own on public.shot_logs;
create policy shot_logs_delete_own on public.shot_logs
  for delete using (auth.uid() = user_id);

revoke all on public.billing_transactions from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;
revoke insert on public.folders from anon, authenticated;
revoke insert on public.sessions from anon, authenticated;
revoke insert, update, delete on public.billing_accounts from anon, authenticated;
revoke insert on public.profiles from anon, authenticated;

grant execute on function public.create_folder(text, uuid) to authenticated;
grant execute on function public.start_recording(uuid, integer, date, text, numeric, numeric) to authenticated;
