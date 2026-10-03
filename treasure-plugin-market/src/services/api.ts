export async function api<T>(path: string, options: RequestInit = {}, sessionId = ''): Promise<T> {
  const base = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  // 会话凭证（sessionId，服务端随机会话存储）只走 sessionId 查询参数，不使用任何头通道：
  // ModelScope/阿里云盾等托管平台的边缘网关会拦截 `Authorization: Bearer *`（判定为 SDK Token
  // 访问）并直接返回 403，请求根本到不了应用；部分平台还会注入/屏蔽自定义头。查询参数实测
  // 可穿透网关且单一来源，不被注入头污染。代价是会进入访问日志/浏览器历史，属已知代价。
  // FC 等托管平台边缘网关仅放行 GET/POST，DELETE/PATCH/PUT 方法被直接拒绝
  // （`unauthorized method 'DELETE'`/`unauthorized method 'PATCH'` 等）：前端把
  // DELETE/PATCH/PUT 自动转为 POST + 查询参数（action=delete / action=patch / action=put），
  // 语义由查询参数表达（后端同时兼容原生方法）。
  const methodUpper = (options.method ?? '').toUpperCase();
  const isDelete = methodUpper === 'DELETE';
  const isPatch = methodUpper === 'PATCH';
  const isPut = methodUpper === 'PUT';
  const method = isDelete || isPatch || isPut ? 'POST' : options.method;
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  if (isDelete) params.set('action', 'delete');
  if (isPatch) params.set('action', 'patch');
  if (isPut) params.set('action', 'put');
  const query = params.toString();
  const url = query ? `${base}${path}${path.includes('?') ? '&' : '?'}${query}` : `${base}${path}`;
  const response = await fetch(url, { ...options, method, headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body });
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
