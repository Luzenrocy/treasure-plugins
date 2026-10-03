export async function api<T>(path: string, options: RequestInit = {}, token = ''): Promise<T> {
  const base = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  // 令牌走 X-Access-Token 而不是标准的 Authorization: Bearer —— ModelScope 等托管平台的
  // 边缘网关会拦截 `Authorization: Bearer *`（判定为 SDK Token 访问）并直接返回 403，
  // 请求到不了后端，表现为"登录成功后一律提示登录已过期"。两者同时发送也会被拦截，故只发 X-Access-Token。
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Access-Token': token } : {}), ...(options.headers ?? {}) }, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body });
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
