import { supabase } from '../supabase.js';
import { pickLatestVersion, planPluginReview, planReleaseReview, type ReviewAction, type ReleaseReviewAction } from './query-utils.js';

export const plugins = {
  async publicList() {
    const { data, error } = await supabase
      .from('plugins')
      .select('plugin_code, alias, description, author, categories, permissions')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('alias');
    if (error) throw error;
    return data ?? [];
  },

  async publicOne(code: string) {
    const { data, error } = await supabase
      .from('plugins')
      .select('plugin_code, alias, description, author, categories, permissions')
      .eq('plugin_code', code)
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  async publicReleases(code: string) {
    const { data, error } = await supabase
      .from('plugin_releases')
      .select('version, download_url, sha256, size_bytes, manifest_json, min_platform_version, changelog, published_at, plugins!inner(plugin_code, status, deleted_at)')
      .eq('plugins.plugin_code', code)
      .eq('plugins.status', 'published')
      .is('plugins.deleted_at', null)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // 纯 REST：嵌入 plugin_releases，业务层（pickLatestVersion）按 created_at desc 取最新版本。
  // 注意：不在 REST 层对嵌入列排序（PostgREST 解析 point 嵌套排序会报 PGRST100）。
  async adminList() {
    const { data, error } = await supabase
      .from('plugins')
      .select('*, plugin_releases(version, created_at, status)')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => pickLatestVersion(row));
  },

  // 版本归属：查版本所属插件的创建者，供权限守卫判定"user 能否操作该版本"。
  async releaseOwner(id: string) {
    const { data, error } = await supabase
      .from('plugin_releases')
      .select('id, plugins(created_by)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id as string, createdBy: (data as any)?.plugins?.created_by ?? null } : null;
  },

  // 两步写入 + 补偿：先建插件，再建版本；版本失败则回删插件，避免孤儿记录。
  // 非数据库事务，极端中断时可能残留无版本插件（可接受，status 为 pending_review）。
  async createWithRelease(actorId: string, input: { plugin: Record<string, unknown>; release: Record<string, unknown> }) {
    const pluginRow = {
      plugin_code: input.plugin.pluginCode as string,
      alias: input.plugin.alias as string,
      description: input.plugin.description as string,
      author: input.plugin.author as string,
      categories: input.plugin.categories ?? [],
      permissions: input.plugin.permissions ?? [],
      created_by: actorId,
      updated_by: actorId,
    };
    const { data: plugin, error: pluginError } = await supabase
      .from('plugins')
      .insert(pluginRow)
      .select('*')
      .single();
    if (pluginError) throw pluginError;

    const releaseRow = {
      plugin_id: plugin.id as string,
      version: input.release.version as string,
      download_url: input.release.downloadUrl as string,
      sha256: input.release.sha256 as string,
      size_bytes: input.release.sizeBytes as number,
      manifest_json: input.release.manifest ?? {},
      submitted_by: actorId,
    };
    const { data: release, error: releaseError } = await supabase
      .from('plugin_releases')
      .insert(releaseRow)
      .select('*')
      .single();

    if (releaseError) {
      await supabase.from('plugins').delete().eq('id', plugin.id as string).select('id');
      throw releaseError;
    }
    return { plugin, release };
  },

  async addRelease(pluginId: string, actorId: string, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('plugin_releases')
      .insert({
        plugin_id: pluginId,
        version: input.version as string,
        download_url: input.downloadUrl as string,
        sha256: input.sha256 as string,
        size_bytes: input.sizeBytes as number,
        manifest_json: input.manifest ?? {},
        submitted_by: actorId,
      })
      .select('*');
    if (error) throw error;
    return data ?? [];
  },

  async releases(code: string) {
    const { data, error } = await supabase
      .from('plugin_releases')
      .select('id, version, status, size_bytes, created_at, published_at, plugins!inner(plugin_code)')
      .eq('plugins.plugin_code', code)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async revokeRelease(id: string, actorId: string) {
    const { data, error } = await supabase
      .from('plugin_releases')
      .update({ status: 'revoked', reviewed_by: actorId, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*');
    if (error) throw error;
    return data ?? [];
  },

  // 先下线再删除：仅已下线（revoked）版本可删除
  async deleteRelease(id: string, actorId: string) {
    const { data: row, error: findError } = await supabase
      .from('plugin_releases')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (findError) throw findError;
    if (!row) throw new Error('版本不存在');
    if (row.status !== 'revoked') throw new Error('请先下线版本再删除');
    const { data, error } = await supabase
      .from('plugin_releases')
      .update({ status: 'deleted', deleted_at: new Date().toISOString(), deleted_by: actorId })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*');
    if (error) throw error;
    return data ?? [];
  },

  // 审核/恢复：先查插件及嵌入版本，按 planPluginReview 计算新状态后分表更新。
  // approve 时同步发布待审版本；非事务，极端中断时插件已发布而版本仍待审（可再次 approve 补齐）。
  async review(code: string, actorId: string, action: ReviewAction) {
    const { data: row, error } = await supabase
      .from('plugins')
      .select('id, status, plugin_releases(id, status)')
      .eq('plugin_code', code)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error('插件不存在');
    const plan = planPluginReview(action, row.status);
    const now = new Date().toISOString();
    const { data: updated, error: pluginError } = await supabase
      .from('plugins')
      .update({ status: plan.pluginStatus, updated_by: actorId })
      .eq('id', row.id)
      .select('*')
      .maybeSingle();
    if (pluginError) throw pluginError;
    if (plan.promotePendingReleases) {
      const pending = (row.plugin_releases ?? []).filter((release: any) => release.status === 'pending_review' || release.status === 'draft');
      if (pending.length > 0) {
        const { error: releaseError } = await supabase
          .from('plugin_releases')
          .update({ status: 'published', reviewed_by: actorId, published_by: actorId, reviewed_at: now, published_at: now })
          .in('id', pending.map((release: any) => release.id));
        if (releaseError) throw releaseError;
      }
    }
    return updated ?? row;
  },

  // 插件级下线：仅已发布插件可下架，市场公开列表随即不可见。
  async disable(code: string, actorId: string) {
    const { data: row, error } = await supabase
      .from('plugins')
      .select('id, status')
      .eq('plugin_code', code)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error('插件不存在');
    if (row.status !== 'published') throw new Error('仅已发布插件可下线');
    const { data, error: upError } = await supabase
      .from('plugins')
      .update({ status: 'disabled', updated_by: actorId })
      .eq('id', row.id)
      .select('*')
      .maybeSingle();
    if (upError) throw upError;
    return data ?? row;
  },

  // 插件级逻辑删除：先下线再删除——仅已下线（disabled）插件可删除。
  async remove(code: string, actorId: string) {
    const { data: row, error } = await supabase
      .from('plugins')
      .select('id, status')
      .eq('plugin_code', code)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error('插件不存在');
    if (row.status !== 'disabled') throw new Error('请先下线插件再删除');
    const { data, error: upError } = await supabase
      .from('plugins')
      .update({ status: 'deleted', deleted_at: new Date().toISOString(), deleted_by: actorId, updated_by: actorId })
      .eq('id', row.id)
      .select('*')
      .maybeSingle();
    if (upError) throw upError;
    return data ?? row;
  },

  // 版本级审批：approve 发布 / reject 退回草稿，仅待审与草稿版本可操作
  async reviewRelease(id: string, actorId: string, action: ReleaseReviewAction) {
    const { data: row, error } = await supabase
      .from('plugin_releases')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error('版本不存在');
    const plan = planReleaseReview(action, row.status);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: plan.releaseStatus, reviewed_by: actorId, reviewed_at: now };
    if (plan.releaseStatus === 'published') {
      patch.published_by = actorId;
      patch.published_at = now;
    }
    const { data: updated, error: upError } = await supabase
      .from('plugin_releases')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (upError) throw upError;
    return updated ?? row;
  },

  // 待办列表：待审核插件 + 待审核版本，供管理台"待办"页统一审批
  async pendingTodos() {
    const [pluginsResult, releasesResult] = await Promise.all([
      supabase
        .from('plugins')
        .select('id, plugin_code, alias, author, status, created_at')
        .eq('status', 'pending_review')
        .is('deleted_at', null)
        .order('created_at'),
      supabase
        .from('plugin_releases')
        .select('id, version, status, created_at, plugins!inner(plugin_code, alias)')
        .eq('status', 'pending_review')
        .is('deleted_at', null)
        .is('plugins.deleted_at', null)
        .order('created_at'),
    ]);
    if (pluginsResult.error) throw pluginsResult.error;
    if (releasesResult.error) throw releasesResult.error;
    const pluginItems = (pluginsResult.data ?? []).map((item: any) => ({
      type: 'plugin', id: item.id, pluginCode: item.plugin_code, alias: item.alias, author: item.author, version: null, createdAt: item.created_at,
    }));
    const releaseItems = (releasesResult.data ?? []).map((item: any) => ({
      type: 'release', id: item.id, pluginId: item.plugins?.id ?? null, pluginCode: item.plugins?.plugin_code ?? '', alias: item.plugins?.alias ?? '', author: null, version: item.version, createdAt: item.created_at,
    }));
    return [...pluginItems, ...releaseItems];
  },
};
