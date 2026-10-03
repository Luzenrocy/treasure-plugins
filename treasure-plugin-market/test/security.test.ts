import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccessToken, createMfaKey, encryptMfaSecret, decryptMfaSecret, needsMfaVerification, verifyAccessToken } from '../src/security.ts';

const SECRET = 'JBSWY3DPEHPK3PXP';
const SECRET_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECRET_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SECRET_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

async function withJwtEnv(secret: string | undefined, previous: string | undefined, fn: () => Promise<void>) {
  const oldSecret = process.env.AUTH_JWT_SECRET;
  const oldPrevious = process.env.AUTH_JWT_PREVIOUS_SECRETS;
  process.env.AUTH_JWT_SECRET = secret;
  if (previous === undefined) delete process.env.AUTH_JWT_PREVIOUS_SECRETS;
  else process.env.AUTH_JWT_PREVIOUS_SECRETS = previous;
  try {
    return await fn();
  } finally {
    if (oldSecret === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = oldSecret;
    if (oldPrevious === undefined) delete process.env.AUTH_JWT_PREVIOUS_SECRETS;
    else process.env.AUTH_JWT_PREVIOUS_SECRETS = oldPrevious;
  }
}

test('createAccessToken/verifyAccessToken 同密钥往返校验通过', async () => {
  await withJwtEnv(SECRET_A, undefined, async () => {
    const token = await createAccessToken('user-1', 'aal1', 600);
    const claims = await verifyAccessToken(token);
    assert.ok(claims);
    assert.equal(claims.sub, 'user-1');
    assert.equal(claims.aal, 'aal1');
  });
});

test('签发后更换主密钥，旧 token 校验失败（登录即失效的场景）', async () => {
  let token: string;
  await withJwtEnv(SECRET_A, undefined, async () => { token = await createAccessToken('user-1', 'aal1', 600); });
  await withJwtEnv(SECRET_B, undefined, async () => {
    assert.equal(await verifyAccessToken(token!), null);
  });
});

test('AUTH_JWT_PREVIOUS_SECRETS 含旧密钥时，旧 token 可校验（密钥轮换兼容）', async () => {
  let token: string;
  await withJwtEnv(SECRET_A, undefined, async () => { token = await createAccessToken('user-1', 'aal1', 600); });
  await withJwtEnv(SECRET_B, `${SECRET_A}, ${SECRET_C}`, async () => {
    const claims = await verifyAccessToken(token!);
    assert.ok(claims);
    assert.equal(claims.sub, 'user-1');
  });
});

test('previous 密钥去重且逗号分隔解析', async () => {
  let token: string;
  await withJwtEnv(SECRET_A, undefined, async () => { token = await createAccessToken('user-1', 'aal1', 600); });
  await withJwtEnv(SECRET_B, `${SECRET_A},${SECRET_A}, ${SECRET_C}`, async () => {
    assert.ok(await verifyAccessToken(token!));
  });
});

test('主密钥与 previous 均不匹配时返回 null', async () => {
  let token: string;
  await withJwtEnv(SECRET_A, undefined, async () => { token = await createAccessToken('user-1', 'aal1', 600); });
  await withJwtEnv(SECRET_B, `${SECRET_C}`, async () => {
    assert.equal(await verifyAccessToken(token!), null);
  });
});

test('密钥全缺失时 verifyAccessToken 返回 null 而非抛错', async () => {
  await withJwtEnv(undefined, undefined, async () => {
    assert.equal(await verifyAccessToken('a.b.c'), null);
  });
});

test('被篡改的 token 返回 null', async () => {
  await withJwtEnv(SECRET_A, undefined, async () => {
    const token = await createAccessToken('user-1', 'aal1', 600);
    assert.equal(await verifyAccessToken(`${token}x`), null);
    assert.equal(await verifyAccessToken(token.slice(0, -1)), null);
  });
});

test('createMfaKey 返回 32 字节熵的 base64url 字符串', () => {
  const key = createMfaKey();
  assert.equal(typeof key, 'string');
  assert.equal(key.length, 43);
  assert.match(key, /^[A-Za-z0-9_-]{43}$/);
});

test('createMfaKey 每次生成不同密钥', () => {
  const keys = new Set(Array.from({ length: 50 }, () => createMfaKey()));
  assert.equal(keys.size, 50);
});

test('encryptMfaSecret/decryptMfaSecret 往返一致', async () => {
  const key = createMfaKey();
  const cipher = await encryptMfaSecret(SECRET, key);
  assert.equal(await decryptMfaSecret(cipher, key), SECRET);
});

test('相同明文 + 相同 key 产生不同密文（随机 IV）', async () => {
  const key = createMfaKey();
  const a = await encryptMfaSecret(SECRET, key);
  const b = await encryptMfaSecret(SECRET, key);
  assert.notEqual(a, b);
  assert.equal(await decryptMfaSecret(a, key), SECRET);
  assert.equal(await decryptMfaSecret(b, key), SECRET);
});

test('用其他 key 解密失败（GCM 认证标签）', async () => {
  const cipher = await encryptMfaSecret(SECRET, createMfaKey());
  await assert.rejects(() => decryptMfaSecret(cipher, createMfaKey()));
});

test('更换 key 后旧密文不可解（对应重新 enroll）', async () => {
  const oldKey = createMfaKey();
  const cipher = await encryptMfaSecret(SECRET, oldKey);
  await assert.rejects(() => decryptMfaSecret(cipher, createMfaKey()));
});

test('密文被篡改时解密失败', async () => {
  const key = createMfaKey();
  const cipher = await encryptMfaSecret(SECRET, key);
  const [iv, data] = cipher.split('.');
  const flipped = `${iv}.${data.slice(0, -1)}${data.at(-1) === 'A' ? 'B' : 'A'}`;
  await assert.rejects(() => decryptMfaSecret(flipped, key));
});

test('缺少 . 分隔符的密文抛出格式错误', async () => {
  const key = createMfaKey();
  await assert.rejects(() => decryptMfaSecret('no-separator', key), /MFA secret 格式无效/);
});

test('空 key 拒绝加密', async () => {
  await assert.rejects(() => encryptMfaSecret(SECRET, ''), /mfa_key/);
  await assert.rejects(() => encryptMfaSecret(SECRET, null), /mfa_key/);
});

test('长度不足的 key 被拒绝', async () => {
  await assert.rejects(() => encryptMfaSecret(SECRET, 'a'.repeat(16)), /mfa_key/);
});

test('Unicode 明文往返', async () => {
  const key = createMfaKey();
  const value = '种子-🔐-Ünïcödé';
  assert.equal(await decryptMfaSecret(await encryptMfaSecret(value, key), key), value);
});

test('长明文往返（边界）', async () => {
  const key = createMfaKey();
  const value = 'A'.repeat(4096);
  assert.equal(await decryptMfaSecret(await encryptMfaSecret(value, key), key), value);
});

test('needsMfaVerification: MFA 未开启时，敏感操作无需 MFA 二次验证（aal1 放行）', () => {
  assert.equal(needsMfaVerification(true, false, 'aal1'), false);
});

test('needsMfaVerification: MFA 未开启时，aal2 同样放行', () => {
  assert.equal(needsMfaVerification(true, false, 'aal2'), false);
});

test('needsMfaVerification: MFA 已开启但未验证（aal1）时，敏感操作要求 MFA 验证', () => {
  assert.equal(needsMfaVerification(true, true, 'aal1'), true);
});

test('needsMfaVerification: MFA 已开启且已验证（aal2）时，敏感操作放行', () => {
  assert.equal(needsMfaVerification(true, true, 'aal2'), false);
});

test('needsMfaVerification: 非敏感操作（requireMfa=false）永不要求 MFA 验证', () => {
  assert.equal(needsMfaVerification(false, true, 'aal1'), false);
});

test('needsMfaVerification: mfa_enabled 为 null 或 undefined 视为未开启', () => {
  assert.equal(needsMfaVerification(true, null, 'aal1'), false);
  assert.equal(needsMfaVerification(true, undefined, 'aal1'), false);
});

test('needsMfaVerification: MFA 已开启且 aal 缺失时要求验证', () => {
  assert.equal(needsMfaVerification(true, true, undefined), true);
});
