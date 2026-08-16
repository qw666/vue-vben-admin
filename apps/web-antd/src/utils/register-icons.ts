import { _api, addCollection } from '@iconify/vue';

import bizIcons from '#/assets/icons/biz-icons.json';
import carbonIcons from '#/assets/icons/carbon-icons.json';
import epIcons from '#/assets/icons/ep-icons.json';
import lucideIcons from '#/assets/icons/lucide-icons.json';
/**
 * 离线图标注册
 * 将本地图标集注册到 @iconify/vue，并禁用 CDN 加载
 */
import mdiIcons from '#/assets/icons/mdi-icons.json';

let registered = false;

export function registerOfflineIcons() {
  if (registered) return;
  registered = true;

  try {
    // 注册所有本地图标集
    addCollection(mdiIcons as any);
    addCollection(lucideIcons as any);
    addCollection(epIcons as any);
    addCollection(carbonIcons as any);
    addCollection(bizIcons as any);

    // 使用 setFetch 设置一个返回空响应的 fetch 函数
    // 这样只会影响 Iconify 的请求，不会影响其他 fetch 请求
    _api.setFetch(async () => {
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
    });
  } catch (error) {
    console.error('Failed to register icon collections:', error);
  }
}
