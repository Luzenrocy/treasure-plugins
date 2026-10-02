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