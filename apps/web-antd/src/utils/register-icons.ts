/**
 * 离线图标注册
 * 将本地图标集注册到 @iconify/vue，并禁用 CDN 加载
 */
import mdiIcons from '#/assets/icons/mdi-icons.json';
import lucideIcons from '#/assets/icons/lucide-icons.json';
import epIcons from '#/assets/icons/ep-icons.json';
import carbonIcons from '#/assets/icons/carbon-icons.json';
import { addCollection } from '@iconify/vue';

// 存储原始 fetch 函数
const originalFetch = typeof window !== 'undefined' ? window.fetch : null;

/**
 * 检查 URL 是否为 Iconify API 请求
 */
function isIconifyApiUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('api.iconify.design') ||
    url.includes('iconify.design') ||
    url.includes('api.iconify')
  );
}

/**
 * 离线模式下的 fetch 拦截器
 */
async function offlineFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (isIconifyApiUrl(url)) {
    // 返回一个模拟的空响应，阻止 CDN 请求
    return new Response(
      JSON.stringify({
        icons: {},
        not_found: [],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  // 其他请求使用原始 fetch
  if (originalFetch) {
    return originalFetch(input as any, init);
  }

  throw new Error('Fetch not available');
}

let registered = false;
let fetchPatched = false;

export function registerOfflineIcons() {
  if (registered) return;
  registered = true;

  try {
    // 注册所有本地图标集
    addCollection(mdiIcons as any);
    addCollection(lucideIcons as any);
    addCollection(epIcons as any);
    addCollection(carbonIcons as any);

    // 拦截 fetch，阻止对 Iconify API 的请求
    if (!fetchPatched && typeof window !== 'undefined') {
      fetchPatched = true;
      window.fetch = offlineFetch as typeof window.fetch;
      console.log('[Icons] Fetch intercepted for offline mode');
    }

    console.log('[Icons] All icon collections registered successfully (offline mode)');
  } catch (err) {
    console.warn('[Icons] Failed to register icon collections:', err);
  }
}
