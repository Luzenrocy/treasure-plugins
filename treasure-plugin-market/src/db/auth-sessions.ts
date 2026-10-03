import { createSessionId } from '../security.js';

/** sessionId 格式：32 字节随机数的 base64url（43 字符）。 */
export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * sessionId 格式校验：拒绝垃圾/伪造值（Vapor token、任意字符串、非 43 字符等）。
 * 仅校验形状，存在性与有效性由 DB 查询决定（格式合法但不存在同样拒绝）。
 */
export function isValidSessionId(value: string): boolean {
  return SESSION_ID_PATTERN.test(value);
}

export type SessionRow = {
  session_id: string;
  user_id: string;
  aal: 'aal1' | 'aal2';
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

/** 会话有效性：存在、未撤销、未过期（恰在过期时刻视为无效）。 */
export function isSessionActive(session: SessionRow | null | undefined, now = Date.now()): boolean {
  return !!session && !session.revoked_at && Date.parse(session.expires_at) > now;
}

// service-role 客户端懒加载：避免无环境变量时模块加载即抛错（supabase.ts 顶部校验），
// 便于纯函数单测；运行时 handler 调用时才有环境。
async function client() {
  const { supabaseService } = await import('../supabase.js');
  if (!supabaseService) throw new Error('SUPABASE_SERVICE_ROLE_KEY 未配置（会话存储认证需要 service-role 客户端）');
  return supabaseService;
}

export const authSessions = {
  async create(input: { userId: string; aal: 'aal1' | 'aal2'; ttlSeconds: number }) {
    const { data, error } = await (await client())
      .from('auth_sessions')
      .insert({
        session_id: createSessionId(),
        user_id: input.userId,
        aal: input.aal,
        expires_at: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as SessionRow;
  },

  async byId(sessionId: string) {
    const { data, error } = await (await client()).from('auth_sessions').select('*').eq('session_id', sessionId).maybeSingle();
    if (error) throw error;
    return (data as SessionRow) ?? null;
  },

  async revoke(sessionId: string) {
    const { error } = await (await client())
      .from('auth_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('revoked_at', null);
    if (error) throw error;
  },

  /** MFA 验证通过：会话升级为 aal2 并顺延有效期（沿用 token_ttl_seconds 语义）。 */
  async upgradeAal(sessionId: string, ttlSeconds: number) {
    const { data, error } = await (await client())
      .from('auth_sessions')
      .update({ aal: 'aal2', expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() })
      .eq('session_id', sessionId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return (data as SessionRow) ?? null;
  },

  /** 修改密码 / 重置 Token：作废该用户全部未过期会话。 */
  async revokeAllForUser(userId: string) {
    const { error } = await (await client())
      .from('auth_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString());
    if (error) throw error;
  },

  /** 登录时顺手清理该用户的过期会话行（防表只增不减）。 */
  async cleanupExpired(userId: string) {
    const { error } = await (await client())
      .from('auth_sessions')
      .delete()
      .eq('user_id', userId)
      .lt('expires_at', new Date().toISOString());
    if (error) throw error;
  },
};
