import { supabase } from '../supabase.js';

export const settings = {
  async byUserId(userId: string) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  async upsert(userId: string, input: { mfaEnabled: boolean; tokenTtlSeconds: number; mfaKeyword?: string | null; mfaSecret?: string | null; mfaKey?: string | null }) {
    // mfa_secret 与 mfa_key 同生共死：未显式传入时保留旧值，
    // 避免 /admin/settings 等不涉及 MFA 的更新把已绑定的密钥清空。
    let mfaSecret = input.mfaSecret ?? null;
    let mfaKey = input.mfaKey ?? null;
    if (mfaSecret === null || mfaKey === null) {
      const existing = await this.byUserId(userId);
      if (mfaSecret === null) mfaSecret = existing?.mfa_secret ?? null;
      if (mfaKey === null) mfaKey = existing?.mfa_key ?? null;
    }
    const row: Record<string, unknown> = {
      user_id: userId,
      mfa_enabled: input.mfaEnabled,
      token_ttl_seconds: input.tokenTtlSeconds,
      mfa_keyword: input.mfaKeyword ?? null,
      mfa_secret: mfaSecret,
      mfa_key: mfaKey,
    };
    const { data, error } = await supabase
      .from('user_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async disableMfa(userId: string) {
    const { error } = await supabase
      .from('user_settings')
      .update({ mfa_enabled: false, mfa_secret: null, mfa_key: null })
      .eq('user_id', userId);
    if (error) throw error;
  },
};
