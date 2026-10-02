import { supabase } from '../supabase.js';
import { normalizeLogin } from './query-utils.js';

export const users = {
  async byId(id: string) {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  // 纯 REST：登录名归一化后，分别按 username / email 精确匹配。
  // 数据库统一存小写，无需 RPC 函数。
  async byLogin(login: string) {
    const normalized = normalizeLogin(login);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${normalized},email.eq.${normalized}`)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  async markLogin(id: string) {
    const { error } = await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async list() {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, email, role, status, last_login_at, user_settings(mfa_enabled)')
      .is('deleted_at', null)
      .order('username');
    if (error) throw error;
    return (data ?? []).map((row: any) => {
      // 一对一嵌入：PostgREST 可能返回对象或数组，统一取 mfa_enabled
      const setting = Array.isArray(row.user_settings) ? row.user_settings[0] : row.user_settings;
      return {
        ...row,
        mfa_required: setting?.mfa_enabled ?? false,
        user_settings: undefined,
      };
    });
  },

  async create(input: { username: string; displayName?: string; email: string; role: string; passwordHash: string; passwordSalt: string }) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: input.username.toLowerCase(),
        display_name: input.displayName ?? null,
        email: input.email.toLowerCase(),
        role: input.role,
        password_hash: input.passwordHash,
        password_salt: input.passwordSalt,
      })
      .select('id, username, display_name, email, role, status')
      .single();
    if (error) throw error;
    return data ? [data] : [];
  },

  async update(id: string, input: { mfaEnabled?: boolean; status?: string; displayName?: string | null; role?: string | null }) {
    let patch: Record<string, unknown>;
    if (input.mfaEnabled !== undefined) {
      patch = { mfa_required: input.mfaEnabled };
    } else if (input.status !== undefined) {
      patch = { status: input.status };
    } else {
      patch = {};
      if (input.displayName !== undefined) patch.display_name = input.displayName;
      if (input.role !== undefined) patch.role = input.role;
    }
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? [data] : [];
  },

  // 修改密码：更新哈希/盐并记录更新时间
  async changePassword(id: string, passwordHash: string, passwordSalt: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, password_salt: passwordSalt, password_updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  // 逻辑删除：置 deleted_at 标记，列表/登录自然过滤；保留行以维持审计与归属引用。
  async remove(id: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('用户不存在或已删除');
    return data;
  },
};
