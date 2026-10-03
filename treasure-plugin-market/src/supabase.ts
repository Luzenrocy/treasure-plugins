import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 未配置');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 网络层健壮性：仅对 fetch 抛出的网络异常（连接复用失败/瞬时断连/TLS 等
 * undici TypeError: fetch failed）做指数退避重试；HTTP 4xx/5xx 是正常响应，不重试。
 */
async function retryFetch(input: Parameters<typeof fetch>[0], init?: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(150 * 2 ** attempt);
    }
  }
  throw lastError;
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: retryFetch },
});

// service-role 客户端：仅供会话存储认证（auth_sessions 表）使用，全库全权，绕过 RLS。
// 密钥只存服务端环境变量/FC Secret，绝不进入前端 bundle。未配置时置 null，
// 登录/会话接口会报错（JWT 过渡路径与开发者 token 接口不受影响）。
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseService = serviceKey
  ? createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: retryFetch },
    })
  : null;