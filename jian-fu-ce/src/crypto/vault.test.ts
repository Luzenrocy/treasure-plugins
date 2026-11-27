import { describe, expect, it } from 'vitest';
import { deriveKey, open, randomSalt, seal } from './vault';
import { validateEntry } from '../domain/entry';

describe('资料库加密', () => {
  it('验证主密码和绑定的条目身份', async () => {
    const salt = randomSalt();
    const key = await deriveKey('test password 12345', salt);
    const aad = ['entry', 1, 'vault', 'item', 'revision'];
    const encrypted = await seal(key, { title: '测试', value: 'synthetic secret' }, aad);
    expect(encrypted).not.toContain('synthetic secret');
    expect(await open(key, encrypted, aad)).toEqual({ title: '测试', value: 'synthetic secret' });
    await expect(open(key, encrypted, ['entry', 1, 'vault', 'other', 'revision'])).rejects.toThrow();
    const wrongKey = await deriveKey('wrong password 12345', salt);
    await expect(open(wrongKey, encrypted, aad)).rejects.toThrow();
  });

  it('区分单行凭据和多行内容', () => {
    const entry = { id: '1', kind: 'secret-key', title: '测试', value: 'a\nb', account: '', tags: [], notes: '', favorite: false, createdAt: 1, updatedAt: 1 };
    expect(() => validateEntry(entry)).toThrow();
    expect(validateEntry({ ...entry, kind: 'prompt' }).value).toBe('a\nb');
  });
});
