import { auditLogs } from './db/audit-logs.js';
import { authSessions, isSessionActive, isValidSessionId } from './db/auth-sessions.js';
import { dashboard } from './db/dashboard.js';
import { developerTokens } from './db/developer-tokens.js';
import { plugins } from './db/plugins.js';
import { extractDeveloperToken, extractSessionId, readBody, roleAtLeast, canManagePlugin, type ReleaseReviewAction, type ReviewAction, type Role } from './db/query-utils.js';
import { settings } from './db/settings.js';
import { users } from './db/users.js';
import { buildTotpUri, createMfaKey, createTotpSecret, decryptMfaSecret, encryptMfaSecret, hashPassword, needsMfaVerification, verifyPassword, verifyTotp } from './security.js';

const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'same-origin', 'Access-Control-Allow-Headers': 'content-type' };
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ code: 0, message: 'success', data }), { status, headers: cors });
const fail = (message: string, status = 400) => new Response(JSON.stringify({ code: 'REQUEST_FAILED', message, data: null }), { status, headers: cors });
const route = (request: Request) => new URL(request.url).pathname.replace(/^.*\/market-admin/, '') || '/';
const digest = async (value: string) => { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, '0')).join(''); };

// 角色门槛：admin > operator > user。operator/user 都是合法登录角色，
// 是否放行由路由标注的 requireRole 决定；requireMfa 遵循"开启时验证、关闭时不验证"。
// 认证单通道：登录状态只信 ?sessionId= 查询参数（auth_sessions 表，多实例共享 DB，
// 根治"刚登录就提示已过期"）。Authorization/X-Access-Token/access_token/JWT 一律不消费。
async function currentUser(request: Request, requireRole: Role = 'admin', requireMfa = false) {
  const sessionId = extractSessionId(request);
  console.log('[auth:debug] 会话凭据', { path: new URL(request.url).pathname, sessionIdPrefix: sessionId.slice(0, 12) || null, isSessionFormat: isValidSessionId(sessionId) });
  const session = await authSessions.byId(sessionId);
  const now = Math.floor(Date.now() / 1000);
  if (!session || !isSessionActive(session)) {
    console.error('[auth:reject] 会话不存在或已失效', { sessionPrefix: sessionId.slice(0, 12), now, path: new URL(request.url).pathname });
    throw new Error('登录已过期');
  }
  const user = await users.byId(session.user_id);
  const security = user ? await settings.byUserId(user.id) : undefined;
  const roleOk = !!user && user.status === 'active' && roleAtLeast(user.role, requireRole);
  const mfaNeeded = requireMfa && !!user && needsMfaVerification(true, security?.mfa_enabled, session.aal);
  console.log('[auth:debug] 会话查询', {
    sessionPrefix: sessionId.slice(0, 12),
    found: true,
    revoked: !!session.revoked_at,
    expired: Date.parse(session.expires_at) <= Date.now(),
    aal: session.aal,
    userId: session.user_id,
    userStatus: user?.status ?? null,
    role: user?.role ?? null,
    requireRole,
    roleOk,
    requireMfa,
    mfaNeeded,
    now,
  });
  if (!user || user.status !== 'active') throw new Error('登录已过期：用户不存在或已停用');
  if (!roleAtLeast(user.role, requireRole)) throw new Error('没有管理员权限');
  if (requireMfa) {
    if (needsMfaVerification(true, security?.mfa_enabled, session.aal)) throw new Error('该操作必须完成 MFA 验证');
  }
  console.log(`[app] auth OK sub=${user.id} aal=${session.aal} path=${new URL(request.url).pathname}`);
  return { claims: { sub: user.id, aal: session.aal, sessionId: session.session_id }, user };
}

// 插件写操作守卫：admin 放行；operator 一律拒绝；user 仅可操作自己创建（created_by）的插件。
function assertPluginWrite(user: { id: string; role: string }, pluginCreatedBy: string | null | undefined) {
  if (!canManagePlugin(user.role, pluginCreatedBy, user.id)) throw new Error('无操作权限');
}

// user 角色的"登记插件"操作：允许 user 与 admin；operator 不具备写入权限。
function assertCanRegister(user: { role: string }) {
  if (user.role === 'operator') throw new Error('无操作权限');
}

async function audit(actorId: string | null, action: string, type: string, resourceId?: string) {
  await auditLogs.create(actorId, action, type, resourceId);
}

export async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const path = route(request);
    const body: any = await readBody(request);

    if (path === '/admin/login' && request.method === 'POST') {
      const loginName = String(body.username ?? '').trim();
      const user = await users.byLogin(loginName);
      const passwordOk = !!user && user.status === 'active' && (await verifyPassword(String(body.password ?? ''), user.password_hash, user.password_salt));
      if (!user || user.status !== 'active' || !passwordOk) {
        console.error(`[app] 登录失败: 账号密码无效 (username=${loginName.slice(0, 32)})`);
        return fail('账号或密码无效', 401);
      }
      const security = await settings.byUserId(user.id);
      const ttl = Number(security?.token_ttl_seconds ?? 600);
      await authSessions.cleanupExpired(user.id);
      const session = await authSessions.create({ userId: user.id, aal: 'aal1', ttlSeconds: ttl });
      await users.markLogin(user.id);
      await audit(user.id, 'auth.login', 'users', user.id);
      console.log(`[app:login] 步骤 user=${user.username}`, { userFound: !!user, status: user.status, passwordOk, ttl, cleanupDone: true, sessionPrefix: session.session_id.slice(0, 8) });
      return ok({ sessionId: session.session_id, aal: 'aal1', mfaRequired: security?.mfa_enabled === true, expiresAt: Date.now() + ttl * 1000 });
    }

    if (path === '/admin/logout' && request.method === 'POST') {
      const sessionId = extractSessionId(request);
      const session = isValidSessionId(sessionId) ? await authSessions.byId(sessionId) : null;
      if (session) {
        await authSessions.revoke(sessionId);
        await audit(session.user_id, 'auth.logout', 'users', session.user_id);
      }
      console.log(`[app:logout] 步骤`, { sessionIdPrefix: sessionId.slice(0, 12) || null, sessionFound: !!session, revoked: !!session });
      return ok({ loggedOut: true });
    }

    if (path === '/admin/mfa/verify' && request.method === 'POST') {
      const { claims, user } = await currentUser(request, 'user');
      const security = await settings.byUserId(user.id);
      if (!security?.mfa_enabled || !security.mfa_secret || !security.mfa_key || !(await verifyTotp(await decryptMfaSecret(security.mfa_secret, security.mfa_key), String(body.code ?? '')))) return fail('验证码无效', 403);
      const ttl = Number(security.token_ttl_seconds ?? 600);
      const session = await authSessions.upgradeAal(claims.sessionId, ttl);
      if (!session) {
        console.error('[auth:reject] 会话已失效，无法升级 aal', { sessionPrefix: claims.sessionId.slice(0, 12) });
        throw new Error('登录已过期');
      }
      await audit(user.id, 'mfa.verify', 'users', user.id);
      console.log(`[app:mfa] aal升级`, { from: claims.aal, to: session.aal, sessionPrefix: session.session_id.slice(0, 12), expiresAt: Date.now() + ttl * 1000 });
      return ok({ sessionId: session.session_id, aal: 'aal2', mfaRequired: true, expiresAt: Date.now() + ttl * 1000 });
    }

    // 绑定确认：校验指定用户（本人或管理员为其开启 MFA）的绑定验证码；通过后才启用其 MFA
    if (path === '/admin/mfa/verify-bind' && request.method === 'POST') {
      const { claims, user } = await currentUser(request, 'user', true);
      const targetId = String(body?.userId ?? '');
      if (targetId !== claims.sub && user.role !== 'admin') return fail('无操作权限', 403);
      const target = await users.byId(targetId);
      if (!target) return fail('用户不存在', 404);
      const security = await settings.byUserId(targetId);
      if (!security?.mfa_secret || !security.mfa_key || !(await verifyTotp(await decryptMfaSecret(security.mfa_secret, security.mfa_key), String(body?.code ?? '')))) return fail('验证码无效', 403);
      await settings.upsert(targetId, { mfaEnabled: true, tokenTtlSeconds: Number(security.token_ttl_seconds ?? 600), mfaKeyword: security.mfa_keyword });
      await audit(user.id, 'mfa.bind', 'users', targetId);
      return ok({ verified: true });
    }

    if (path === '/admin/mfa/enroll' && request.method === 'POST') {
      const { claims, user } = await currentUser(request, 'user', true);
      // 目标用户缺省为当前账户（安全设置页）；为他人生成物料仅限 admin（用户管理页）
      const targetId = body?.userId ? String(body.userId ?? '') : user.id;
      if (targetId !== claims.sub && user.role !== 'admin') return fail('无操作权限', 403);
      const target = await users.byId(targetId);
      if (!target) return fail('用户不存在', 404);
      const current = await settings.byUserId(targetId);
      const secret = createTotpSecret();
      const uri = buildTotpUri(secret, target.username);
      const mfaKey = createMfaKey();
      // 仅更新绑定物料（secret/key），不改动启用状态；启用由 verify-bind 验证码确认后完成
      await settings.upsert(targetId, { mfaEnabled: current?.mfa_enabled === true, tokenTtlSeconds: Number(current?.token_ttl_seconds ?? 600), mfaKeyword: current?.mfa_keyword, mfaSecret: await encryptMfaSecret(secret, mfaKey), mfaKey });
      await audit(user.id, 'mfa.enroll', 'users', targetId);
      return ok({ secret, uri });
    }

    if (path === '/admin/mfa/disable' && request.method === 'POST') {
      const { user } = await currentUser(request, 'user', true);
      await settings.disableMfa(user.id);
      await audit(user.id, 'mfa.disable', 'users', user.id);
      return ok({ mfaEnabled: false });
    }

    if (path === '/admin/dashboard') {
      const { user } = await currentUser(request, 'user');
      const security = await settings.byUserId(user.id);
      return ok({ ...(await dashboard.counts()), mfaRequired: security?.mfa_enabled === true });
    }

    if (path === '/plugins' && request.method === 'GET') return ok({ items: await plugins.publicList() });
    if (/^\/plugins\/[^/]+$/.test(path) && request.method === 'GET') {
      const item = await plugins.publicOne(path.split('/').at(-1)!);
      return item ? ok(item) : fail('插件不存在', 404);
    }
    if (/^\/plugins\/[^/]+\/releases$/.test(path) && request.method === 'GET') return ok({ items: await plugins.publicReleases(path.split('/')[2]!) });

    if (path === '/admin/users' && request.method === 'POST') {
      const { user: actor } = await currentUser(request, 'admin', true);
      const password = await hashPassword(String(body.password ?? ''));
      const rows = await users.create({ username: String(body.username ?? ''), displayName: String(body.displayName ?? ''), email: String(body.email ?? ''), role: String(body.role ?? 'user'), passwordHash: password.hash, passwordSalt: password.salt });
      await audit(actor.id, 'user.create', 'users', rows[0].id);
      return ok(rows[0], 201);
    }
    if (path === '/admin/users' && request.method === 'GET') {
      await currentUser(request, 'admin');
      const rows = await users.list();
      return ok({ items: rows.map((row) => ({ id: row.id, username: row.username, displayName: row.display_name ?? row.username, email: row.email, role: row.role, status: row.status, mfaEnabled: row.mfa_required, lastLoginAt: row.last_login_at })) });
    }
    if (/^\/admin\/users\/[^/]+$/.test(path) && request.method === 'PATCH') {
      const { user: actor } = await currentUser(request, 'admin', true);
      const id = path.split('/').at(-1)!;
      if (body.mfaEnabled !== undefined) {
        const target = await users.byId(id);
        if (!target) return fail('用户不存在', 404);
        const existing = await settings.byUserId(id);
        const ttl = Number(existing?.token_ttl_seconds ?? 600);
        if (body.mfaEnabled === false) {
          // 关闭 MFA：清空 enabled / secret / key
          await settings.disableMfa(id);
        } else {
          if (existing?.mfa_enabled === true && existing?.mfa_secret && existing?.mfa_key) {
            // 已启用且已绑定：仅重新开启（绑定确认由 enroll + verify-bind 完成）
            await settings.upsert(id, { mfaEnabled: true, tokenTtlSeconds: ttl, mfaKeyword: existing?.mfa_keyword });
          } else {
            return fail('请先通过「开启 MFA」完成扫码绑定', 400);
          }
        }
      }
      const rows = body.mfaEnabled === undefined ? await users.update(id, body) : (await users.list()).filter((item) => item.id === id);
      await audit(actor.id, 'user.update', 'users', id);
      return ok(rows[0]);
    }
    if (/^\/admin\/users\/[^/]+\/reset-token$/.test(path) && request.method === 'POST') {
      const { user: actor } = await currentUser(request, 'user', true);
      const id = path.split('/')[3]!;
      // 仅可重置自己的 token；管理员可重置任意用户
      if (actor.id !== id && actor.role !== 'admin') return fail('无操作权限', 403);
      const security = await settings.byUserId(id);
      const expiresAt = Date.now() + Number(security?.token_ttl_seconds ?? 600) * 1000;
      const token = `tpm_${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
      await developerTokens.revokeActive(id);
      await developerTokens.create({ userId: id, tokenHash: await digest(token), expiresAt: new Date(expiresAt).toISOString(), createdBy: actor.id });
      await authSessions.revokeAllForUser(id);
      await audit(actor.id, 'token.reset', 'users', id);
      return ok({ token, expiresAt });
    }
    if (/^\/admin\/users\/[^/]+\/reset-password$/.test(path) && request.method === 'POST') {
      // 管理员重置指定用户密码
      const { user: actor } = await currentUser(request, 'admin', true);
      const id = path.split('/')[3]!;
      const target = await users.byId(id);
      if (!target) return fail('用户不存在', 404);
      const next = String(body?.newPassword ?? '');
      if (next.length < 8) return fail('新密码至少 8 位', 400);
      const { hash, salt } = await hashPassword(next);
      await users.changePassword(id, hash, salt);
      await authSessions.revokeAllForUser(id);
      await audit(actor.id, 'user.password.reset', 'users', id);
      return ok({ updated: true });
    }
    if (/^\/admin\/users\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const { user: actor } = await currentUser(request, 'admin', true);
      const id = path.split('/').at(-1)!;
      if (actor.id === id) return fail('不能删除当前登录账户');
      const rows = await users.remove(id);
      await audit(actor.id, 'user.delete', 'users', id);
      return ok(rows);
    }

    if (path === '/admin/settings' && request.method === 'GET') {
      const { user } = await currentUser(request, 'user');
      const security = await settings.byUserId(user.id);
      return ok({ items: { id: user.id, username: user.username, displayName: user.display_name, role: user.role, mfaEnabled: security?.mfa_enabled ?? false, tokenTtlSeconds: security?.token_ttl_seconds ?? 600, mfaKeyword: security?.mfa_keyword ?? '' } });
    }
    if (path === '/admin/settings' && request.method === 'PUT') {
      const { user } = await currentUser(request, 'admin');
      await settings.upsert(user.id, { mfaEnabled: Boolean(body.mfaEnabled), tokenTtlSeconds: Number(body.tokenTtlSeconds ?? 600), mfaKeyword: body.mfaKeyword ?? null });
      return ok({ items: body });
    }
    // 修改当前账户密码
    if (path === '/admin/me/password' && request.method === 'POST') {
      const { user } = await currentUser(request, 'user', true);
      if (!(await verifyPassword(String(body.currentPassword ?? ''), user.password_hash, user.password_salt))) return fail('当前密码不正确', 400);
      const next = String(body.newPassword ?? '');
      if (next.length < 8) return fail('新密码至少 8 位', 400);
      const { hash, salt } = await hashPassword(next);
      await users.changePassword(user.id, hash, salt);
      await authSessions.revokeAllForUser(user.id);
      await audit(user.id, 'user.password', 'users', user.id);
      return ok({ updated: true });
    }
    if (path === '/admin/audits' && request.method === 'GET') {
      await currentUser(request, 'admin');
      const rows = await auditLogs.list();
      return ok({ items: rows.map((row) => ({ id: row.id, actorId: row.actor_id, action: row.action, target: row.resource_type, createdAt: row.created_at })) });
    }

    if (path === '/admin/todos' && request.method === 'GET') {
      await currentUser(request, 'admin');
      return ok({ items: await plugins.pendingTodos() });
    }
    if (/^\/admin\/todos\/releases\/[^/]+\/review$/.test(path) && request.method === 'POST') {
      const { user } = await currentUser(request, 'admin', true);
      // /admin/todos/releases/{id}/review -> ['', 'admin', 'todos', 'releases', '{id}', 'review']
      const id = path.split('/')[4]!;
      const action = String(body?.action ?? '') as ReleaseReviewAction;
      const result = await plugins.reviewRelease(id, user.id, action);
      await audit(user.id, `release.${action}`, 'plugin_releases', result.id);
      return ok(result);
    }

    if (path === '/admin/plugins' && request.method === 'GET') {
      await currentUser(request, 'user');
      const rows = await plugins.adminList();
      return ok({ items: rows.map((row) => ({ id: row.id, pluginCode: row.plugin_code, alias: row.alias, description: row.description, author: row.author, status: row.status, createdBy: row.created_by, updatedAt: row.updated_at, latestVersion: row.latest_version })) });
    }
    if (path === '/admin/plugins/with-release' && request.method === 'POST') {
      const { user } = await currentUser(request, 'user', true);
      // 登记是写操作：operator 无任何操作权限；user/admin 可登记
      assertCanRegister(user);
      const result = await plugins.createWithRelease(user.id, body);
      await audit(user.id, 'plugin.create', 'plugins', result.plugin.id);
      return ok(result, 201);
    }
    if (/^\/admin\/plugins\/[^/]+\/releases$/.test(path) && request.method === 'GET') {
      await currentUser(request, 'user');
      const rows = await plugins.releases(path.split('/')[3]!);
      return ok({ items: rows.map((row) => ({ id: row.id, version: row.version, status: row.status, sizeBytes: row.size_bytes, createdAt: row.created_at, publishedAt: row.published_at })) });
    }
    if (/^\/admin\/plugins\/[^/]+\/releases$/.test(path) && request.method === 'POST') {
      const { user } = await currentUser(request, 'user', true);
      const plugin = (await plugins.adminList()).find((item) => item.plugin_code === path.split('/')[3]);
      if (!plugin) return fail('插件不存在', 404);
      assertPluginWrite(user, plugin.created_by);
      const result = await plugins.addRelease(plugin.id, user.id, body);
      await audit(user.id, 'release.create', 'plugin_releases', result[0].id);
      return ok(result[0], 201);
    }
    if (/^\/admin\/plugins\/[^/]+\/review$/.test(path) && request.method === 'POST') {
      // 审核（通过/驳回）仅限 admin（待办中心入口）
      const { user } = await currentUser(request, 'admin', true);
      const code = path.split('/')[3]!;
      const action = String(body?.action ?? '') as ReviewAction;
      const result = await plugins.review(code, user.id, action);
      await audit(user.id, `plugin.${action}`, 'plugins', result.id);
      return ok(result);
    }
    if (/^\/admin\/plugins\/[^/]+\/disable$/.test(path) && request.method === 'POST') {
      const { user } = await currentUser(request, 'user', true);
      const code = path.split('/')[3]!;
      const plugin = (await plugins.adminList()).find((item) => item.plugin_code === code);
      if (!plugin) return fail('插件不存在', 404);
      assertPluginWrite(user, plugin.created_by);
      const result = await plugins.disable(code, user.id);
      await audit(user.id, 'plugin.disable', 'plugins', result.id);
      return ok(result);
    }
    if (/^\/admin\/plugins\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const { user } = await currentUser(request, 'user', true);
      const code = path.split('/').at(-1)!;
      const plugin = (await plugins.adminList()).find((item) => item.plugin_code === code);
      if (!plugin) return fail('插件不存在', 404);
      assertPluginWrite(user, plugin.created_by);
      const result = await plugins.remove(code, user.id);
      await audit(user.id, 'plugin.delete', 'plugins', result.id);
      return ok(result);
    }
    if (/^\/admin\/releases\/[^/]+\/revoke$/.test(path) && request.method === 'POST') {
      const { user } = await currentUser(request, 'user', true);
      const id = path.split('/')[3]!;
      const owner = await plugins.releaseOwner(id);
      if (!owner) return fail('版本不存在', 404);
      assertPluginWrite(user, owner.createdBy);
      const rows = await plugins.revokeRelease(id, user.id);
      await audit(user.id, 'release.revoke', 'plugin_releases', id);
      return ok(rows[0]);
    }
    if (/^\/admin\/releases\/[^/]+$/.test(path) && request.method === 'DELETE') {
      const { user } = await currentUser(request, 'user', true);
      const id = path.split('/').at(-1)!;
      const owner = await plugins.releaseOwner(id);
      if (!owner) return fail('版本不存在', 404);
      assertPluginWrite(user, owner.createdBy);
      const rows = await plugins.deleteRelease(id, user.id);
      await audit(user.id, 'release.delete', 'plugin_releases', id);
      return ok(rows[0]);
    }

    // —— 开发者接口（developer token 认证，供 GitHub Actions 等 CI 调用）——
    // 插件已存在（未删除）则追加版本，否则创建插件并登记首个版本；登记结果均为待审核。
    if (path === '/plugins/with-release' && request.method === 'POST') {
      const tokenRow = await developerTokens.byHash(await digest(extractDeveloperToken(request)));
      if (!tokenRow) return fail('开发者 Token 无效或已过期', 401);
      const code = String(body?.plugin?.pluginCode ?? '').trim();
      if (!code) return fail('缺少插件编码 pluginCode', 400);
      const existed = (await plugins.adminList()).find((item) => item.plugin_code === code);
      let result;
      if (existed) {
        const release = (await plugins.addRelease(existed.id, tokenRow.user_id, body?.release ?? {}))[0];
        result = { plugin: existed, release };
      } else {
        result = await plugins.createWithRelease(tokenRow.user_id, body);
      }
      await audit(tokenRow.user_id, existed ? 'release.create' : 'plugin.create', 'plugins', result.plugin.id);
      return ok(result, 201);
    }
    return fail('接口不存在', 404);
  } catch (error) {
    // supabase 抛出的 PostgrestError 非 Error 实例，需透传其 message 便于定位问题
    const message = error instanceof Error ? error.message : (error as { message?: unknown } | null)?.message ?? '服务异常';
    return fail(typeof message === 'string' && message ? message : '服务异常', 403);
  }
}
