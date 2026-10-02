import { supabase } from '../supabase.js';

export const dashboard = {
  async counts() {
    const [pluginsResult, releasesResult, activeUsersResult, pendingPluginsResult, pendingReleasesResult] = await Promise.all([
      supabase
        .from('plugins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .is('deleted_at', null),
      supabase
        .from('plugin_releases')
        .select('plugins!inner(plugin_code)', { count: 'exact', head: true })
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('plugins.status', 'published')
        .is('plugins.deleted_at', null),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('plugins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review')
        .is('deleted_at', null),
      supabase
        .from('plugin_releases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review')
        .is('deleted_at', null),
    ]);
    if (pluginsResult.error) throw pluginsResult.error;
    if (releasesResult.error) throw releasesResult.error;
    if (activeUsersResult.error) throw activeUsersResult.error;
    if (pendingPluginsResult.error) throw pendingPluginsResult.error;
    if (pendingReleasesResult.error) throw pendingReleasesResult.error;
    return {
      publishedPlugins: pluginsResult.count ?? 0,
      releases: releasesResult.count ?? 0,
      activeUsers: activeUsersResult.count ?? 0,
      pending: (pendingPluginsResult.count ?? 0) + (pendingReleasesResult.count ?? 0),
    };
  },
};
