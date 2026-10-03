/**
 * 纯业务工具：数据库只做单表查询，业务逻辑全部在此层用 TS 实现。
 * 不含任何 SQL / RPC / 数据库函数依赖。
 */

/** 登录名归一化：去首尾空白 + 转小写。数据库统一存小写，eq 即可匹配。 */
export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

/** 嵌入版本时间戳转可比较数值；缺失/非法值视为最旧。 */
function timeOf(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * 从 REST 嵌入的 plugin_releases 数组取已发布的最新版本。
 * 仅统计 status='published' 的版本（待审/草稿/已下线不计入），
 * 按 created_at 降序取最新（自排序，不依赖 REST 顺序）；无已发布版本返回 null。
 * 返回新对象：保留行其余字段并写 latest_version，删除嵌入数组。
 */
export function pickLatestVersion(row: Record<string, any>): Record<string, any> {
  const { plugin_releases, ...rest } = row;
  const releases = Array.isArray(plugin_releases)
    ? plugin_releases
        .filter((release) => release?.status === 'published')
        .sort((a, b) => timeOf(b?.created_at) - timeOf(a?.created_at))
    : [];
  const latest = releases.length > 0 ? releases[0].version ?? null : null;
  return { ...rest, latest_version: latest };
}

export type ReviewAction = 'approve' | 'reject' | 'restore';

export type ReleaseReviewAction = 'approve' | 'reject';

/**
 * 版本审批状态流转（纯逻辑，不含数据访问）。
 * - approve：待审/草稿版本发布
 * - reject：待审版本退回草稿
 * 已发布版本不可重复审批；已下线/已删除版本不可审批。
 */
export function planReleaseReview(action: ReleaseReviewAction, releaseStatus: string): { releaseStatus: string } {
  if (releaseStatus === 'revoked') throw new Error('已下线版本不可审批');
  if (releaseStatus === 'deleted') throw new Error('已删除版本不可审批');
  if (releaseStatus === 'published') throw new Error('已发布版本不可审批');
  switch (action) {
    case 'approve':
      return { releaseStatus: 'published' };
    case 'reject':
      return { releaseStatus: 'draft' };
    default:
      throw new Error('无效的审核操作');
  }
}

export type Role = 'user' | 'operator' | 'admin';

const ROLE_LEVEL: Record<string, number> = { user: 1, operator: 2, admin: 3 };

/** 角色门槛判定：admin > operator > user；admin 恒通过任意门槛。 */
export function roleAtLeast(role: string | null | undefined, required: Role): boolean {
  if (role === 'admin') return true;
  return (ROLE_LEVEL[role ?? ''] ?? 0) >= ROLE_LEVEL[required];
}

/**
 * 插件写操作权限：admin 可管理任意插件；operator 无任何操作权限；
 * user 仅可管理自己创建（created_by 匹配）的插件。
 */
export function canManagePlugin(role: string | null | undefined, pluginCreatedBy: string | null | undefined, userId: string): boolean {
  if (role === 'admin') return true;
  if (role === 'operator') return false;
  return role === 'user' && !!pluginCreatedBy && pluginCreatedBy === userId;
}

/**
 * 解析请求体：GET/DELETE 等无体请求返回 undefined；
 * POST 空 body 或非法 JSON 返回空对象，避免 request.json() 抛
 * "Unexpected end of JSON input"（revoke / reset-token 等无体 POST）。
 */
export async function readBody(request: Request): Promise<unknown> {
  if (['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(request.method)) return undefined;
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/**
 * 登录状态认证唯一通道：仅 sessionId 查询参数。头通道与 access_token 一律不使用——
 * 托管平台边缘网关可能注入/拦截鉴权头（ModelScope 会拦截 `Authorization: Bearer *` 并返回
 * 403），头通道不可信；任何非 sessionId 凭据一律视为未认证。
 */
export function extractSessionId(request: Request): string {
  return new URL(request.url).searchParams.get('sessionId')?.trim() ?? '';
}

/** 开发者 Token（CI 插件登记）唯一通道：仅 token 查询参数（tpm_... 个人临时 token）。 */
export function extractDeveloperToken(request: Request): string {
  return new URL(request.url).searchParams.get('token')?.trim() ?? '';
}

/**
 * 计算审核动作后的插件状态流转计划（纯逻辑，不含数据访问）。
 * - approve：插件发布；其 pending_review/draft 版本一并发布
 * - reject：插件退回草稿；版本保持原状
 * - restore：已下架插件恢复发布；版本保持原状
 */
export function planPluginReview(action: ReviewAction, pluginStatus: string): { pluginStatus: string; promotePendingReleases: boolean } {
  if (pluginStatus === 'deleted') throw new Error('已删除插件不可操作');
  switch (action) {
    case 'approve':
      return { pluginStatus: 'published', promotePendingReleases: true };
    case 'reject':
      return { pluginStatus: 'draft', promotePendingReleases: false };
    case 'restore':
      if (pluginStatus !== 'disabled') throw new Error('仅下架插件可恢复发布');
      return { pluginStatus: 'published', promotePendingReleases: false };
    default:
      throw new Error('无效的审核操作');
  }
}
