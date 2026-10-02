export async function api<T>(path: string, options: RequestInit = {}, token = ''): Promise<T> {
  const base = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) }, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    // 登录过期 / 无管理员权限：通知全局登出并回到登录页，其余错误仅抛出消息
    if (response.status === 401 || response.status === 403) {
      const message = payload.message ?? '';
      if (message === '登录已过期' || message === '没有管理员权限') {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tpm:session-expired'));
      }
    }
    throw new Error(payload.message || '请求失败');
  }
  return payload.data as T;
}
