export async function api<T>(path: string, options: RequestInit = {}, sessionId = ''): Promise<T> {
  const base = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  // 会话凭证（sessionId，服务端随机会话存储）走 access_token 查询参数而不是 header：
  // ModelScope/阿里云盾等托管平台的边缘网关会拦截 `Authorization: Bearer *`（判定为 SDK Token
  // 访问）并直接返回 403，请求根本到不了应用；部分平台连 X-Access-Token 等自定义头也可能拦截。
  // 查询参数实测可穿透网关。代价是会进入访问日志/浏览器历史，仅作为头通道不可用时的兜底方案。
  const url = sessionId ? `${base}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(sessionId)}` : `${base}${path}`;
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body });
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
