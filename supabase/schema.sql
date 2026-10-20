-- Time Flow: 계정별 기록 저장 테이블
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 한 번 실행한다.

create table if not exists public.entries (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('day', 'year')),
  key        text        not null,           -- day: '2026-10-11' / year: '2026'
  data       jsonb,                          -- null = 지운 항목
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

alter table public.entries enable row level security;

-- 로그인한 사람은 자기 행만 읽고 쓸 수 있다
drop policy if exists "entries_select_own" on public.entries;
drop policy if exists "entries_insert_own" on public.entries;
drop policy if exists "entries_update_own" on public.entries;
drop policy if exists "entries_delete_own" on public.entries;

create policy "entries_select_own" on public.entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "entries_insert_own" on public.entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "entries_update_own" on public.entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "entries_delete_own" on public.entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 회원 탈퇴: 로그인한 사람이 자기 계정만 지울 수 있다. 기록(entries)은 on delete cascade 로 함께 지워진다.
-- auth.users 는 일반 권한으로 지울 수 없어 security definer 로 실행하고, 지우는 대상은 auth.uid() 로만 정한다.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
