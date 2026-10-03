import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSessionId, isSessionActive, type SessionRow } from '../src/db/auth-sessions.ts';
import { createSessionId } from '../src/security.ts';

test('createSessionId 返回 32 字节熵的 base64url（43 字符）', () => {
  const id = createSessionId();
  assert.equal(id.length, 43);
  assert.match(id, /^[A-Za-z0-9_-]{43}$/);
});

test('createSessionId 每次生成不同值', () => {
  const ids = new Set(Array.from({ length: 50 }, () => createSessionId()));
  assert.equal(ids.size, 50);
});

test('isValidSessionId 接受合法 sessionId', () => {
  assert.equal(isValidSessionId(createSessionId()), true);
  // 格式合法即通过（存在性与有效性由 DB 查询决定）
  assert.equal(isValidSessionId('a'.repeat(43)), true);
});

test('isValidSessionId 拒绝空/长度不符/非法字符', () => {
  assert.equal(isValidSessionId(''), false);
  assert.equal(isValidSessionId('short'), false);
  assert.equal(isValidSessionId('a'.repeat(42)), false);
  assert.equal(isValidSessionId('a'.repeat(44)), false);
  assert.equal(isValidSessionId('a'.repeat(42) + '+'), false);
  assert.equal(isValidSessionId('a'.repeat(42) + '/'), false);
  assert.equal(isValidSessionId('a'.repeat(42) + '='), false);
  assert.equal(isValidSessionId(` ${'a'.repeat(42)}`), false);
});

test('isValidSessionId 拒绝 Vapor 等垃圾 JWT 值（含点分隔/超长）', () => {
  assert.equal(isValidSessionId('eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJWYXBvciIsImV4cCI6NjQwOTIyMTEyMDAsImFkbWluIjp0cnVlfQ.sig'), false);
  assert.equal(isValidSessionId('tpm_abcdef123456'), false);
  assert.equal(isValidSessionId('Bearer abc'), false);
});

const NOW = 1_700_000_000_000;
function baseSession(over: Partial<SessionRow> = {}): SessionRow {
  return {
    session_id: 'a'.repeat(43),
    user_id: 'user-1',
    aal: 'aal1',
    created_at: new Date(NOW - 1000).toISOString(),
    expires_at: new Date(NOW + 60_000).toISOString(),
    revoked_at: null,
    ...over,
  };
}

test('isSessionActive: 未撤销未过期为有效', () => {
  assert.equal(isSessionActive(baseSession(), NOW), true);
});

test('isSessionActive: 已过期为无效', () => {
  assert.equal(isSessionActive(baseSession({ expires_at: new Date(NOW - 1).toISOString() }), NOW), false);
});

test('isSessionActive: 恰在过期时刻视为无效', () => {
  assert.equal(isSessionActive(baseSession({ expires_at: new Date(NOW).toISOString() }), NOW), false);
});

test('isSessionActive: 已撤销为无效', () => {
  assert.equal(isSessionActive(baseSession({ revoked_at: new Date(NOW - 100).toISOString() }), NOW), false);
});

test('isSessionActive: 查询不到（null/undefined）为无效', () => {
  assert.equal(isSessionActive(null, NOW), false);
  assert.equal(isSessionActive(undefined, NOW), false);
});
