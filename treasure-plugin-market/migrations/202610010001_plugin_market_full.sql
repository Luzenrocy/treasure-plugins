-- Treasure Plugin Market 全量数据库初始化（可重复执行）
-- 应用通过 @supabase/supabase-js 以 publishable(anon) key 经 REST 访问；
-- 业务逻辑全部在 TS 层，数据库不建 RPC 函数，不依赖 Supabase Auth。
-- 每次执行都会 DROP 并重建全部对象（表/索引/函数/触发器），数据将清空重置，
-- 适用于全新初始化与重置，请勿在生产环境直接执行。

create extension if not exists pgcrypto;

-- ============================================================
-- 1) 表：先删后建（按外键依赖从子表到父表）
-- ============================================================
drop table if exists public.audit_logs CASCADE;
drop table if exists public.developer_tokens CASCADE;
drop table if exists public.plugin_releases CASCADE;
drop table if exists public.plugins CASCADE;
drop table if exists public.user_settings CASCADE;
drop table if exists public.users CASCADE;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  -- username 无条件唯一：删除为逻辑删除（deleted_at 标记），删除后不可重名，防止冒用
  username text not null unique check (username = lower(username) and length(username) between 1 and 64),
  alias text,
  display_name text,
  email text not null,
  password_hash text not null,
  password_salt text not null,
  password_updated_at timestamptz not null default timezone('utc', now()),
  role text not null default 'user' check (role in ('user', 'admin', 'operator')),
  status text not null default 'active' check (status in ('active', 'disabled', 'pending')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_login_at timestamptz,
  deleted_at timestamptz -- 逻辑删除标记：停用（disabled）后可删除
);
drop index if exists public.users_email_lower_key;
create unique index users_email_lower_key on public.users (lower(email));

create table public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  mfa_enabled boolean not null default false,
  mfa_secret text,
  mfa_key text, -- 每用户独立 AES-256-GCM 密钥，开启/更换 MFA 时重新生成
  token_ttl_seconds integer not null default 600 check (token_ttl_seconds between 60 and 86400),
  mfa_keyword text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.plugins (
  id uuid primary key default gen_random_uuid(),
  plugin_code text not null check (plugin_code ~ '^[a-z][a-z0-9-]*$' and plugin_code <> 'treasure' and plugin_code not like '%_debug_%'),
  alias text not null,
  description text not null,
  author text not null,
  icon_url text,
  homepage text,
  categories jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  status text not null default 'pending_review' check (status in ('draft', 'pending_review', 'published', 'disabled', 'deleted')),
  created_by uuid not null references public.users(id),
  updated_by uuid references public.users(id),
  deleted_by uuid references public.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
-- 插件编码唯一性仅约束未删除记录：逻辑删除后允许重新登记同名插件
drop index if exists public.plugins_active_code_idx;
create unique index plugins_active_code_idx on public.plugins(plugin_code) where deleted_at is null;
drop index if exists public.plugins_status_idx;
create index plugins_status_idx on public.plugins(status) where deleted_at is null;

create table public.plugin_releases (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  download_url text not null check (left(download_url, 8) = 'https://'),
  sha256 text not null check (sha256 ~ '^[a-fA-F0-9]{64}$'),
  size_bytes bigint not null check (size_bytes > 0),
  manifest_json jsonb not null,
  min_platform_version text,
  changelog text,
  status text not null default 'pending_review' check (status in ('draft', 'pending_review', 'published', 'revoked', 'deleted')),
  submitted_by uuid not null references public.users(id),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  published_by uuid references public.users(id),
  published_at timestamptz,
  deleted_by uuid references public.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
-- (plugin_id, version) 唯一性仅约束未删除版本：删除后允许重新登记同版本
drop index if exists public.plugin_releases_active_version_idx;
create unique index plugin_releases_active_version_idx on public.plugin_releases(plugin_id, version) where deleted_at is null;
drop index if exists public.plugin_releases_plugin_idx;
create index plugin_releases_plugin_idx on public.plugin_releases(plugin_id, created_at desc) where deleted_at is null;
drop index if exists public.plugin_releases_public_idx;
create index plugin_releases_public_idx on public.plugin_releases(plugin_id, version) where status = 'published' and deleted_at is null;

create table public.developer_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default timezone('utc', now())
);
drop index if exists public.developer_tokens_active_idx;
create index developer_tokens_active_idx on public.developer_tokens(token_hash) where revoked_at is null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
drop index if exists public.audit_logs_created_idx;
create index audit_logs_created_idx on public.audit_logs(created_at desc);
drop index if exists public.audit_logs_actor_idx;
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

-- ============================================================
-- 2) 权限：anon/authenticated/service_role 全权（表重建后默认 RLS 关闭）
-- ============================================================
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- ============================================================
-- 3) updated_at 自动维护（触发器 + 函数）
-- ============================================================
drop function if exists public.set_updated_at();
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists plugins_updated_at on public.plugins;
create trigger plugins_updated_at before update on public.plugins
for each row execute function public.set_updated_at();

drop trigger if exists plugin_releases_updated_at on public.plugin_releases;
create trigger plugin_releases_updated_at before update on public.plugin_releases
for each row execute function public.set_updated_at();

-- developer_tokens 表无 updated_at 列，不能挂 set_updated_at 触发器（否则 update 报 record "new" has no field "updated_at"）
drop trigger if exists developer_tokens_updated_at on public.developer_tokens;

-- ============================================================
-- 4) 初始管理员（默认凭证 treasure / 123456，首次登录后请立即修改）
-- ============================================================
insert into public.users (username, email, role, status, password_hash, password_salt)
values (
  'treasure',
  'treasure',
  'admin',
  'active',
  'HzWLr5BLAscDCe5wae9hEsyzn0QgsX6OeFlzUnybX3c',
  'dgFgjTOxl7ny-0nhMBz4zg'
)
on conflict (username) do nothing;

insert into public.user_settings (user_id, mfa_enabled, token_ttl_seconds)
select id, false, 600 from public.users where username = 'treasure'
on conflict (user_id) do nothing;