import { supabase } from '../supabase.js';

export const developerTokens = {
  async revokeActive(userId: string) {
    const { error } = await supabase
      .from('developer_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);
    if (error) throw error;
  },

  async create(input: { userId: string; tokenHash: string; expiresAt: string; createdBy: string }) {
    const { data, error } = await supabase
      .from('developer_tokens')
      .insert({
        user_id: input.userId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
        created_by: input.createdBy,
      })
      .select('id, expires_at');
    if (error) throw error;
    return data ?? [];
  },

  async byHash(tokenHash: string) {
    const { data, error } = await supabase
      .from('developer_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
};
