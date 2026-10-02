import { supabase } from '../supabase.js';

export const auditLogs = {
  async create(actorId: string | null, action: string, resourceType: string, resourceId?: string) {
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
    });
    if (error) throw error;
  },

  async list() {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_id, action, resource_type, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  },
};
