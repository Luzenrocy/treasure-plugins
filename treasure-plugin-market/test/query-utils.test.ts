import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLogin, pickLatestVersion, planPluginReview, planReleaseReview, readBody, roleAtLeast, canManagePlugin, extractSessionId, extractDeveloperToken } from '../src/db/query-utils.ts';

test('normalizeLogin 去除首尾空白并转小写', () => {
  assert.equal(normalizeLogin('  Treasure  '), 'treasure');
  assert.equal(normalizeLogin('Admin@X.com'), 'admin@x.com');
  assert.equal(normalizeLogin(''), '');
});

test('pickLatestVersion 从已发布 releases 取最新版本', () => {
  const row = {
    id: '1',
    plugin_releases: [
      { version: '1.2.0', created_at: '2026-10-01', status: 'published' },
      { version: '1.1.0', created_at: '2026-09-01', status: 'published' },
    ],
  };
  const out = pickLatestVersion(row);
  assert.equal(out.latest_version, '1.2.0');
  assert.equal(out.id, '1');
  assert.ok(!('plugin_releases' in out));
});

test('pickLatestVersion 无版本返回 null（对应未发布插件）', () => {
  assert.equal(pickLatestVersion({ id: '2', plugin_releases: [] }).latest_version, null);
  assert.equal(pickLatestVersion({ id: '3' }).latest_version, null);
});

test('pickLatestVersion 仅待审核/草稿版本时返回 null（列表展示已发布最新版本）', () => {
  const row = {
    plugin_releases: [
      { version: '0.9.0', created_at: '2026-09-01', status: 'pending_review' },
      { version: '0.8.0', created_at: '2026-08-01', status: 'draft' },
    ],
  };
  assert.equal(pickLatestVersion(row).latest_version, null);
});

test('pickLatestVersion 忽略更新的待审版本，取已发布中最新', () => {
  const row = {
    plugin_releases: [
      { version: '2.0.0', created_at: '2026-12-01', status: 'pending_review' },
      { version: '1.3.0', created_at: '2026-11-01', status: 'published' },
      { version: '1.2.0', created_at: '2026-10-01', status: 'published' },
    ],
  };
  assert.equal(pickLatestVersion(row).latest_version, '1.3.0');
});

test('pickLatestVersion 已下线版本不计入最新版本', () => {
  const row = {
    plugin_releases: [
      { version: '1.1.0', created_at: '2026-10-01', status: 'revoked' },
      { version: '1.0.0', created_at: '2026-09-01', status: 'published' },
    ],
  };
  assert.equal(pickLatestVersion(row).latest_version, '1.0.0');
});

test('pickLatestVersion 保留行其余字段并移除嵌入数组', () => {
  const row = {
    id: '1',
    alias: 'demo',
    plugin_releases: [{ version: '1.0.0', created_at: '2026-01-01', status: 'published' }],
  };
  const out = pickLatestVersion(row);
  assert.equal(out.id, '1');
  assert.equal(out.alias, 'demo');
  assert.equal(out.latest_version, '1.0.0');
  assert.ok(!('plugin_releases' in out));
});

test('pickLatestVersion 乱序数组仍取 created_at 最新版本（不依赖 REST 排序）', () => {
  const row = {
    plugin_releases: [
      { version: '1.1.0', created_at: '2026-09-01', status: 'published' },
      { version: '1.3.0', created_at: '2026-11-01', status: 'published' },
      { version: '1.2.0', created_at: '2026-10-01', status: 'published' },
    ],
  };
  assert.equal(pickLatestVersion(row).latest_version, '1.3.0');
});

test('pickLatestVersion 缺失 created_at 的版本按最旧处理', () => {
  const row = {
    plugin_releases: [
      { version: '0.9.0', created_at: null, status: 'published' },
      { version: '1.0.0', created_at: '2026-01-01', status: 'published' },
    ],
  };
  assert.equal(pickLatestVersion(row).latest_version, '1.0.0');
});

test('pickLatestVersion 全部版本缺失 created_at 时取嵌入列表首项', () => {
  const row = { plugin_releases: [{ version: '1.0.0', created_at: null, status: 'published' }, { version: '1.1.0', created_at: undefined, status: 'published' }] };
  assert.equal(pickLatestVersion(row).latest_version, '1.0.0');
});

test('planPluginReview approve 待审核插件发布并同步发布待审版本', () => {
  const plan = planPluginReview('approve', 'pending_review');
  assert.deepEqual(plan, { pluginStatus: 'published', promotePendingReleases: true });
});

test('planPluginReview reject 待审核插件退回草稿且不发布版本', () => {
  const plan = planPluginReview('reject', 'pending_review');
  assert.deepEqual(plan, { pluginStatus: 'draft', promotePendingReleases: false });
});

test('planPluginReview restore 已下架插件恢复发布', () => {
  const plan = planPluginReview('restore', 'disabled');
  assert.deepEqual(plan, { pluginStatus: 'published', promotePendingReleases: false });
});

test('planPluginReview 对已发布插件重复 approve 保持发布态', () => {
  assert.deepEqual(planPluginReview('approve', 'published'), { pluginStatus: 'published', promotePendingReleases: true });
});

test('planPluginReview 非下架状态执行 restore 抛错', () => {
  assert.throws(() => planPluginReview('restore', 'published'), /仅下架插件可恢复/);
  assert.throws(() => planPluginReview('restore', 'pending_review'), /仅下架插件可恢复/);
});

test('planPluginReview 已删除插件不可审核或驳回', () => {
  assert.throws(() => planPluginReview('approve', 'deleted'), /已删除/);
  assert.throws(() => planPluginReview('reject', 'deleted'), /已删除/);
});

test('planPluginReview 非法审核动作抛错', () => {
  assert.throws(() => planPluginReview('fire' as any, 'pending_review'), /无效的审核操作/);
});

test('readBody GET / DELETE 请求直接返回 undefined', async () => {
  assert.equal(await readBody(new Request('http://test/x', { method: 'GET' })), undefined);
  assert.equal(await readBody(new Request('http://test/x', { method: 'DELETE' })), undefined);
});

test('readBody POST 空 body 返回空对象（不抛 Unexpected end of JSON input）', async () => {
  const req = new Request('http://test/x', { method: 'POST' });
  assert.deepEqual(await readBody(req), {});
});

test('readBody POST 合法 JSON 返回解析对象', async () => {
  const req = new Request('http://test/x', { method: 'POST', body: JSON.stringify({ action: 'approve' }), headers: { 'content-type': 'application/json' } });
  assert.deepEqual(await readBody(req), { action: 'approve' });
});

test('readBody POST 非法 JSON 返回空对象而非抛错', async () => {
  const req = new Request('http://test/x', { method: 'POST', body: 'not-json{{' });
  assert.deepEqual(await readBody(req), {});
});

test('extractSessionId 读取 sessionId 查询参数', () => {
  const req = new Request('http://test/x?sessionId=abc123');
  assert.equal(extractSessionId(req), 'abc123');
});

test('extractSessionId 去除首尾空白', () => {
  const req = new Request('http://test/x?sessionId=%20%20abc123%20%20');
  assert.equal(extractSessionId(req), 'abc123');
});

test('extractSessionId 缺少参数返回空字符串', () => {
  assert.equal(extractSessionId(new Request('http://test/x')), '');
  assert.equal(extractSessionId(new Request('http://test/x?foo=1')), '');
});

test('extractSessionId 与其他参数共存时正确取值', () => {
  const req = new Request('http://test/x?foo=1&sessionId=abc&bar=2');
  assert.equal(extractSessionId(req), 'abc');
});

test('extractSessionId 只认 sessionId 参数，不读任何头通道', () => {
  const req = new Request('http://test/x?sessionId=from-query', { headers: { authorization: 'Bearer from-authz', 'x-access-token': 'from-x' } });
  assert.equal(extractSessionId(req), 'from-query');
});

test('extractSessionId 不读取 access_token 遗留参数', () => {
  const req = new Request('http://test/x?access_token=old-token');
  assert.equal(extractSessionId(req), '');
});

test('extractDeveloperToken 读取 token 查询参数', () => {
  const req = new Request('http://test/x?token=tpm_abc');
  assert.equal(extractDeveloperToken(req), 'tpm_abc');
});

test('extractDeveloperToken 去除首尾空白并缺省返回空串', () => {
  const req = new Request('http://test/x?token=%20%20tpm_abc%20%20');
  assert.equal(extractDeveloperToken(req), 'tpm_abc');
  assert.equal(extractDeveloperToken(new Request('http://test/x')), '');
});

test('extractDeveloperToken 不读头与 sessionId 参数', () => {
  const req = new Request('http://test/x?sessionId=abc', { headers: { authorization: 'Bearer tpm_from_authz' } });
  assert.equal(extractDeveloperToken(req), '');
});

test('planReleaseReview 通过待审版本后发布', () => {
  assert.deepEqual(planReleaseReview('approve', 'pending_review'), { releaseStatus: 'published' });
});

test('planReleaseReview 通过草稿版本后发布', () => {
  assert.deepEqual(planReleaseReview('approve', 'draft'), { releaseStatus: 'published' });
});

test('planReleaseReview 驳回待审版本转草稿', () => {
  assert.deepEqual(planReleaseReview('reject', 'pending_review'), { releaseStatus: 'draft' });
});

test('planReleaseReview 已发布/已下线/已删除版本不可审批', () => {
  assert.throws(() => planReleaseReview('approve', 'published'), /已发布版本不可审批/);
  assert.throws(() => planReleaseReview('reject', 'published'), /已发布版本不可审批/);
  assert.throws(() => planReleaseReview('approve', 'revoked'), /已下线/);
  assert.throws(() => planReleaseReview('approve', 'deleted'), /已删除/);
});

test('planReleaseReview 非法动作抛错', () => {
  assert.throws(() => planReleaseReview('fire' as any, 'pending_review'), /无效的审核操作/);
});

test('roleAtLeast admin 满足所有角色门槛', () => {
  assert.equal(roleAtLeast('admin', 'user'), true);
  assert.equal(roleAtLeast('admin', 'operator'), true);
  assert.equal(roleAtLeast('admin', 'admin'), true);
});

test('roleAtLeast operator 满足 user 门槛但不满足 admin', () => {
  assert.equal(roleAtLeast('operator', 'user'), true);
  assert.equal(roleAtLeast('operator', 'operator'), true);
  assert.equal(roleAtLeast('operator', 'admin'), false);
});

test('roleAtLeast user 仅满足 user 门槛', () => {
  assert.equal(roleAtLeast('user', 'user'), true);
  assert.equal(roleAtLeast('user', 'operator'), false);
  assert.equal(roleAtLeast('user', 'admin'), false);
});

test('roleAtLeast 空/未知角色不满足任何门槛', () => {
  assert.equal(roleAtLeast(undefined, 'user'), false);
  assert.equal(roleAtLeast(null, 'user'), false);
  assert.equal(roleAtLeast('', 'user'), false);
  assert.equal(roleAtLeast('superuser', 'user'), false);
});

test('canManagePlugin admin 可管理任意插件', () => {
  assert.equal(canManagePlugin('admin', 'any-one', 'me'), true);
  assert.equal(canManagePlugin('admin', null, 'me'), true);
});

test('canManagePlugin operator 不可管理任何插件', () => {
  assert.equal(canManagePlugin('operator', 'me', 'me'), false);
  assert.equal(canManagePlugin('operator', 'other', 'me'), false);
});

test('canManagePlugin user 仅可管理自己创建的插件', () => {
  assert.equal(canManagePlugin('user', 'me', 'me'), true);
  assert.equal(canManagePlugin('user', 'other', 'me'), false);
  assert.equal(canManagePlugin('user', null, 'me'), false);
});
