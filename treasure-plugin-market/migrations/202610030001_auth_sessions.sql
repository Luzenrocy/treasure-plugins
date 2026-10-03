-- auth_sessions 会话表（方案 B：会话存储认证）
-- 解决 FC 多实例 AUTH_JWT_SECRET 不一致导致"刚登录就提示已过期"：校验只依赖共享 DB，
-- 与任何实例的密钥/内存无关。表结构幂等，可重复执行。

create table if not exists public.auth_sessions (
  session_id   text primary key,          -- 服务端生成的 32 字节随机数（base64url，43 字符）
  user_id      uuid not null references public.users(id) on delete cascade,
  aal          text not null default 'aal1' check (aal in ('aal1','aal2')),
  created_at   timestamptz not null default timezone('utc', now()),
  expires_at   timestamptz not null,      -- 沿用 user_settings.token_ttl_seconds 语义
  revoked_at   timestamptz                -- 登出/改密/重置时置值
);

drop index if exists public.auth_sessions_user_id_idx;
create index auth_sessions_user_id_idx on public.auth_sessions(user_id);

drop index if exists public.auth_sessions_expires_at_idx;
create index auth_sessions_expires_at_idx on public.auth_sessions(expires_at);

-- 安全：启用 RLS 且不授予任何 anon/authenticated 策略（RLS 默认拒绝），
-- 应用经 service-role 客户端访问本表；anon key 直查将得到空结果/被拒。
alter table public.auth_sessions enable row level security;

-- 仅授予 service_role（绕过 RLS 的服务端全权角色），不授予 anon/authenticated。
grant select, insert, update, delete on public.auth_sessions to service_role;
